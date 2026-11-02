import type { DropzoneMessages } from '../components/ui/Dropzone.vue';
import { messages, type Locale } from '../i18n';

/** Teks Dropzone per bahasa, disiapkan saat build lalu dikirim ke island sebagai props. */
export function dropzoneMessages(locale: Locale): DropzoneMessages {
  return messages(locale, 'dropzone');
}
