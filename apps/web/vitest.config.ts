/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

// Memakai konfigurasi Vite yang sama dengan Astro (plugin Vue, ikon, dll).
export default getViteConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    // Tes template membuat workbook Excel utuh (ribuan baris rumus); saat berjalan paralel bisa
    // lebih dari 5 detik.
    testTimeout: 30_000,
  },
});
