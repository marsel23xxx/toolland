<script setup lang="ts">
/**
 * Rapat Video peer-to-peer untuk 2-4 orang. Room dibuat dengan ID acak di hash URL (#r=...),
 * jadi ID tidak pernah terkirim ke server lewat URL. Video dan suara langsung antar-browser;
 * server hanya signaling (lihat lib/meet). Fitur: kamera/mic, berbagi layar, blur latar,
 * chat, ruang tunggu, kunci room, dan mengeluarkan peserta (host).
 */
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue';
import type { ToolMessages } from '../../i18n';
import { fill } from '../../lib/format';
import type { BackgroundBlur } from '../../lib/meet/blur';
import { mediaConstraints } from '../../lib/meet/media';
import { Mesh, type PeerConn } from '../../lib/meet/mesh';
import {
  newRoomId,
  parseRoom,
  ROOM_RE,
  Signal,
  signalUrl,
  type ServerMsg,
} from '../../lib/meet/signal';
import MeetTile from './MeetTile.vue';

const props = defineProps<{ m: Record<string, string> }>();
const m = props.m as ToolMessages<'meet'>;

type Phase = 'home' | 'prejoin' | 'connecting' | 'waiting' | 'room' | 'ended';
const phase = ref<Phase>('home');
const room = ref('');
const joinInput = ref('');
const joinError = ref(false);
const NAME_KEY = 'toolland-meet-name';
const name = ref('');

// --- Media lokal -----------------------------------------------------------------------------
const cam = shallowRef<MediaStreamTrack | null>(null);
const mic = shallowRef<MediaStreamTrack | null>(null);
const screen = shallowRef<MediaStreamTrack | null>(null);
const blur = shallowRef<BackgroundBlur | null>(null);
const micOn = ref(true);
const camOn = ref(true);
const blurOn = ref(false);
const blurBusy = ref(false);
const mediaError = ref('');
const cameras = ref<MediaDeviceInfo[]>([]);
const mics = ref<MediaDeviceInfo[]>([]);
const camId = ref('');
const micId = ref('');
const canShare = ref(false);

/** Track video yang dikirim: layar > blur > kamera (null bila kamera mati). */
const videoOut = computed<MediaStreamTrack | null>(() =>
  screen.value ? screen.value : !camOn.value ? null : (blur.value?.track ?? cam.value),
);
const selfStream = computed(() => (videoOut.value ? new MediaStream([videoOut.value]) : null));

async function openCamera() {
  mediaError.value = '';
  const { video, audio } = mediaConstraints(camId.value, micId.value);
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video, audio });
  } catch {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio });
      mediaError.value = m.noCamera;
    } catch {
      mediaError.value = m.noMedia;
    }
  }
  stopTrack(cam.value);
  stopTrack(mic.value);
  cam.value = stream?.getVideoTracks()[0] ?? null;
  mic.value = stream?.getAudioTracks()[0] ?? null;
  if (mic.value) mic.value.enabled = micOn.value;
  camOn.value = !!cam.value && camOn.value;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    cameras.value = devices.filter((d) => d.kind === 'videoinput' && d.deviceId);
    mics.value = devices.filter((d) => d.kind === 'audioinput' && d.deviceId);
  } catch {
    // Daftar perangkat tidak wajib.
  }
  camId.value = cam.value?.getSettings().deviceId ?? camId.value;
  micId.value = mic.value?.getSettings().deviceId ?? micId.value;
  if (blurOn.value) await startBlur();
  pushTracks();
}

function stopTrack(t: MediaStreamTrack | null) {
  t?.stop();
}

async function startBlur() {
  blur.value?.stop();
  blur.value = null;
  if (!cam.value) return;
  blurBusy.value = true;
  try {
    const { BackgroundBlur } = await import('../../lib/meet/blur');
    blur.value = await BackgroundBlur.start(cam.value);
  } catch {
    blurOn.value = false;
    mediaError.value = m.blurError;
  } finally {
    blurBusy.value = false;
  }
}

async function toggleBlur() {
  blurOn.value = !blurOn.value;
  if (blurOn.value) await startBlur();
  else {
    blur.value?.stop();
    blur.value = null;
  }
  pushTracks();
}

