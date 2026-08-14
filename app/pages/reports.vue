<template>
  <div class="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
    <!-- 1. Header Banner Component -->
    <ReportHeaderBanner 
      :last-updated="screenerStore.lastUpdated" 
      :is-refreshing="screenerStore.isRefreshing"
      @refresh="handleRefreshData"
    />

    <!-- 2. Summary Metrics Cards Component -->
    <ReportSummaryMetrics 
      :total-valuation-amount="portfolioStore.totalValuationAmount"
      :total-pnl-rate="portfolioStore.totalPnlRate"
      :total-pnl-amount="portfolioStore.totalPnlAmount"
      :total-stock-count="screenerStore.newData.length"
      :holdings-count="portfolioHoldingsCount"
      :watchlist-count="watchlistCount"
      :matched-count="screenerStore.matchedCount"
      :average-score="averageQuantScore"
    />

    <!-- 3. Top Recommendations Component -->
    <ReportTopRecommendations 
      :items="screenerStore.topBuyRecommendations"
      @select-stock="selectStockForReport"
    />

    <!-- 4. Claude AI Report Viewer Component -->
    <ReportAiViewer 
      :active-stock="activeStock"
      :selected-shcode="selectedShcode"
      :stock-list="screenerStore.newData"
      :report-text="activeReportText"
      :is-generating="isGenerating"
      :is-copied="isCopied"
      @change-stock="handleStockSelectChange"
      @copy="copyActiveReport"
      @download="downloadActiveReport"
    />

    <!-- 5. All Stocks Matrix Table Component -->
    <ReportMatrixTable 
      :stock-list="screenerStore.newData"
      :active-shcode="selectedShcode"
      @select-stock="selectStockForReport"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useScreenerStore, type StockItem } from '~/stores/useScreenerStore';
import { usePortfolioStore } from '~/stores/usePortfolioStore';
import { useStockDetailStore } from '~/stores/useStockDetailStore';
import { useStockAnalysis, generateBuyFormatReport } from '~/composables/useStockAnalysis';

import ReportHeaderBanner from '~/components/reports/ReportHeaderBanner.vue';
import ReportSummaryMetrics from '~/components/reports/ReportSummaryMetrics.vue';
import ReportTopRecommendations from '~/components/reports/ReportTopRecommendations.vue';
import ReportAiViewer from '~/components/reports/ReportAiViewer.vue';
import ReportMatrixTable from '~/components/reports/ReportMatrixTable.vue';

useHead({
  title: 'AI 퀀트 종합 주식 투자 분석 리포트'
});

const screenerStore = useScreenerStore();
const portfolioStore = usePortfolioStore();
const stockDetailStore = useStockDetailStore();
const { analyzeStockWithClaude } = useStockAnalysis();

const selectedShcode = ref<string>('');
const activeStock = ref<StockItem | null>(null);
const activeReportText = ref<string>('');
const isGenerating = ref(false);
const isCopied = ref(false);

const portfolioHoldingsCount = computed(() => portfolioStore.holdings.length);
const watchlistCount = computed(() => Math.max(screenerStore.newData.length - portfolioHoldingsCount.value, 0));

const averageQuantScore = computed(() => {
  if (!screenerStore.newData || screenerStore.newData.length === 0) return 0;
  const sum = screenerStore.newData.reduce((acc, curr) => acc + (curr.score || 0), 0);
  return Math.round(sum / screenerStore.newData.length);
});

async function handleRefreshData() {
  await portfolioStore.fetchHoldings();
  await screenerStore.refreshScreener();
  const firstStock = screenerStore.newData?.[0];
  if (firstStock && !selectedShcode.value) {
    selectStockForReport(firstStock);
  }
}

async function selectStockForReport(item: StockItem) {
  if (!item) return;
  selectedShcode.value = item.shcode;
  activeStock.value = item;

  // 캐시된 AI 리포트 확인
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

    // Pinia Store 및 LocalStorage 15일 보존 저장
    stockDetailStore.saveAiReport(item.shcode, freshReport);
  } catch (e) {
    console.error('Failed to generate AI report for selected stock:', e);
    activeReportText.value = generateBuyFormatReport(item, null);
  } finally {
    isGenerating.value = false;
  }
}

function handleStockSelectChange(shcode: string) {
  const found = screenerStore.newData.find(s => s.shcode === shcode);
  if (found) {
    selectStockForReport(found);
  }
}

function copyActiveReport() {
  if (!activeReportText.value) return;
  navigator.clipboard.writeText(activeReportText.value);
  isCopied.value = true;
  setTimeout(() => { isCopied.value = false; }, 2000);
}

function downloadActiveReport() {
  if (!activeReportText.value || !activeStock.value) return;
  const filename = `${activeStock.value.name}_종목코드_${activeStock.value.shcode}_AI기술적진단보고서.md`;
  const blob = new Blob([activeReportText.value], { type: 'text/markdown;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

onMounted(async () => {
  stockDetailStore.initFromStorage();
  screenerStore.initFromStorage();
  await portfolioStore.fetchHoldings();

  if (!screenerStore.newData || screenerStore.newData.length === 0) {
    await screenerStore.refreshScreener();
  }

  const firstStock = screenerStore.newData?.[0];
  if (firstStock) {
    selectedShcode.value = firstStock.shcode;
    selectStockForReport(firstStock);
  }
});
</script>