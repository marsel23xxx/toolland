<script setup lang="ts">
/**
 * Editor kode. Awalnya <textarea> biasa (langsung bisa dipakai, ringan), lalu ditingkatkan ke
 * CodeMirror saat pengguna berinteraksi (kursor masuk, fokus, atau tempel). Tidak dimuat saat idle,
 * agar halaman tetap ringan bagi pengunjung yang belum memakai editor.
 */
import type { EditorView } from '@codemirror/view';
import { onBeforeUnmount, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{ label: string; placeholder?: string; language?: 'json' | 'plain' }>(),
  { placeholder: '', language: 'plain' },
);
const model = defineModel<string>({ required: true });

const host = ref<HTMLDivElement>();
const cmHost = ref<HTMLDivElement>();
const textarea = ref<HTMLTextAreaElement>();
const ready = ref(false);
let view: EditorView | undefined;
let setText: ((v: EditorView, t: string) => void) | undefined;
let started = false;

async function upgrade() {
  if (started || !cmHost.value) return;
  started = true;
  const cm = await import('../../lib/codemirror');
  if (!cmHost.value) return;
  const hadFocus = document.activeElement === textarea.value;
  const cursor = textarea.value?.selectionStart ?? 0;
  setText = cm.setEditorText;
  view = cm.createEditor(cmHost.value, {
    doc: model.value,
    language: props.language,
    placeholder: props.placeholder,
    label: props.label,
    onChange: (v) => (model.value = v),
  });
  ready.value = true;
  if (hadFocus) {
    view.focus();
    view.dispatch({ selection: { anchor: Math.min(cursor, view.state.doc.length) } });
  }
}

watch(model, (v) => {
  if (view && setText) setText(view, v);
});

onBeforeUnmount(() => {
  view?.destroy();
});
</script>

<template>
  <div
    ref="host"
    class="field h-80 overflow-hidden p-0 sm:h-[28rem]"
    @pointerenter="upgrade"
    @focusin="upgrade"
  >
    <div ref="cmHost" class="h-full" :class="{ hidden: !ready }" />
    <textarea
      v-if="!ready"
      ref="textarea"
      v-model="model"
      class="h-full w-full resize-none bg-transparent p-3 font-mono text-sm focus:outline-none"
      :placeholder="placeholder"
      :aria-label="label"
      spellcheck="false"
    />
  </div>
</template>