function toggleMic() {
  micOn.value = !micOn.value;
  if (mic.value) mic.value.enabled = micOn.value;
  sendState();
}

function toggleCam() {
  if (!cam.value) return;
  camOn.value = !camOn.value;
  pushTracks();
}

async function toggleScreen() {
  if (screen.value) return stopScreen();
  try {
    const s = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 15 },
      audio: false,
    });
    const t = s.getVideoTracks()[0];
    t.addEventListener('ended', stopScreen);
    screen.value = t;
    pushTracks();
  } catch {
    // Pengguna membatalkan pilihan layar.
  }
}

function stopScreen() {
  stopTrack(screen.value);
  screen.value = null;
  pushTracks();
}

// --- Room ------------------------------------------------------------------------------------
interface Peer {
  id: number;
  name: string;
  stream: MediaStream | null;
  mic: boolean;
  cam: boolean;
  screen: boolean;
  conn: PeerConn;
  /** Naik setiap ada track baru agar tile memasang ulang stream. */
  rev: number;
}
const peers = reactive(new Map<number, Peer>());
const knocks = ref<{ id: number; name: string }[]>([]);
const me = ref(0);
const host = ref(0);
const locked = ref(false);
const lobby = ref(true);
const endReason = ref('');
const panel = ref<'chat' | 'people' | null>(null);
const chat = ref<{ from: number; name: string; text: string; mine: boolean }[]>([]);
const unread = ref(0);
const draft = ref('');
const linkCopied = ref(false);
const chatEl = ref<HTMLDivElement>();
let signal: Signal | null = null;
let mesh: Mesh | null = null;

const isHost = computed(() => me.value !== 0 && me.value === host.value);
const peerList = computed(() => [...peers.values()]);
const inviteLink = computed(() =>
  typeof location === 'undefined' ? '' : `${location.origin}${location.pathname}#r=${room.value}`,
);

function pushTracks() {
  mesh?.setTracks(mic.value, videoOut.value);
  sendState();
}
function sendState() {
  signal?.send({
    t: 'state',
    mic: micOn.value && !!mic.value,
    cam: !!videoOut.value,
    screen: !!screen.value,
  });
}

function setRoom(id: string) {
  room.value = id;
  history.replaceState(null, '', `${location.pathname}#r=${id}`);
  phase.value = 'prejoin';
  void openCamera();
}

function createRoom() {
  chat.value = [];
  unread.value = 0;
  setRoom(newRoomId());
}

function joinByInput() {
  const id = parseRoom(joinInput.value);
  joinError.value = !id;
  if (id) setRoom(id);
}

function join() {
  const n = name.value.trim();
  if (!n) return;
  try {
    localStorage.setItem(NAME_KEY, n);
  } catch {
    // Abaikan.
  }
  phase.value = 'connecting';
  signal = new Signal(signalUrl(), { room: room.value, name: n }, onMessage, (reason) =>
    end(reason),
  );
}

function onMessage(msg: ServerMsg) {
  switch (msg.t) {
    case 'welcome':
      me.value = msg.you;
      host.value = msg.host;
      locked.value = msg.locked;
      lobby.value = msg.lobby;
      mesh = new Mesh(msg.you, msg.ice, {
        signal: (to, data) => signal?.send({ t: 'signal', to, data }),
        stream: (id, stream) => {
          const p = peers.get(id);
          if (p) {
            p.stream = stream;
            p.rev++;
          }
        },
        conn: (id, state) => {
          const p = peers.get(id);
          if (p) p.conn = state;
        },
      });
      mesh.setTracks(mic.value, videoOut.value);
      for (const p of msg.peers) {
        addPeer(p.id, p.name);
        mesh.add(p.id, true);
      }
      phase.value = 'room';
      sendState();
      break;
    case 'waiting':
      phase.value = 'waiting';
      break;
    case 'knock':
      if (!knocks.value.some((k) => k.id === msg.id))
        knocks.value.push({ id: msg.id, name: msg.name });
      break;
    case 'knock-cancel':
      knocks.value = knocks.value.filter((k) => k.id !== msg.id);
      break;
    case 'peer-join':
      addPeer(msg.id, msg.name);
      mesh?.add(msg.id, false);
      sendState();
      break;
    case 'peer-leave':
      mesh?.remove(msg.id);
      peers.delete(msg.id);
      break;
    case 'host':
      host.value = msg.id;
      break;
    case 'room':
      locked.value = msg.locked;
      lobby.value = msg.lobby;
      break;
    case 'signal':
      void mesh?.signal(msg.from, msg.data);
      break;
    case 'chat':
      chat.value.push({
        from: msg.from,
        name: msg.name,
        text: msg.text,
        mine: msg.from === me.value,
      });
      if (panel.value !== 'chat' && msg.from !== me.value) unread.value++;
      void nextTick(() => chatEl.value?.scrollTo({ top: chatEl.value.scrollHeight }));
      break;
    case 'state': {
      const p = peers.get(msg.from);
      if (p) Object.assign(p, { mic: msg.mic, cam: msg.cam, screen: msg.screen });
      break;
    }
  }
}

