/**
 * CSP situs memakai hash untuk style-src tanpa 'unsafe-inline'. maxGraph menulis gaya label lewat
 * setAttribute('style', …) dan innerHTML berisi style="…" (juga isi label dari file .drawio),
 * yang diblokir browser sehingga label menumpuk di pojok dan console penuh pelanggaran CSP.
 *
 * Penerapan gaya lewat CSSOM (element.style.cssText) diizinkan CSP. Shim ini, hanya dipasang di
 * halaman Editor Diagram, mengalihkan kedua jalur itu ke CSSOM tanpa mengubah hasilnya:
 * - setAttribute('style', v) → element.style.cssText = v
 * - innerHTML berisi "style=" → atribut style di string diganti penanda data-tl-style, HTML diurai
 *   tanpa style inline, lalu gaya diterapkan lewat style.cssText.
 */

import { SvgCanvas2D } from '@maxgraph/core';

let installed = false;

/** Entitas HTML yang mungkin muncul di nilai atribut style. */
function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');
}

function styledTarget(el: Element): el is HTMLElement | SVGElement {
  return 'style' in el;
}

const STYLE_ATTR = /\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

/** Ganti atribut style di HTML dengan penanda data-tl-style; kembalikan HTML dan daftar gaya. */
function stash(html: string): { safe: string; styles: string[] } {
  const styles: string[] = [];
  const safe = html.replace(STYLE_ATTR, (_m, d?: string, q?: string) => {
    styles.push(decodeEntities(d ?? q ?? ''));
    return ` data-tl-style="${styles.length - 1}"`;
  });
  return { safe, styles };
}

/** Terapkan gaya dari penanda lewat CSSOM, lalu hapus penandanya. */
function unstash(root: ParentNode, styles: string[]) {
  for (const el of Array.from(root.querySelectorAll('[data-tl-style]'))) {
    const css = styles[Number(el.getAttribute('data-tl-style'))] ?? '';
    el.removeAttribute('data-tl-style');
    if (styledTarget(el)) el.style.cssText = css;
  }
}

export function installCspSafeDom(): void {
  if (installed || typeof Element === 'undefined') return;
  installed = true;

  const setAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (this: Element, name: string, value: string) {
    if (name.toLowerCase() === 'style' && styledTarget(this)) {
      this.style.cssText = String(value);
      return;
    }
    setAttribute.call(this, name, value);
  };

  const desc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if (!desc?.set || !desc.get) return;
  const nativeSet = desc.set;
  Object.defineProperty(Element.prototype, 'innerHTML', {
    configurable: true,
    enumerable: desc.enumerable,
    get: desc.get,
    set(this: Element, value: string) {
      const html = String(value ?? '');
      // Jalur cepat: tanpa atribut style tidak ada yang perlu dialihkan.
      if (!/\sstyle\s*=/i.test(html)) {
        nativeSet.call(this, html);
        return;
      }
      // Atribut style diganti penanda dulu, supaya parser HTML tidak pernah melihat style inline
      // (dokumen DOMParser ikut mewarisi CSP di Chrome, jadi tidak bisa dipakai di sini).
      const { safe, styles } = stash(html);
      nativeSet.call(this, safe);
      unstash(this, styles);
    },
  });

  const nativeAdjacent = Element.prototype.insertAdjacentHTML;
  Element.prototype.insertAdjacentHTML = function (
    this: Element,
    pos: InsertPosition,
    text: string,
  ) {
    if (!/\sstyle\s*=/i.test(text)) return nativeAdjacent.call(this, pos, text);
    const { safe, styles } = stash(text);
    nativeAdjacent.call(this, pos, safe);
    unstash(this.parentElement ?? this, styles);
  };

  // maxGraph mengubah label HTML ke XHTML lewat DOMParser (melanggar CSP bila ada style); urai
  // lewat elemen biasa (memakai shim innerHTML di atas) lalu serialisasi isinya.
  SvgCanvas2D.prototype.convertHtml = function (val: string): string {
    const div = document.createElement('div');
    div.innerHTML = val;
    const xml = new XMLSerializer().serializeToString(div);
    return xml.replace(/^<div[^>]*>/, '').replace(/<\/div>$/, '');
  };
}
