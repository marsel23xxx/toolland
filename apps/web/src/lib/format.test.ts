import { describe, expect, it } from 'vitest';
import { fill, formatBytes } from './format';

describe('formatBytes', () => {
  it('memakai koma desimal untuk bahasa Indonesia', () => {
    expect(formatBytes(4.2 * 1024 * 1024, 'id')).toBe('4,2 MB');
  });
  it('memakai titik desimal untuk bahasa Inggris', () => {
    expect(formatBytes(1.5 * 1024, 'en')).toBe('1.5 KB');
  });
  it('tanpa desimal untuk byte', () => {
    expect(formatBytes(512)).toBe('512 B');
  });
});

describe('fill', () => {
  it('mengganti placeholder', () => {
    expect(fill('{name} ({size})', { name: 'a.png', size: '1 MB' })).toBe('a.png (1 MB)');
  });
});
