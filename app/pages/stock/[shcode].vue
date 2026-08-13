<template>
  <div>
    <StockDetailView :shcode="shcode" />
  </div>
</template>

<script setup lang="ts">
import StockDetailView from '~/components/StockDetailView.vue';

const route = useRoute();
const shcode = computed(() => (route.params.shcode as string) || '');

useHead({
  title: `종목 상세 정밀 분석 - ${shcode.value}`
});
</script>