function addPeer(id: number, peerName: string) {
  if (!peers.has(id))
    peers.set(id, {
      id,
      name: peerName,
      stream: null,
      mic: true,
      cam: true,
      screen: false,
      conn: 'connecting',
      rev: 0,
    });
}

function cleanup() {
  signal?.close();
  signal = null;
  mesh?.close();
  mesh = null;
  peers.clear();
  knocks.value = [];
  me.value = 0;
  host.value = 0;
}

function end(reason: string) {
  stopAll();
  cam.value = null;
  mic.value = null;
  screen.value = null;
  endReason.value = reason;
  phase.value = 'ended';
}

function leave() {
  end('left');
}

function rejoin() {
  chat.value = [];
  unread.value = 0;
  phase.value = 'prejoin';
  void openCamera();
}

function sendChat() {
  const text = draft.value.trim();
  if (!text) return;
  signal?.send({ t: 'chat', text });
  draft.value = '';
}

function openPanel(p: 'chat' | 'people') {
  panel.value = panel.value === p ? null : p;
  if (panel.value === 'chat') {
    unread.value = 0;
    void nextTick(() => chatEl.value?.scrollTo({ top: chatEl.value.scrollHeight }));
  }
}

async function copyInvite() {
  try {
    await navigator.clipboard.writeText(inviteLink.value);
    linkCopied.value = true;
    setTimeout(() => (linkCopied.value = false), 2500);
  } catch {
    // Link tetap terlihat untuk disalin manual.
  }
}

const admit = (id: number) => signal?.send({ t: 'admit', id });
const deny = (id: number) => signal?.send({ t: 'deny', id });
const kick = (id: number) => signal?.send({ t: 'kick', id });
const setLock = (on: boolean) => signal?.send({ t: 'lock', on });
const setLobby = (on: boolean) => signal?.send({ t: 'lobby', on });

async function changeDevice() {
  await openCamera();
}

function stopAll() {
  cleanup();
  blur.value?.stop();
  blur.value = null;
  for (const t of [cam.value, mic.value, screen.value]) stopTrack(t);
}

