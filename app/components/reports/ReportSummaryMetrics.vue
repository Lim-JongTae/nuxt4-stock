<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <!-- Portfolio Valuation Amount Card -->
    <div class="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-1 shadow-lg">
      <div class="flex items-center justify-between text-xs text-slate-400">
        <span>포트폴리오 총 평가금액</span>
        <i class="fas fa-wallet text-purple-400"></i>
      </div>
      <div class="text-2xl font-extrabold text-white font-mono">
        {{ formatKrw(totalValuationAmount) }}
      </div>
      <div class="text-[11px]" :class="(totalPnlRate || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'">
        누적 손익률: {{ (totalPnlRate || 0) >= 0 ? '+' : '' }}{{ (totalPnlRate || 0).toFixed(2) }}% ({{ formatKrw(totalPnlAmount || 0) }})
      </div>
    </div>

    <!-- Total Stock Count Card -->
    <div class="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-1 shadow-lg">
      <div class="flex items-center justify-between text-xs text-slate-400">
        <span>분석 대상 종목 수</span>
        <i class="fas fa-list text-cyan-400"></i>
      </div>
      <div class="text-2xl font-extrabold text-cyan-300 font-mono">
        {{ totalStockCount }}개 종목
      </div>
      <div class="text-[11px] text-slate-400">
        보유종목 {{ holdingsCount }}개 / 관심종목 {{ watchlistCount }}개
      </div>
    </div>

    <!-- 100% Matched Stock Count Card -->
    <div class="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-1 shadow-lg">
      <div class="flex items-center justify-between text-xs text-slate-400">
        <span>8대 지표 100점 완벽 충족</span>
        <i class="fas fa-check-circle text-emerald-400"></i>
      </div>
      <div class="text-2xl font-extrabold text-emerald-400 font-mono">
        {{ matchedCount }}개 종목
      </div>
      <div class="text-[11px] text-slate-400">
        심리선, RSI, MACD, 이평선, 볼린저 하단 동시 만족
      </div>
    </div>

    <!-- Average Quant Score Card -->
    <div class="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-1 shadow-lg">
      <div class="flex items-center justify-between text-xs text-slate-400">
        <span>퀀트 스코어 평균</span>
        <i class="fas fa-star text-amber-400"></i>
      </div>
      <div class="text-2xl font-extrabold text-amber-300 font-mono">
        {{ averageScore }}점 / 100점
      </div>
      <div class="text-[11px] text-slate-400">
        전 종목 기술적 퀀트 배점 평균
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  totalValuationAmount: number;
  totalPnlRate: number;
  totalPnlAmount: number;
  totalStockCount: number;
  holdingsCount: number;
  watchlistCount: number;
  matchedCount: number;
  averageScore: number;
}>();

function formatKrw(val: number) {
  if (val === null || val === undefined || isNaN(val)) return '0원';
  return Number(val).toLocaleString() + '원';
}
</script>
