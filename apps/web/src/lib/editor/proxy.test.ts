import { describe, expect, it } from 'vitest';
import { logSeconds, proxyArgs, suggestProxy } from './proxy';

describe('salinan pratinjau', () => {
  it('argumen ffmpeg: H.264 540p, audio opsional', () => {
    const a = proxyArgs('/pxin/a.mov', '/out.mp4');
    expect(a.join(' ')).toContain("-map 0:v:0 -map 0:a:0? -vf scale=-2:'min(540,ih)'");
    expect(a.join(' ')).toContain('-c:v libx264 -preset ultrafast');
    expect(a.at(-1)).toBe('/out.mp4');
  });

  it('video 4K disarankan memakai pratinjau ringan', () => {
    expect(suggestProxy({ kind: 'video', width: 3840, height: 2160 })).toBe(true);
    expect(suggestProxy({ kind: 'video', width: 2160, height: 3840 })).toBe(true);
    expect(suggestProxy({ kind: 'video', width: 1920, height: 1080 })).toBe(false);
    expect(suggestProxy({ kind: 'image', width: 4000, height: 3000 })).toBe(false);
  });

  it('waktu dari log ffmpeg', () => {
    expect(logSeconds('00:01:02.50')).toBe(62.5);
    expect(logSeconds('tanpa waktu')).toBe(0);
  });
});
