<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in">
    <div class="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl shadow-2xl space-y-4 max-h-[92vh] flex flex-col overflow-hidden p-6">
      
      <!-- Modal Header -->
      <div class="flex items-center justify-between border-b border-slate-800 pb-4 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/40 flex items-center justify-center font-black text-lg">
            <i class="fas fa-chart-line"></i>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-xl font-black text-white">
                {{ stockData?.name || shcode }}
              </h3>
              <span class="text-xs text-slate-400 font-mono">({{ shcode }})</span>
              <span 
                class="px-2.5 py-0.5 rounded text-[11px] font-bold border"
                :class="isHolding ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'"
              >
                {{ isHolding ? '보유종목' : '관심종목' }}
              </span>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">
              LS증권 Open API 실시간 시세 & 8대 기술지표 AI 정밀 진단 모달
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <!-- Quick Action Buttons inside Modal: Add/Toggle Watchlist or Delete via Store Action -->
          <button 
            v-if="!isHolding"
            @click="toggleWatchlistStore" 
            :disabled="isSubmitting"
            class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95"
            :class="isInWatchlist ? 'bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30' : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-500/20'"
          >
            <i class="fas" :class="isInWatchlist ? 'fa-star-half-alt' : 'fa-star'"></i>
            <span>{{ isInWatchlist ? '관심종목 해제' : '관심종목 등록' }}</span>
          </button>

          <button 
            @click="deleteStockStore" 
            :disabled="isSubmitting"
            class="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <i class="fas fa-trash-alt"></i>
            <span>종목 DB 삭제</span>
          </button>

          <button 
            @click="$emit('close')" 
            class="text-slate-400 hover:text-white font-bold text-lg px-3 py-1 rounded-xl hover:bg-slate-800 cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- Modal Body Content -->
      <div class="flex-1 overflow-y-auto pr-1">
        <StockDetailView :shcode="shcode" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import StockDetailView from '~/components/StockDetailView.vue';
import { useLSStockRawStore } from '~/stores/useLSStockRawStore';
import { usePortfolioStore } from '~/stores/usePortfolioStore';
import { useScreenerStore } from '~/stores/useScreenerStore';
import { useGlobalToast } from '~/composables/useGlobalToast';

const props = defineProps<{
  isOpen: boolean;
  shcode: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'updated'): void;
}>();

const rawStore = useLSStockRawStore();
const portfolioStore = usePortfolioStore();
const screenerStore = useScreenerStore();
const toast = useGlobalToast();

const isSubmitting = ref(false);

const stockData = computed(() => {
  if (!props.shcode) return null;
  return rawStore.rawStockMap.get(props.shcode) || null;
});

const isHolding = computed(() => {
  return stockData.value ? (stockData.value.isHolding || stockData.value.type === 'holding') : false;
});

const isInWatchlist = computed(() => {
  return rawStore.watchlistList.some(s => s.shcode === props.shcode || s.shcode === `A${props.shcode}`);
});

// 모달에서 관심종목 토글 ➔ Store action (addStock / deleteStock) 호출하여 Store state 0ms 반영 및 DB 저장
async function toggleWatchlistStore() {
  if (!props.shcode) return;
  isSubmitting.value = true;
  try {
    const cleanCode = props.shcode.replace(/^A/i, '');
    const stockName = stockData.value?.name || cleanCode;
    const stockIndustry = stockData.value?.industry || '주요업종';

    if (isInWatchlist.value) {
      if (!confirm(`정말 ${stockName} (${cleanCode}) 종목을 관심종목에서 삭제하시겠습니까?`)) return;
      // 1. Store action 호출로 Store state 0ms 변경 + DB 삭제
      await rawStore.deleteStock(cleanCode);
      toast.success(`${stockName}(${cleanCode}) 종목이 관심종목에서 해제되었습니다.`, '관심종목 해제');
    } else {
      // 1. Store action 호출로 Store state 0ms 추가 + DB 등록
      await rawStore.addStock({
        shcode: cleanCode,
        name: stockName,
        industry: stockIndustry,
        type: 'watchlist'
      });
      toast.success(`${stockName}(${cleanCode}) 종목이 관심종목으로 등록되었습니다.`, '관심종목 등록 완료');
    }

    portfolioStore.fetchHoldings(true);
    screenerStore.refreshScreener();
    emit('updated');
  } catch (err: any) {
    console.error('Toggle watchlist store error:', err);
    toast.error(err.message || '종목 관심 등록/해제 중 오류가 발생했습니다.', '작업 실패');
  } finally {
    isSubmitting.value = false;
  }
}

// 모달에서 DB 삭제 버튼 ➔ Store action (deleteStock) 호출하여 Store state 0ms 반영 및 SQLite DB 3개 테이블 일괄 삭제
async function deleteStockStore() {
  if (!props.shcode) return;
  const cleanCode = props.shcode.replace(/^A/i, '');
  const stockName = stockData.value?.name || cleanCode;

  if (!confirm(`정말 ${stockName} (${cleanCode}) 종목을 DB에서 삭제하시겠습니까?`)) return;
  isSubmitting.value = true;

  try {
    // 1. Store action (deleteStock) 호출 ➔ Store state 0ms 삭제 + SQLite DB 삭제
    await rawStore.deleteStock(cleanCode);

    toast.success(`${stockName}(${cleanCode}) 종목이 DB에서 완전히 삭제되었습니다.`, '종목 DB 삭제 완료');

    portfolioStore.fetchHoldings(true);
    screenerStore.refreshScreener();
    emit('updated');
    emit('close');
  } catch (err: any) {
    console.error('Delete stock store error:', err);
    toast.error(err.message || '종목 삭제 실패', '삭제 처리 오류');
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.97); }
  to { opacity: 1; transform: scale(1); }
}
</style>
