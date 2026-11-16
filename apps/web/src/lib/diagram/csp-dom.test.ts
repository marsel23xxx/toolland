import { describe, expect, it } from 'vitest';
import { installCspSafeDom } from './csp-dom';

describe('shim gaya ramah CSP', () => {
  installCspSafeDom();

  it('setAttribute style diterapkan lewat CSSOM', () => {
    const div = document.createElement('div');
    div.setAttribute('style', 'margin-left: 12px; padding-top: 4px');
    expect(div.style.marginLeft).toBe('12px');
    expect(div.style.paddingTop).toBe('4px');
    div.setAttribute('title', 'tetap biasa');
    expect(div.getAttribute('title')).toBe('tetap biasa');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    svg.setAttribute('style', 'stop-color: red');
    expect(svg.getAttribute('style')).toContain('stop-color');
  });

  it('innerHTML berisi style tetap mempertahankan gaya', () => {
    const host = document.createElement('div');
    host.innerHTML = 'Sensor <span style="color: red; font-weight: bold">DHT22</span><br>ok';
    const span = host.querySelector('span')!;
    expect(span.textContent).toBe('DHT22');
    expect(span.style.color).toBe('red');
    expect(span.style.fontWeight).toBe('bold');
    expect(host.innerHTML).toContain('<br>');
    host.innerHTML = 'tanpa gaya';
    expect(host.textContent).toBe('tanpa gaya');
  });
});
