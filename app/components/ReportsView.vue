<template>
  <div class="space-y-6">
    <!-- Header Banner -->
    <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <span class="px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/40 font-bold text-xs">
            <i class="fas fa-file-alt mr-1"></i> AI 리포트 아카이브
          </span>
          <span class="text-xs text-slate-400">일자별 AI 종합 시장 분석 & 대응 보고서</span>
        </div>
        <h2 class="text-xl font-extrabold text-white">
          AI 주식 투자 보고서 모음집
        </h2>
        <p class="text-xs text-slate-400 mt-1">
          Anthropic Claude와 LS증권 Open API 데이터로 작성된 리포트 이력입니다.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <label class="text-xs text-slate-400">보고서 선택:</label>
        <select v-model="selectedDate" class="bg-slate-950 text-xs text-white border border-slate-700 px-3 py-2 rounded-xl focus:outline-none focus:border-amber-500">
          <option v-for="report in reportsList" :key="report.date" :value="report.date">
            {{ report.date }} 시장 보고서
          </option>
        </select>
      </div>
    </div>

    <!-- Active Report Display Card -->
    <div class="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 class="text-sm font-bold text-white flex items-center gap-2">
          <i class="fas fa-book-open text-amber-400"></i>
          <span>{{ currentReport.date }} AI 종합 주식 분석 및 대응 전략 보고서</span>
        </h3>
        <span class="text-xs text-slate-400">LS증권 Open API 기반</span>
      </div>

      <div class="bg-slate-950/80 p-6 rounded-xl border border-slate-800 text-xs text-slate-200 leading-relaxed whitespace-pre-line font-sans space-y-4">
        <div class="bg-amber-950/20 border border-amber-500/30 p-4 rounded-xl space-y-2">
          <h4 class="font-bold text-amber-300 text-sm">📌 핵심 요약 (Executive Summary)</h4>
          <p>{{ currentReport.summary }}</p>
        </div>

        <div class="space-y-2">
          <h4 class="font-bold text-white text-sm">📊 1. 시장 동향 및 유망업종 기술적 분석</h4>
          <p>LS증권 Open API 데이터 수집 결과, 반도체 및 로봇 AI 업종 소속 종목에서 심리선과 볼린저 밴드 하단 수렴 및 거래량 급증 포착. 기술적 퀀트 스코어 85점 이상 포착 종목 중심으로 정밀 타점 형성 중.</p>
        </div>

        <div class="space-y-2">
          <h4 class="font-bold text-white text-sm">🎯 2. 정밀 매수/매도 대응 전략</h4>
          <ul class="list-disc list-inside space-y-1">
            <li><strong>매수가 설정</strong>: 볼린저 하단 밴드 102% 이내 수렴 구간에서 1차 분할 매수.</li>
            <li><strong>목표가 (Take Profit)</strong>: RRR 1:2 기준 +8.0% 1차 익절, 볼린저 상단 터치 시 2차 익절.</li>
            <li><strong>손절가 (Stop Loss)</strong>: 매수가 대비 -4.5% 기계적 손절 라인 적용.</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const selectedDate = ref('2026-08-11');

const reportsList = [
  {
    date: '2026-08-11',
    summary: '미국 AI 소프트웨어 및 우주항공 세무 호재와 전력 인프라 급증 수급으로 기술적 반등 지속. 6대 매수 조건 100% 포착 종목 위주 분할 대응 권장.'
  },
  {
    date: '2026-08-10',
    summary: '반도체 조정 후 60일 이평선 정배열 지지 테스트 완료. 수급 급증에 따른 퀀트 스코어 상승 포착.'
  }
];

const currentReport = computed(() => {
  return reportsList.find(r => r.date === selectedDate.value) || reportsList[0];
});
</script>
