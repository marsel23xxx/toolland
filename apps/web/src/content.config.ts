import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { CATEGORY_IDS } from './lib/categories';

/**
 * Konten SEO per tool, satu file Markdown per tool per bahasa:
 * src/content/tools/<bahasa>/<slug>.md  ->  id entri "<bahasa>/<slug>"
 */
const tools = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/tools' }),
  schema: z.object({
    /** Nama pendek untuk kartu dan link. */
    name: z.string(),
    /** Judul halaman (<h1> dan <title>). */
    title: z.string(),
    /** Meta description. */
    description: z.string().max(170),
    /** Satu kalimat untuk kartu di beranda. */
    summary: z.string(),
    category: z.enum(CATEGORY_IDS),
    processing: z.enum(['browser', 'server']).default('browser'),
    /** Kata tambahan untuk pencarian di beranda. */
    keywords: z.array(z.string()).default([]),
    /** Cara pakai, tepat 3 langkah. */
    howTo: z.array(z.string()).length(3),
    /** FAQ 4 sampai 6 pertanyaan. */
    faq: z
      .array(z.object({ q: z.string(), a: z.string() }))
      .min(4)
      .max(6),
    /** Slug tools terkait (dalam bahasa yang sama). */
    related: z.array(z.string()).default([]),
    /** Tampil di deretan "Paling sering dipakai" di beranda. */
    popular: z.boolean().default(false),
    /** Kelompok di beranda, misalnya semua konverter format gambar dalam satu baris. */
    group: z.enum(['konversi']).optional(),
    /** Khusus konten non-Indonesia: slug halaman Indonesia yang sama (untuk hreflang). */
    idSlug: z.string().optional(),
  }),
});

export const collections = { tools };
