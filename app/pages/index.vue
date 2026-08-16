<template>
  <DashboardView />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import DashboardView from '~/components/DashboardView.vue';
import { useLSStockRawStore } from '~/stores/useLSStockRawStore';

const rawStore = useLSStockRawStore();

onMounted(async () => {
  await rawStore.fetchRawStockData(false);

  // 삼성전자 (005930) 공매도 RAW 수집 데이터 콘솔 출력
  const samsung = rawStore.rawStockList.find(s => s.shcode === '005930' || s.shcode === 'A005930');

  console.log('📊 [useLSStockRawStore State Check]:', {
    lastUpdated: rawStore.lastUpdated,
    sourceProvider: rawStore.sourceProvider,
    rawStockListCount: rawStore.rawStockList.length,
    rawStockList: rawStore.rawStockList,
    marketBasis: rawStore.marketBasis,
    topSectors: rawStore.topSectors,
    bottomSectors: rawStore.bottomSectors,
    cachedTimestamp: rawStore.cachedTimestamp,
    isLoading: rawStore.isLoading,
    errorMessage: rawStore.errorMessage
  });

  if (samsung) {
    console.log('📉 [삼성전자(005930) LS증권 t1927 공매도 원천 Raw Data]:', {
      shcode: samsung.shcode,
      name: samsung.name,
      closePrice: samsung.closePrice,
      shortSellHistoryCount: samsung.shortSellHistory?.length || 0,
      shortSellHistory: samsung.shortSellHistory,
      shortSellingStatus: samsung.shortSellingStatus,
      rawItem: samsung
    });
  } else {
    console.log('⚠️ [삼성전자(005930) Raw Data 수집 대기 중]: rawStockList 목록을 확인해 주세요.');
  }
});
</script>