onMounted(() => {
  canShare.value = !!navigator.mediaDevices?.getDisplayMedia;
  try {
    name.value = localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    // Abaikan.
  }
  const id = /[#&]r=([a-z0-9-]+)/.exec(location.hash)?.[1];
  if (id && ROOM_RE.test(id)) setRoom(id);
  window.addEventListener('pagehide', stopAll);
});
onBeforeUnmount(() => {
  window.removeEventListener('pagehide', stopAll);
  stopAll();
});

const gridClass = computed(() => {
  const n = peers.size + 1;
  return n === 1 ? 'grid-cols-1 max-w-3xl' : n === 2 ? 'sm:grid-cols-2' : 'grid-cols-2';
});
const peerNote = (p: Peer) =>
  p.conn === 'failed' ? m.connFailed : p.conn === 'connecting' ? m.connecting : '';
const reasonText = computed(() => m[`end_${endReason.value}` as 'end_left'] ?? m.end_network);
</script>

<template>
  <div class="space-y-4" data-meet :data-meet-phase="phase">
    <!-- Beranda: buat atau gabung -->
    <section v-if="phase === 'home'" class="grid gap-4 md:grid-cols-2">
      <div class="card space-y-3">
        <h2 class="font-display text-xl">{{ m.newTitle }}</h2>
        <p class="text-sm text-ink-2">{{ m.newDesc }}</p>
        <button type="button" class="btn btn-primary" data-meet-new @click="createRoom">
          {{ m.newBtn }}
        </button>
      </div>
      <form class="card space-y-3" @submit.prevent="joinByInput">
        <h2 class="font-display text-xl">{{ m.joinTitle }}</h2>
        <label class="block text-sm text-ink-2" for="meet-join">{{ m.joinDesc }}</label>
        <div class="flex gap-2">
          <input
            id="meet-join"
            v-model="joinInput"
            class="field min-w-0 flex-1"
            :placeholder="m.joinPlaceholder"
            autocomplete="off"
            data-meet-code
          />
          <button type="submit" class="btn">{{ m.joinBtn }}</button>
        </div>
        <p v-if="joinError" class="error-text" role="alert">{{ m.joinError }}</p>
      </form>
      <ul class="list-disc space-y-1 pl-5 text-sm text-ink-2 md:col-span-2">
        <li>{{ m.note1 }}</li>
        <li>{{ m.note2 }}</li>
        <li>{{ m.note3 }}</li>
      </ul>
    </section>

    <!-- Persiapan sebelum masuk -->
    <section
      v-else-if="phase === 'prejoin' || phase === 'connecting' || phase === 'waiting'"
      class="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
      data-meet-prejoin
    >
      <div class="space-y-3">
        <MeetTile
          :stream="selfStream"
          :name="name || m.you"
          :video="!!videoOut"
          :mic="micOn && !!mic"
          self
          :mirror="!screen"
        />
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="btn"
            :aria-pressed="micOn"
            :disabled="!mic"
            data-meet-mic
            @click="toggleMic"
          >
            {{ micOn ? `🎙 ${m.micOn}` : `🔇 ${m.micOff}` }}
          </button>
          <button
            type="button"
            class="btn"
            :aria-pressed="camOn"
            :disabled="!cam"
            data-meet-cam
            @click="toggleCam"
          >
            {{ camOn ? `📷 ${m.camOn}` : `🚫 ${m.camOff}` }}
          </button>
          <button
            type="button"
            class="btn"
            :aria-pressed="blurOn"
            :disabled="!cam || blurBusy"
            data-meet-blur
            @click="toggleBlur"
          >
            {{ blurBusy ? m.blurLoading : blurOn ? `✨ ${m.blurOn}` : `✨ ${m.blurOff}` }}
          </button>
        </div>
        <div v-if="cameras.length > 1 || mics.length > 1" class="grid gap-2 sm:grid-cols-2">
          <label v-if="cameras.length > 1" class="text-sm">
            {{ m.camera }}
            <select v-model="camId" class="field mt-1 w-full py-1.5" @change="changeDevice">
              <option v-for="(d, i) in cameras" :key="d.deviceId" :value="d.deviceId">
                {{ d.label || `${m.camera} ${i + 1}` }}
              </option>
            </select>
          </label>
          <label v-if="mics.length > 1" class="text-sm">
            {{ m.microphone }}
            <select v-model="micId" class="field mt-1 w-full py-1.5" @change="changeDevice">
              <option v-for="(d, i) in mics" :key="d.deviceId" :value="d.deviceId">
                {{ d.label || `${m.microphone} ${i + 1}` }}
              </option>
            </select>
          </label>
        </div>
        <p v-if="mediaError" class="text-sm text-secang dark:text-[#e98a98]" role="alert">
          {{ mediaError }}
        </p>
      </div>

      <div class="card space-y-3 self-start">
        <p class="text-xs font-semibold tracking-wider text-ink-3 uppercase">{{ m.roomLabel }}</p>
        <p class="font-mono text-xl" data-meet-room>{{ room }}</p>
        <button type="button" class="btn w-full" data-meet-copy @click="copyInvite">
          {{ linkCopied ? m.copied : m.copyLink }}
        </button>
        <template v-if="phase === 'prejoin'">
          <label class="block text-sm" for="meet-name">{{ m.yourName }}</label>
          <input
            id="meet-name"
            v-model="name"
            class="field w-full"
            maxlength="40"
            autocomplete="name"
            data-meet-name-input
            @keydown.enter="join"
          />
          <button
            type="button"
            class="btn btn-primary w-full"
            :disabled="!name.trim()"
            data-meet-join
            @click="join"
          >
            {{ m.joinNow }}
          </button>
        </template>
        <p v-else-if="phase === 'connecting'" role="status">{{ m.connectingRoom }}</p>
        <div v-else class="space-y-2" role="status" data-meet-waiting>
          <p class="font-semibold">{{ m.waitingTitle }}</p>
          <p class="text-sm text-ink-2">{{ m.waitingDesc }}</p>
          <button type="button" class="btn w-full" @click="leave">{{ m.cancel }}</button>
        </div>
      </div>
    </section>

    <!-- Di dalam room -->
    <section v-else-if="phase === 'room'" class="space-y-3" data-meet-room-view>
      <div
        v-for="k in isHost ? knocks : []"
        :key="k.id"
        class="flex flex-wrap items-center gap-2 rounded-md border border-brand-600 bg-brand-600/10 p-3 text-sm dark:border-brand-400"
        role="alert"
        data-meet-knock
      >
        <span class="flex-1">{{ fill(m.knock, { name: k.name }) }}</span>
        <button type="button" class="btn btn-primary" data-meet-admit @click="admit(k.id)">
          {{ m.admit }}
        </button>
        <button type="button" class="btn" @click="deny(k.id)">{{ m.deny }}</button>
      </div>

      <div class="flex flex-col gap-3 lg:flex-row">
        <div class="mx-auto grid w-full flex-1 gap-2" :class="gridClass" data-meet-grid>
          <MeetTile
            :stream="selfStream"
            :name="fill(m.youName, { name })"
            :video="!!videoOut"
            :mic="micOn && !!mic"
            self
            :mirror="!screen"
            :badge="isHost ? m.hostBadge : screen ? m.sharing : undefined"
          />
          <MeetTile
            v-for="p in peerList"
            :key="`${p.id}-${p.rev}`"
            :stream="p.stream"
            :name="p.name"
            :video="p.cam && !!p.stream?.getVideoTracks().length"
            :mic="p.mic"
            :badge="p.id === host ? m.hostBadge : p.screen ? m.sharing : undefined"
            :note="peerNote(p)"
          />
        </div>

        <aside
          v-if="panel"
          class="card flex max-h-[70vh] w-full flex-col gap-3 lg:w-80"
          :aria-label="panel === 'chat' ? m.chat : m.people"
        >
          <div class="flex items-center justify-between">
            <h2 class="font-semibold">{{ panel === 'chat' ? m.chat : m.people }}</h2>
            <button type="button" class="text-sm underline" @click="panel = null">
              {{ m.close }}
            </button>
          </div>
          <template v-if="panel === 'chat'">
            <div ref="chatEl" class="min-h-40 flex-1 space-y-2 overflow-y-auto" data-meet-chat>
              <p v-if="!chat.length" class="text-sm text-ink-3">{{ m.chatEmpty }}</p>
              <p v-for="(c, i) in chat" :key="i" class="text-sm break-words">
                <span
                  class="font-semibold"
                  :class="c.mine ? 'text-brand-700 dark:text-brand-300' : ''"
                  >{{ c.mine ? m.you : c.name }}:</span
                >
                {{ c.text }}
              </p>
            </div>
            <form class="flex gap-2" @submit.prevent="sendChat">
              <input
                v-model="draft"
                class="field min-w-0 flex-1"
                maxlength="1000"
                :placeholder="m.chatPlaceholder"
                :aria-label="m.chatPlaceholder"
                data-meet-chat-input
              />
              <button type="submit" class="btn">{{ m.send }}</button>
            </form>
            <p class="text-xs text-ink-3">{{ m.chatNote }}</p>
          </template>
          <template v-else>
            <ul class="space-y-2 text-sm" data-meet-people>
              <li class="flex items-center justify-between gap-2">
                <span>{{ fill(m.youName, { name }) }}</span>
                <span v-if="isHost" class="text-xs text-ink-3">{{ m.hostBadge }}</span>
              </li>
              <li v-for="p in peerList" :key="p.id" class="flex items-center justify-between gap-2">
                <span class="truncate">{{ p.name }}</span>
                <button
                  v-if="isHost"
                  type="button"
                  class="text-xs text-secang underline dark:text-[#e98a98]"
                  @click="kick(p.id)"
                >
                  {{ m.kick }}
                </button>
                <span v-else-if="p.id === host" class="text-xs text-ink-3">{{ m.hostBadge }}</span>
              </li>
            </ul>
            <div v-if="isHost" class="space-y-2 border-t border-rule pt-3 text-sm">
              <label class="flex items-center gap-2">
                <input
                  type="checkbox"
                  :checked="lobby"
                  data-meet-lobby
                  @change="setLobby(($event.target as HTMLInputElement).checked)"
                />
                {{ m.lobbyToggle }}
              </label>
              <label class="flex items-center gap-2">
                <input
                  type="checkbox"
                  :checked="locked"
                  data-meet-lock
                  @change="setLock(($event.target as HTMLInputElement).checked)"
                />
                {{ m.lockToggle }}
              </label>
            </div>
            <p v-else class="text-xs text-ink-3">
              {{ locked ? m.lockedNote : lobby ? m.lobbyNote : '' }}
            </p>
            <button type="button" class="btn w-full" @click="copyInvite">
              {{ linkCopied ? m.copied : m.copyLink }}
            </button>
          </template>
        </aside>
      </div>

      <!-- Tombol kendali -->
      <div
        class="flex flex-wrap items-center justify-center gap-2 rounded-md border border-rule bg-paper-2 p-2"
      >
        <button
          type="button"
          class="btn"
          :aria-pressed="micOn"
          :disabled="!mic"
          data-meet-mic
          @click="toggleMic"
        >
          {{ micOn ? `🎙 ${m.micOn}` : `🔇 ${m.micOff}` }}
        </button>
        <button
          type="button"
          class="btn"
          :aria-pressed="camOn"
          :disabled="!cam"
          data-meet-cam
          @click="toggleCam"
        >
          {{ camOn ? `📷 ${m.camOn}` : `🚫 ${m.camOff}` }}
        </button>
        <button
          type="button"
          class="btn"
          :aria-pressed="blurOn"
          :disabled="!cam || blurBusy"
          data-meet-blur
          @click="toggleBlur"
        >
          {{ blurBusy ? m.blurLoading : `✨ ${blurOn ? m.blurOn : m.blurOff}` }}
        </button>
        <button
          v-if="canShare"
          type="button"
          class="btn"
          :aria-pressed="!!screen"
          data-meet-share
          @click="toggleScreen"
        >
          🖥 {{ screen ? m.stopShare : m.share }}
        </button>
        <button
          type="button"
          class="btn"
          :aria-pressed="panel === 'chat'"
          data-meet-chat-btn
          @click="openPanel('chat')"
        >
          💬 {{ m.chat
          }}<span v-if="unread" class="ml-1 rounded-full bg-secang px-1.5 text-xs text-white">{{
            unread
          }}</span>
        </button>
        <button
          type="button"
          class="btn"
          :aria-pressed="panel === 'people'"
          data-meet-people-btn
          @click="openPanel('people')"
        >
          👥 {{ peers.size + 1
          }}<span
            v-if="isHost && knocks.length"
            class="ml-1 rounded-full bg-brand-600 px-1.5 text-xs text-white"
            >{{ knocks.length }}</span
          >
        </button>
        <button
          type="button"
          class="btn bg-secang text-white hover:bg-secang/90"
          data-meet-leave
          @click="leave"
        >
          {{ m.leave }}
        </button>
      </div>
      <p class="text-center text-xs text-ink-3">{{ m.roomNote }}</p>
    </section>

    <!-- Selesai -->
    <section v-else class="card space-y-3 text-center" data-meet-ended :data-reason="endReason">
      <p class="font-display text-2xl">{{ reasonText }}</p>
      <div class="flex flex-wrap justify-center gap-2">
        <button
          v-if="!['denied', 'kicked'].includes(endReason)"
          type="button"
          class="btn btn-primary"
          data-meet-rejoin
          @click="rejoin"
        >
          {{ m.rejoin }}
        </button>
        <button type="button" class="btn" @click="createRoom">{{ m.newBtn }}</button>
      </div>
    </section>

    <p class="text-xs text-ink-3">🔒 {{ m.privacy }}</p>
  </div>
</template>
