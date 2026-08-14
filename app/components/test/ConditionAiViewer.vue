<template>
  <UCard variant="outline" class="bg-slate-900/90 border-purple-500/40 shadow-2xl space-y-5">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <UBadge color="primary" variant="subtle" class="font-bold text-xs">
            <i class="fas fa-brain mr-1"></i> Claude AI 정밀 진단 리포트
          </UBadge>
          <h3 class="text-lg font-black text-white mt-1">
            📊 {{ activeStock?.name || '종목 선택' }} 정밀 기술적 매수 진단 보고서
          </h3>
        </div>

        <div class="flex items-center gap-2">
          <UButton 
            @click="$emit('copy')" 
            :disabled="!reportText"
            color="neutral"
            variant="soft"
            size="sm"
            class="font-bold shadow-sm active:scale-95"
          >
            <i class="fas" :class="isCopied ? 'fa-check text-emerald-400' : 'fa-copy'"></i>
            <span>{{ isCopied ? '복사 완료!' : '보고서 복사' }}</span>
          </UButton>
          <UButton 
            @click="$emit('download')" 
            :disabled="!reportText"
            color="primary"
            variant="solid"
            size="sm"
            class="font-bold shadow-lg shadow-purple-500/20 active:scale-95"
          >
            <i class="fas fa-download"></i>
            <span>.md 다운로드</span>
          </UButton>
        </div>
      </div>
    </template>

    <div v-if="isGenerating" class="bg-slate-950/80 border border-slate-800 rounded-xl p-12 text-center text-slate-300 space-y-3">
      <i class="fas fa-brain fa-spin text-3xl text-purple-400"></i>
      <p class="text-sm font-bold">LS증권 조건검색 스크리닝 종목에 대해 Anthropic Claude AI가 진단 보고서를 작성 중입니다...</p>
    </div>

    <!-- Rendered Markdown HTML with Styled Tables -->
    <div 
      v-else-if="renderedHtml" 
      class="markdown-body bg-slate-950/90 border border-slate-800 p-6 rounded-xl text-xs text-slate-200 overflow-x-auto leading-relaxed space-y-4"
      v-html="renderedHtml"
    ></div>

    <div v-else class="bg-slate-950/50 border border-slate-800 p-8 rounded-xl text-center text-slate-400 text-xs">
      테이블에서 종목을 선택하시거나 스크리닝이 수행되면 정밀 진단 보고서가 표출됩니다.
    </div>
  </UCard>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { marked } from 'marked';
import type { ConditionStockItem } from './ConditionResultTable.vue';

const props = defineProps<{
  activeStock: ConditionStockItem | null;
  reportText: string;
  isGenerating: boolean;
  isCopied: boolean;
}>();

defineEmits<{
  (e: 'copy'): void;
  (e: 'download'): void;
}>();

const renderedHtml = computed(() => {
  if (!props.reportText) return '';
  try {
    return marked.parse(props.reportText);
  } catch (e) {
    return props.reportText;
  }
});
</script>
