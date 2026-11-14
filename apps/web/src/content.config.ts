import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { CATEGORY_IDS, GROUP_IDS } from './lib/categories';
import { TEMPLATE_CATEGORY_IDS, TEMPLATE_FORMATS } from './lib/templates/catalog';

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
    /** Kelompok di beranda dan navbar, misalnya semua konverter format atau semua tes. */
    group: z.enum(GROUP_IDS).optional(),
    /** Khusus konten non-Indonesia: slug halaman Indonesia yang sama (untuk hreflang). */
    idSlug: z.string().optional(),
  }),
});

/**
 * Konten per template: src/content/templates/<bahasa>/<slug>.md
 * File-nya (Excel, atau PDF dan Word untuk dokumen) dibuat di browser oleh
 * src/lib/templates/<template>.ts.
 */
const templates = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/templates' }),
  schema: z.object({
    name: z.string(),
    title: z.string(),
    description: z.string().max(170),
    summary: z.string(),
    category: z.enum(TEMPLATE_CATEGORY_IDS),
    format: z.enum(TEMPLATE_FORMATS).default('excel'),
    keywords: z.array(z.string()).default([]),
    /** Excel: sheet di dalam file, berurutan seperti tab. Dokumen: bagian-bagian dokumen. */
    sheets: z.array(z.object({ name: z.string(), desc: z.string() })).min(2),
    /** Fitur unggulan untuk daftar centang di halaman template. */
    features: z.array(z.string()).min(3).max(8),
    /** Gambar pratinjau: src/assets/templates/<slug Indonesia>/<bahasa>-<nama>.png */
    previews: z.array(z.object({ file: z.string(), caption: z.string() })).default([]),
    howTo: z.array(z.string()).length(3),
    faq: z
      .array(z.object({ q: z.string(), a: z.string() }))
      .min(4)
      .max(6),
    idSlug: z.string().optional(),
  }),
});

export const collections = { tools, templates };
