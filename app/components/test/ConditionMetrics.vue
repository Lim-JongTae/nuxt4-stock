<template>
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <UCard variant="subtle" class="bg-slate-900/80 border-slate-800 space-y-1 shadow-lg">
      <div class="flex items-center justify-between text-xs text-slate-400">
        <span>조건검색 실시간 발굴 종목 수</span>
        <i class="fas fa-radar text-emerald-400"></i>
      </div>
      <div class="text-2xl font-extrabold text-emerald-400 font-mono">
        {{ totalFound }}개 종목
      </div>
      <div class="text-[11px] text-slate-400">
        LS증권 t1859 실시간 추출 종목
      </div>
    </UCard>

    <UCard variant="subtle" class="bg-slate-900/80 border-slate-800 space-y-1 shadow-lg">
      <div class="flex items-center justify-between text-xs text-slate-400">
        <span>8대 지표 100% 완벽 충족</span>
        <i class="fas fa-check-double text-purple-400"></i>
      </div>
      <div class="text-2xl font-extrabold text-purple-300 font-mono">
        {{ fullyMatchedCount }}개 종목
      </div>
      <div class="text-[11px] text-slate-400">
        퀀트 스코어 85점 이상 선별 종목
      </div>
    </UCard>

    <UCard variant="subtle" class="bg-slate-900/80 border-slate-800 space-y-1 shadow-lg">
      <div class="flex items-center justify-between text-xs text-slate-400">
        <span>발굴 종목 평균 퀀트 점수</span>
        <i class="fas fa-star text-amber-400"></i>
      </div>
      <div class="text-2xl font-extrabold text-amber-300 font-mono">
        {{ averageScore }}점 / 100점
      </div>
      <div class="text-[11px] text-slate-400">
        8대 지표 + 공매도 수급 통합 배점
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  totalFound: number;
  fullyMatchedCount: number;
  averageScore: number;
}>();
</script>
