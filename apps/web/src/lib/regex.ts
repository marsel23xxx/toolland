export interface RegexMatch {
  index: number;
  text: string;
  groups: (string | undefined)[];
  named?: Record<string, string | undefined>;
}

export interface RegexResult {
  matches: RegexMatch[];
  /** true bila jumlah match dipotong di MAX_MATCHES. */
  truncated: boolean;
  replaced?: string;
}

export const MAX_MATCHES = 1000;

/** Jalankan regex (dipanggil di Worker). Melempar SyntaxError bila pola tidak valid. */
export function runRegex(
  pattern: string,
  flags: string,
  text: string,
  replacement?: string,
): RegexResult {
  const re = new RegExp(pattern, flags);
  const matches: RegexMatch[] = [];
  let truncated = false;

  if (re.global || re.sticky) {
    const global = re.global ? re : new RegExp(pattern, flags + 'g');
    for (const m of text.matchAll(global)) {
      if (matches.length >= MAX_MATCHES) {
        truncated = true;
        break;
      }
      matches.push({
        index: m.index,
        text: m[0],
        groups: m.slice(1),
        named: m.groups && { ...m.groups },
      });
      if (re.sticky && !re.global) break;
    }
  } else {
    const m = re.exec(text);
    if (m)
      matches.push({
        index: m.index,
        text: m[0],
        groups: m.slice(1),
        named: m.groups && { ...m.groups },
      });
  }

  const result: RegexResult = { matches, truncated };
  if (replacement !== undefined) result.replaced = text.replace(re, replacement);
  return result;
}

export interface Segment {
  text: string;
  /** Nomor match (0, 1, ...) atau -1 untuk teks biasa. */
  match: number;
}

/** Pecah teks menjadi potongan biasa dan potongan match untuk ditampilkan tanpa innerHTML. */
export function segmentMatches(text: string, matches: RegexMatch[]): Segment[] {
  const out: Segment[] = [];
  let pos = 0;
  matches.forEach((m, i) => {
    if (m.text.length === 0 || m.index < pos) return;
    if (m.index > pos) out.push({ text: text.slice(pos, m.index), match: -1 });
    out.push({ text: m.text, match: i });
    pos = m.index + m.text.length;
  });
  if (pos < text.length) out.push({ text: text.slice(pos), match: -1 });
  return out;
}
