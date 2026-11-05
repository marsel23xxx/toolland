<script setup lang="ts">
/** Base64 teks, URL encode, dan gambar ke Base64 dalam satu halaman. */
import { defineAsyncComponent } from 'vue';
import type { Messages } from '../../i18n';
import type { DropzoneMessages } from '../ui/Dropzone.vue';
import ToolTabs from '../ui/ToolTabs.vue';
import Base64Tool from './Base64Tool.vue';

// Tab lain baru dimuat saat dibuka.
const UrlEncodeTool = defineAsyncComponent(() => import('./UrlEncodeTool.vue'));
const ImageToBase64 = defineAsyncComponent(() => import('./ImageToBase64.vue'));

defineProps<{
  tabs: Messages<'encode'>;
  base64: Record<string, string>;
  url: Record<string, string>;
  image: Messages<'image'>;
  imageText: Messages<'base64img'> & Messages<'common'>;
  dropzone: DropzoneMessages;
}>();
</script>

<template>
  <ToolTabs
    :label="tabs.tabText"
    :tabs="[
      { id: 'text', label: tabs.tabText },
      { id: 'url', label: tabs.tabUrl },
      { id: 'image', label: tabs.tabImage },
    ]"
  >
    <template #default="{ active }">
      <Base64Tool v-if="active === 'text'" :m="base64" />
      <UrlEncodeTool v-else-if="active === 'url'" :m="url" />
      <ImageToBase64 v-else :m="image" :dropzone="dropzone" :t="imageText" />
    </template>
  </ToolTabs>
</template>
