import { messages, type Locale } from '../../i18n';

/** Props teks bersama untuk semua tools media. */
export function mediaToolProps(locale: Locale) {
  return {
    m: messages(locale, 'media'),
    files: messages(locale, 'files'),
    dropzone: messages(locale, 'dropzone'),
    donate: messages(locale, 'donate'),
  };
}
