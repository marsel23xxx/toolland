import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import Dropzone, { type DropzoneMessages } from '../Dropzone.vue';

const messages: DropzoneMessages = {
  title: 'Pilih file',
  hint: 'Atau tempel',
  maxSize: 'Maksimal {size}',
  errorType: '{name}: format tidak didukung',
  errorSize: '{name}: terlalu besar ({size})',
};

function file(name: string, type: string, size = 10): File {
  return new File([new Uint8Array(size)], name, { type });
}

function drop(wrapper: ReturnType<typeof mount>, files: File[]) {
  return wrapper.get('[data-testid="dropzone"]').trigger('drop', { dataTransfer: { files } });
}

describe('Dropzone', () => {
  it('meneruskan file yang valid lewat event files', async () => {
    const wrapper = mount(Dropzone, { props: { messages, accept: 'image/*' } });
    const png = file('a.png', 'image/png');
    await drop(wrapper, [png]);
    expect(wrapper.emitted('files')).toEqual([[[png]]]);
  });

  it('menolak tipe yang tidak cocok dengan accept', async () => {
    const wrapper = mount(Dropzone, { props: { messages, accept: 'image/*,.heic' } });
    await drop(wrapper, [file('doc.pdf', 'application/pdf'), file('foto.HEIC', '')]);
    expect(wrapper.emitted('rejected')).toEqual([[['doc.pdf: format tidak didukung']]]);
    expect((wrapper.emitted('files')![0][0] as File[])[0].name).toBe('foto.HEIC');
    expect(wrapper.get('[data-testid="dropzone-errors"]').text()).toContain('doc.pdf');
  });

  it('menolak file di atas batas ukuran', async () => {
    const wrapper = mount(Dropzone, { props: { messages, maxSize: 1024 } });
    await drop(wrapper, [file('besar.png', 'image/png', 2048)]);
    expect(wrapper.emitted('files')).toBeUndefined();
    expect(wrapper.emitted('rejected')).toEqual([[['besar.png: terlalu besar (1 KB)']]]);
  });

  it('hanya mengambil satu file bila multiple=false', async () => {
    const wrapper = mount(Dropzone, { props: { messages, multiple: false } });
    await drop(wrapper, [file('a.txt', 'text/plain'), file('b.txt', 'text/plain')]);
    expect(wrapper.emitted('files')![0][0]).toHaveLength(1);
  });

  it('mengabaikan file saat disabled', async () => {
    const wrapper = mount(Dropzone, { props: { messages, disabled: true } });
    await drop(wrapper, [file('a.txt', 'text/plain')]);
    expect(wrapper.emitted('files')).toBeUndefined();
  });

  it('memancarkan prefetch hanya sekali', async () => {
    const wrapper = mount(Dropzone, { props: { messages } });
    const zone = wrapper.get('[data-testid="dropzone"]');
    await zone.trigger('pointerenter');
    await zone.trigger('focusin');
    expect(wrapper.emitted('prefetch')).toHaveLength(1);
  });

  it('menerima file dari paste clipboard', async () => {
    const wrapper = mount(Dropzone, { props: { messages }, attachTo: document.body });
    const png = file('clip.png', 'image/png');
    const event = new Event('paste', { cancelable: true }) as ClipboardEvent;
    Object.defineProperty(event, 'clipboardData', { value: { files: [png] } });
    window.dispatchEvent(event);
    expect(wrapper.emitted('files')).toEqual([[[png]]]);
    wrapper.unmount();
  });
});
