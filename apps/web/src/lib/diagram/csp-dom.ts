/**
 * CSP situs memakai hash untuk style-src tanpa 'unsafe-inline'. maxGraph menulis gaya label lewat
 * setAttribute('style', …) dan innerHTML berisi style="…" (juga isi label dari file .drawio),
 * yang diblokir browser sehingga label menumpuk di pojok dan console penuh pelanggaran CSP.
 *
 * Penerapan gaya lewat CSSOM (element.style.cssText) diizinkan CSP. Shim ini, hanya dipasang di
 * halaman Editor Diagram, mengalihkan kedua jalur itu ke CSSOM tanpa mengubah hasilnya:
 * - setAttribute('style', v) → element.style.cssText = v
 * - innerHTML berisi "style=" → diurai di dokumen DOMParser (tanpa CSP), atribut style dilepas,
 *   node dipindah ke elemen tujuan, lalu gaya diterapkan lewat style.cssText.
 */

let installed = false;

function styledTarget(el: Element): el is HTMLElement | SVGElement {
  return 'style' in el;
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
      if (!/\sstyle\s*=/i.test(html) || this.namespaceURI !== 'http://www.w3.org/1999/xhtml') {
        nativeSet.call(this, html);
        return;
      }
      const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}`, 'text/html');
      const styled: [Element, string][] = [];
      for (const el of Array.from(doc.body.querySelectorAll('[style]'))) {
        styled.push([el, el.getAttribute('style') ?? '']);
        el.removeAttribute('style');
      }
      nativeSet.call(this, '');
      this.append(...Array.from(doc.body.childNodes));
      for (const [el, css] of styled) if (styledTarget(el)) el.style.cssText = css;
    },
  });
}
