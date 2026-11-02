import { messages, type Locale } from '../../i18n';

/** Props teks bersama untuk semua tools gambar: daftar file, dropzone, dan kartu donasi. */
export function imageToolProps(locale: Locale) {
  return {
    m: messages(locale, 'image'),
    dropzone: messages(locale, 'dropzone'),
    donate: messages(locale, 'donate'),
  };
}
