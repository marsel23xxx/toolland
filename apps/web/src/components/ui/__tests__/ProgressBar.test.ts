import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ProgressBar from '../ProgressBar.vue';

describe('ProgressBar', () => {
  it('menampilkan persen yang dibulatkan dan dibatasi 0-100', () => {
    const wrapper = mount(ProgressBar, { props: { label: 'a.png', value: 142.7 } });
    expect(wrapper.text()).toContain('100%');
    expect(wrapper.get('progress').element.value).toBe(100);
  });

  it('menampilkan detail seperti estimasi waktu', () => {
    const wrapper = mount(ProgressBar, {
      props: { label: 'a.png', value: 40, detail: '± 5 detik' },
    });
    expect(wrapper.text()).toContain('± 5 detik · 40%');
  });

  it('mode tak tentu bila value kosong', () => {
    const wrapper = mount(ProgressBar, { props: { label: 'Memuat' } });
    expect(wrapper.get('progress').attributes('value')).toBeUndefined();
    expect(wrapper.text()).not.toContain('%');
  });
});
