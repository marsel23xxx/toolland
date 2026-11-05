<script setup lang="ts">
/** Ubah ukuran (banyak file) dan potong gambar (satu file) dalam satu halaman. */
import { defineAsyncComponent } from 'vue';
import type { Messages } from '../../i18n';
import type { DropzoneMessages } from '../ui/Dropzone.vue';
import ToolTabs from '../ui/ToolTabs.vue';
import ImageResizer from './ImageResizer.vue';

const ImageCropper = defineAsyncComponent(() => import('./ImageCropper.vue'));

defineProps<{
  m: Messages<'image'>;
  dropzone: DropzoneMessages;
  donate: Messages<'donate'>;
  t: Messages<'resize'>;
  crop: Messages<'crop'>;
}>();
</script>

<template>
  <ToolTabs
    :label="t.tabResize"
    :tabs="[
      { id: 'resize', label: t.tabResize },
      { id: 'crop', label: t.tabCrop },
    ]"
  >
    <template #default="{ active }">
      <ImageResizer
        v-if="active === 'resize'"
        :m="m"
        :dropzone="dropzone"
        :donate="donate"
        :t="t"
      />
      <ImageCropper v-else :m="m" :dropzone="dropzone" :donate="donate" :t="crop" mode="crop" />
    </template>
  </ToolTabs>
</template>
