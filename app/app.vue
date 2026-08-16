<template>
  <UApp>
    <GlobalToastContainer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
import GlobalToastContainer from '~/components/GlobalToastContainer.vue';
</script>
