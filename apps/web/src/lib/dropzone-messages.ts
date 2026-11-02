import type { DropzoneMessages } from '../components/ui/Dropzone.vue';
import { useTranslations, type Locale } from '../i18n';

/** Teks Dropzone per bahasa, disiapkan saat build lalu dikirim ke island sebagai props. */
export function dropzoneMessages(locale: Locale): DropzoneMessages {
  const t = useTranslations(locale);
  return {
    title: t('dropzone.title'),
    hint: t('dropzone.hint'),
    // Placeholder dibiarkan agar diisi oleh komponen.
    maxSize: t('dropzone.maxSize', { size: '{size}' }),
    errorType: t('dropzone.errorType', { name: '{name}' }),
    errorSize: t('dropzone.errorSize', { name: '{name}', size: '{size}' }),
  };
}
