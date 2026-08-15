<template>
  <UCard variant="outline" class="bg-slate-900/90 border-purple-500/40 shadow-2xl space-y-5">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <UBadge color="primary" variant="subtle" class="font-bold text-xs">
            <i class="fas fa-file-contract mr-1"></i> Claude AI 정밀 리포트 뷰어
          </UBadge>
          <h3 class="text-lg font-black text-white mt-1 flex items-center gap-2">
            <span>📊 {{ activeStock?.name || '종목 선택' }} 정밀 매수/매도 진단 보고서</span>
          </h3>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <label class="text-xs text-slate-300 font-bold">진단 종목 선택:</label>
          <select 
            :value="selectedShcode" 
            @change="$emit('change-stock', ($event.target as HTMLSelectElement).value)"
            class="bg-slate-950 text-xs text-white border border-slate-700 px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 hover:cursor-pointer cursor-pointer font-bold"
          >
            <option v-for="s in stockList" :key="s.shcode" :value="s.shcode">
              {{ s.name }} ({{ s.shcode }}) - {{ s.score }}점
            </option>
          </select>

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

    <!-- Content Area -->
    <div v-if="isGenerating" class="bg-slate-950/80 border border-slate-800 rounded-xl p-12 text-center text-slate-300 space-y-3">
      <i class="fas fa-brain fa-spin text-3xl text-purple-400"></i>
      <p class="text-sm font-bold">Anthropic Claude AI가 LS증권 수급 데이터 및 8대 지표로 정밀 분석 보고서를 작성 중입니다...</p>
    </div>

    <!-- Rendered Markdown HTML with Styled Tables -->
    <div 
      v-else-if="renderedHtml" 
      class="markdown-body bg-slate-950/90 border border-slate-800 p-6 rounded-xl text-xs text-slate-200 overflow-x-auto leading-relaxed space-y-4"
      v-html="renderedHtml"
    ></div>

    <div v-else class="bg-slate-950/50 border border-slate-800 p-8 rounded-xl text-center text-slate-400 text-xs">
      상단에서 종목을 선택하시면 Anthropic Claude AI 정밀 매수/매도 진단 보고서가 실시간 생성됩니다.
    </div>
  </UCard>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { marked } from 'marked';
import type { StockItem } from '~/stores/useScreenerStore';

const props = defineProps<{
  activeStock: StockItem | null;
  selectedShcode: string;
  stockList: StockItem[];
  reportText: string;
  isGenerating: boolean;
  isCopied: boolean;
}>();

defineEmits<{
  (e: 'change-stock', shcode: string): void;
  (e: 'copy'): void;
  (e: 'download'): void;
}>();

const renderedHtml = computed(() => {
  if (!props.reportText) return '';
  try {
    return marked.parse(props.reportText);
  } catch (e) {
    console.error('Markdown parse error:', e);
    return props.reportText;
  }
});
</script>

<style>
.markdown-body h1 {
  font-size: 1.25rem;
  font-weight: 800;
  color: #ffffff;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.markdown-body h2 {
  font-size: 1.1rem;
  font-weight: 700;
  color: #c084fc;
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
}
.markdown-body h3 {
  font-size: 0.95rem;
  font-weight: 700;
  color: #38bdf8;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}
.markdown-body blockquote {
  background: rgba(168, 85, 247, 0.1);
  border-left: 4px solid #a855f7;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  margin: 0.75rem 0;
  font-weight: 600;
}
.markdown-body table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
  background: rgba(15, 23, 42, 0.9);
  border-radius: 0.75rem;
  overflow: hidden;
  border: 1px solid rgba(51, 65, 85, 0.8);
}
.markdown-body th {
  background: rgba(30, 41, 59, 0.9);
  color: #94a3b8;
  font-weight: 700;
  padding: 0.6rem 0.8rem;
  border-bottom: 1px solid rgba(51, 65, 85, 0.8);
  text-align: left;
}
.markdown-body td {
  padding: 0.6rem 0.8rem;
  border-bottom: 1px solid rgba(30, 41, 59, 0.6);
  color: #e2e8f0;
}
.markdown-body tr:hover {
  background: rgba(30, 41, 59, 0.5);
}
.markdown-body ul {
  list-style-type: disc;
  padding-left: 1.25rem;
  margin: 0.5rem 0;
}
.markdown-body li {
  margin-bottom: 0.25rem;
}
.markdown-body hr {
  border-color: rgba(51, 65, 85, 0.6);
  margin: 1.25rem 0;
}
</style>
