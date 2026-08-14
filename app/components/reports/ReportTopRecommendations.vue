<template>
  <div v-if="items && items.length" class="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
    <div class="flex items-center justify-between border-b border-slate-800 pb-3">
      <h3 class="text-base font-bold text-white flex items-center gap-2">
        <i class="fas fa-trophy text-amber-400"></i>
        <span>🏆 8대 기술적 지표 퀀트 점수 TOP 3 매수 유망 종목</span>
      </h3>
      <span class="text-xs text-slate-400">LS증권 t8413 실시간 파싱 수치 기준</span>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div 
        v-for="(item, idx) in items" 
        :key="item.shcode"
        @click="$emit('select-stock', item)"
        class="bg-slate-950/80 border border-slate-800 hover:border-purple-500/60 p-4 rounded-xl space-y-3 cursor-pointer transition-all hover:scale-[1.01] group"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-amber-400">#{{ idx + 1 }} {{ item.name }}</span>
          <span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/40">
            {{ item.score }}점 / 100점
          </span>
        </div>

        <div class="flex items-baseline justify-between font-mono">
          <span class="text-xs text-slate-400">{{ item.shcode }}</span>
          <span class="text-lg font-black text-emerald-400">{{ Number(item.closePrice).toLocaleString() }}원</span>
        </div>

        <div class="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
          <div>심리선: <strong class="text-slate-200">{{ item.psy ?? '-' }}%</strong></div>
          <div>RSI(14): <strong class="text-slate-200">{{ item.rsi ?? '-' }}</strong></div>
          <div>MACD: <strong class="text-slate-200">{{ item.macdHist ?? '양전' }}</strong></div>
          <div>거래량비율: <strong class="text-amber-400">{{ item.volumeRatio ?? '-' }}%</strong></div>
        </div>

        <div class="text-right text-xs text-purple-400 font-bold group-hover:underline flex items-center justify-end gap-1">
          <span>AI 상세 보고서 열람</span>
          <i class="fas fa-arrow-right text-[10px]"></i>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { StockItem } from '~/stores/useScreenerStore';

defineProps<{
  items: StockItem[];
}>();

defineEmits<{
  (e: 'select-stock', item: StockItem): void;
}>();
</script>
