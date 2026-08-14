<template>
  <UCard variant="outline" class="bg-gradient-to-r from-slate-900 via-purple-950/50 to-slate-900 border-purple-500/40 shadow-2xl relative overflow-hidden">
    <div class="absolute -right-10 -bottom-10 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-2">
          <UBadge color="warning" variant="subtle" class="font-bold text-xs">
            <i class="fas fa-flask mr-1"></i> LS증권 HTS 연동 테스트 전용 모듈
          </UBadge>
          <UBadge color="primary" variant="subtle" class="font-bold text-xs">
            전략명: 8대지표_과매도반등_퀀트
          </UBadge>
        </div>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          LS증권 서버저장 조건검색 실시간 스크리너 테스트 (Nuxt UI)
        </h1>
        <p class="text-xs text-slate-400 mt-1">
          LS증권 HTS에 저장된 <strong class="text-amber-300">8대지표_과매도반등_퀀트</strong> 조건식(t1866/t1859)으로 코스피/코스닥 전 종목을 스크리닝하고, 2차 퀀트 및 공매도 수급을 검증합니다.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <UButton 
          @click="$emit('run-search')" 
          :loading="isLoading"
          color="emerald"
          variant="solid"
          size="lg"
          class="font-extrabold text-xs shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
        >
          <i class="fas" :class="isLoading ? 'fa-spinner fa-spin' : 'fa-search'"></i>
          <span>{{ isLoading ? 'LS증권 조건검색 스크리닝 중...' : '🔍 8대지표_과매도반등_퀀트 조건검색 실행' }}</span>
        </UButton>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
defineProps<{
  isLoading: boolean;
}>();

defineEmits<{
  (e: 'run-search'): void;
}>();
</script>
