/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

// Memakai konfigurasi Vite yang sama dengan Astro (plugin Vue, ikon, dll).
export default getViteConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
