<template>
  <UContainer class="space-y-6 max-w-7xl mx-auto py-6">
    <!-- Header Component (Nuxt UI) -->
    <ConditionHeader 
      :is-loading="isLoading" 
      @run-search="runConditionSearch"
    />

    <!-- Metrics Component (Nuxt UI) -->
    <ConditionMetrics 
      :total-found="stockList.length"
      :fully-matched-count="fullyMatchedCount"
      :average-score="averageScore"
    />

    <!-- Result Matrix Table Component (Nuxt UI) -->
    <ConditionResultTable 
      :items="stockList"
      :active-shcode="selectedShcode"
      @select-stock="selectStock"
    />

    <!-- AI Report Viewer Component (Nuxt UI) -->
    <ConditionAiViewer 
      :active-stock="activeStock"
      :report-text="activeReportText"
      :is-generating="isGenerating"
      :is-copied="isCopied"
      @copy="copyReport"
      @download="downloadReport"
    />
  </UContainer>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import ConditionHeader from '~/components/test/ConditionHeader.vue';
import ConditionMetrics from '~/components/test/ConditionMetrics.vue';
import ConditionResultTable, { type ConditionStockItem } from '~/components/test/ConditionResultTable.vue';
import ConditionAiViewer from '~/components/test/ConditionAiViewer.vue';
import { useStockAnalysis, generateBuyFormatReport } from '~/composables/useStockAnalysis';
import { useStockDetailStore } from '~/stores/useStockDetailStore';

useHead({
  title: 'LS증권 8대지표_과매도반등_퀀트 Nuxt UI 테스트 대시보드'
});

const stockDetailStore = useStockDetailStore();
const { analyzeStockWithClaude } = useStockAnalysis();

const isLoading = ref(false);
const isGenerating = ref(false);
const isCopied = ref(false);
const stockList = ref<ConditionStockItem[]>([]);
const selectedShcode = ref<string>('');
const activeStock = ref<ConditionStockItem | null>(null);
const activeReportText = ref<string>('');

const fullyMatchedCount = computed(() => {
  return stockList.value.filter(s => s.score >= 85).length;
});

const averageScore = computed(() => {
  if (stockList.value.length === 0) return 0;
  const sum = stockList.value.reduce((acc, curr) => acc + curr.score, 0);
  return Math.round(sum / stockList.value.length);
});

async function runConditionSearch() {
  isLoading.value = true;
  try {
    const res = await $fetch<{ success: boolean; totalFound: number; data: ConditionStockItem[] }>('/api/screener/condition-search');
    if (res && res.success && Array.isArray(res.data)) {
      stockList.value = res.data;
      if (res.data.length > 0) {
        selectStock(res.data[0]);
      }
    }
  } catch (err) {
    console.error('Condition search error:', err);
  } finally {
    isLoading.value = false;
  }
}

async function selectStock(item: ConditionStockItem) {
  if (!item) return;
  selectedShcode.value = item.shcode;
  activeStock.value = item;

  const cached = stockDetailStore.getStockCache(item.shcode);
  if (cached && cached.generatedReport) {
    activeReportText.value = cached.generatedReport;
    return;
  }

  isGenerating.value = true;
  activeReportText.value = '';

  try {
    const aiResult = await analyzeStockWithClaude(item as any);
    const freshReport = generateBuyFormatReport(item, aiResult);
    activeReportText.value = freshReport;
    stockDetailStore.saveAiReport(item.shcode, freshReport);
  } catch (e) {
    console.error('AI report error:', e);
    activeReportText.value = generateBuyFormatReport(item, null);
  } finally {
    isGenerating.value = false;
  }
}

function copyReport() {
  if (!activeReportText.value) return;
  navigator.clipboard.writeText(activeReportText.value);
  isCopied.value = true;
  setTimeout(() => { isCopied.value = false; }, 2000);
}

function downloadReport() {
  if (!activeReportText.value || !activeStock.value) return;
  const filename = `${activeStock.value.name}_종목코드_${activeStock.value.shcode}_조건검색_AI진단보고서.md`;
  const blob = new Blob([activeReportText.value], { type: 'text/markdown;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

onMounted(() => {
  stockDetailStore.initFromStorage();
  runConditionSearch();
});
</script>
