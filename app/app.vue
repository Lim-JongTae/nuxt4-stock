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

useSeoMeta({
  title: 'Stock AI Portal - LS증권 연동 실시간 주식 포털',
  description: 'LS증권 Open API & Anthropic Claude AI 연동 퀀트 스크리너 및 주식 투자 포털',
  ogTitle: 'Stock AI Portal - LS증권 연동 실시간 주식 포털',
  ogDescription: 'LS증권 Open API & Anthropic Claude AI 연동 퀀트 스크리너 및 주식 투자 포털',
  ogImage: '/icon.png',
  twitterCard: 'summary_large_image',
  twitterTitle: 'Stock AI Portal - LS증권 연동 실시간 주식 포털',
  twitterDescription: 'LS증권 Open API & Anthropic Claude AI 연동 퀀트 스크리너 및 주식 투자 포털',
  twitterImage: '/icon.png'
});
</script>
