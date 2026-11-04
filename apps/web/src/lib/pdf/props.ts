import { messages, type Locale } from '../../i18n';

/** Props teks bersama untuk semua tools PDF. */
export function pdfToolProps(locale: Locale) {
  return {
    t: messages(locale, 'pdf'),
    files: messages(locale, 'files'),
    dropzone: messages(locale, 'dropzone'),
    donate: messages(locale, 'donate'),
  };
}
