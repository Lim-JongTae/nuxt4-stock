<template>
  <div class="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
    <!-- Navigation Header -->
    <div class="flex items-center justify-between bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-xl">
      <NuxtLink to="/" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 transition-all active:scale-95">
        <i class="fas fa-arrow-left"></i>
        <span>전체 종목 스크리너 목록으로</span>
      </NuxtLink>

      <div class="flex items-center gap-2">
        <button 
          @click="loadStockDetail" 
          :disabled="isLoading"
          class="px-4 py-2 rounded-xl bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
        >
          <i class="fas" :class="isLoading ? 'fa-spinner fa-spin' : 'fa-sync-alt'"></i>
          <span>{{ isLoading ? 'LS증권 API 실시간 수집 중...' : '실시간 시세 & AI 매매 판단 갱신' }}</span>
        </button>
      </div>
    </div>

    <!-- Error Alert Banner -->
    <div v-if="errorMessage || stockData?.errorMessage" class="bg-rose-950/90 border border-rose-500/60 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between text-rose-200 text-xs gap-3 shadow-xl">
      <div class="flex items-center gap-3">
        <i class="fas fa-exclamation-triangle text-rose-400 text-lg"></i>
        <div>
          <h4 class="font-bold text-sm text-rose-300">실시간 데이터 수집 / 시스템 경고</h4>
          <p class="text-rose-200/90 mt-0.5">{{ errorMessage || stockData?.errorMessage }}</p>
        </div>
      </div>
      <button @click="errorMessage = null" class="text-rose-400 hover:text-rose-100 font-bold text-sm">닫기 ✕</button>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="isLoading" class="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-xl">
      <i class="fas fa-circle-notch fa-spin text-4xl text-purple-400"></i>
      <p class="text-sm font-bold text-slate-300">LS증권 Open API 실시간 시세 및 8대 지표 AI 퀀트 정밀 판단을 수집 중입니다...</p>
    </div>

    <template v-else-if="stockData">
      <!-- Stock Main Title Banner -->
      <div class="bg-linear-to-r from-slate-900 via-slate-900/90 to-purple-950/40 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span 
                class="px-3 py-1 rounded-lg text-xs font-black border uppercase shadow-sm"
                :class="stockData.isHolding ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'"
              >
                <i class="fas" :class="stockData.isHolding ? 'fa-wallet' : 'fa-eye'"></i>
                {{ stockData.isHolding ? '현재 보유 종목 (Holdings)' : '미보유 관심 종목 (Watchlist)' }}
              </span>
              <span class="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono text-xs">
                {{ stockData.shcode }}
              </span>
              <span class="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 font-bold text-xs">
                {{ stockData.industry }}
              </span>
            </div>

            <h1 class="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
              <span>{{ stockData.name }}</span>
            </h1>
          </div>

          <!-- Price & Return metrics -->
          <div class="text-right space-y-1">
            <div class="text-xs text-slate-400">LS증권 실시간 종가</div>
            <div class="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
              {{ Number(stockData.closePrice).toLocaleString() }}원
            </div>
            <div v-if="stockData.isHolding && stockData.holdingAvgPrice" class="text-xs text-slate-300">
              평단가: {{ stockData.holdingAvgPrice.toLocaleString() }}원 | 수량: {{ stockData.holdingQuantity }}주
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div class="flex items-center gap-2">
            <i class="fas fa-database text-cyan-400"></i>
            <span>데이터 출처: {{ stockData.dataSource }}</span>
          </div>
          <div>퀀트 스코어: <strong class="text-purple-400 font-bold text-sm">{{ stockData.score }}점 / 100점</strong></div>
        </div>
      </div>

      <!-- Real-time 8 Indicators AI Quant Investment Decision Box -->
      <div v-if="aiAnalysis" class="bg-linear-to-br from-slate-900 via-slate-900 to-indigo-950/60 border border-purple-500/40 rounded-2xl p-6 shadow-2xl space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-500/50 flex items-center justify-center text-purple-300 font-bold text-lg shadow-lg">
              <i class="fas fa-brain"></i>
            </div>
            <div>
              <h3 class="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>Anthropic Claude AI 실시간 정밀 매매 판단</span>
              </h3>
              <p class="text-xs text-slate-400 mt-0.5">{{ aiAnalysis.apiProvider || 'Anthropic Claude API' }} (분석시각: {{ aiAnalysis.analyzedAt }})</p>
            </div>
          </div>

          <!-- AI Decision Badge -->
          <div class="flex items-center gap-3">
            <div 
              class="px-5 py-2 rounded-xl text-base sm:text-lg font-black border uppercase shadow-xl flex items-center gap-2"
              :class="aiAnalysis.badgeClass"
            >
              <i class="fas" :class="{
                'fa-arrow-circle-up': aiAnalysis.decision === '매수',
                'fa-hand-paper': aiAnalysis.decision === '유지',
                'fa-arrow-circle-down': aiAnalysis.decision === '매도',
                'fa-glasses': aiAnalysis.decision === '관찰'
              }"></i>
              <span>AI 매매 결정: {{ aiAnalysis.decision }}</span>
            </div>
          </div>
        </div>

        <!-- AI Summary Banner -->
        <div class="bg-slate-950/80 border border-purple-500/30 p-4 rounded-xl text-xs text-purple-200 font-semibold leading-relaxed">
          <i class="fas fa-quote-left text-purple-400 mr-2"></i>
          {{ aiAnalysis.summary }}
        </div>

        <!-- Target Price & Stop Loss Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="bg-slate-950/70 border border-emerald-500/30 p-3.5 rounded-xl space-y-1">
            <div class="text-xs font-bold text-emerald-400 flex items-center justify-between">
              <span>🎯 AI 목표가</span>
              <span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-[10px]">+{{ aiAnalysis.expectedReturnRate }}% 기대</span>
            </div>
            <div class="text-lg font-black text-white font-mono">{{ aiAnalysis.targetPrice.toLocaleString() }}원</div>
          </div>

          <div class="bg-slate-950/70 border border-rose-500/30 p-3.5 rounded-xl space-y-1">
            <div class="text-xs font-bold text-rose-400 flex items-center justify-between">
              <span>🛡️ AI 손절가</span>
              <span class="px-1.5 py-0.5 rounded bg-rose-500/20 text-[10px]">리스크 차단</span>
            </div>
            <div class="text-lg font-black text-white font-mono">{{ aiAnalysis.stopLossPrice.toLocaleString() }}원</div>
          </div>

          <div class="bg-slate-950/70 border border-indigo-500/30 p-3.5 rounded-xl space-y-1">
            <div class="text-xs font-bold text-indigo-400 flex items-center justify-between">
              <span>📊 분석 신뢰도</span>
              <span class="px-1.5 py-0.5 rounded bg-indigo-500/20 text-[10px]">5일 수급분석</span>
            </div>
            <div class="text-lg font-black text-indigo-200">{{ aiAnalysis.confidence }}</div>
          </div>
        </div>

        <!-- AI Key Reasons & Action Plan -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
          <div class="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-2">
            <h4 class="font-bold text-slate-200 flex items-center gap-1.5">
              <i class="fas fa-check-double text-cyan-400"></i> AI 정밀 근거 (3대 요인)
            </h4>
            <ul class="space-y-1.5 text-slate-300">
              <li v-for="(reason, idx) in aiAnalysis.keyReasons" :key="idx" class="flex items-start gap-2">
                <span class="text-purple-400 font-bold">•</span>
                <span>{{ reason }}</span>
              </li>
            </ul>
          </div>

          <div class="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-2">
            <h4 class="font-bold text-slate-200 flex items-center gap-1.5">
              <i class="fas fa-compass text-amber-400"></i> 실전 매매 대응 전략 (Action Plan)
            </h4>
            <p class="text-slate-300 leading-relaxed">{{ aiAnalysis.actionPlan }}</p>
            <div class="pt-2 border-t border-slate-800 text-[11px] text-rose-300">
              <i class="fas fa-shield-alt mr-1"></i> 리스크 관리: {{ aiAnalysis.riskFactor }}
            </div>
          </div>
        </div>
      </div>

      <!-- 8 Technical Indicator Tiles -->
      <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h3 class="text-sm sm:text-base font-extrabold text-white flex items-center justify-between border-b border-slate-800 pb-3">
          <span>📊 8대 기술적 & 수급 지표 정밀 달성 현황</span>
          <span class="text-xs font-normal text-slate-400">충족 시 초록색 표시</span>
        </h3>

        <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div class="bg-slate-950/80 border p-3 rounded-xl space-y-1" :class="stockData?.conditions?.cond_psy ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-slate-800'">
            <div class="text-[11px] font-bold" :class="stockData?.conditions?.cond_psy ? 'text-emerald-400' : 'text-slate-400'">1. 심리선</div>
            <div class="text-xs font-black text-white">{{ stockData?.psy !== null && stockData?.psy !== undefined ? stockData.psy + '%' : 'N/A' }}</div>
            <div class="text-[9px]" :class="stockData?.conditions?.cond_psy ? 'text-emerald-400 font-bold' : 'text-slate-500'">{{ stockData?.conditions?.cond_psy ? '과매도 합격' : '미달성' }}</div>
          </div>

          <div class="bg-slate-950/80 border p-3 rounded-xl space-y-1" :class="stockData?.conditions?.cond_bb ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-slate-800'">
            <div class="text-[11px] font-bold" :class="stockData?.conditions?.cond_bb ? 'text-emerald-400' : 'text-slate-400'">2. 볼린저하단</div>
            <div class="text-xs font-black text-white">{{ stockData?.bbLower ? Number(stockData.bbLower).toLocaleString() + '원' : 'N/A' }}</div>
            <div class="text-[9px]" :class="stockData?.conditions?.cond_bb ? 'text-emerald-400 font-bold' : 'text-slate-500'">{{ stockData?.conditions?.cond_bb ? '하단 지지' : '미달성' }}</div>
          </div>

          <div class="bg-slate-950/80 border p-3 rounded-xl space-y-1" :class="stockData?.conditions?.cond_ma_turn ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-slate-800'">
            <div class="text-[11px] font-bold" :class="stockData?.conditions?.cond_ma_turn ? 'text-emerald-400' : 'text-slate-400'">3. 이평선정배열</div>
            <div class="text-xs font-black text-white">5/20/60일</div>
            <div class="text-[9px]" :class="stockData?.conditions?.cond_ma_turn ? 'text-emerald-400 font-bold' : 'text-slate-500'">{{ stockData?.conditions?.cond_ma_turn ? '정배열 전환' : '미달성' }}</div>
          </div>

          <div class="bg-slate-950/80 border p-3 rounded-xl space-y-1" :class="stockData?.conditions?.cond_volume ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-slate-800'">
            <div class="text-[11px] font-bold" :class="stockData?.conditions?.cond_volume ? 'text-emerald-400' : 'text-slate-400'">4. 거래량수급</div>
            <div class="text-xs font-black text-white">{{ stockData?.volumeRatio !== null && stockData?.volumeRatio !== undefined ? stockData.volumeRatio + '%' : 'N/A' }}</div>
            <div class="text-[9px]" :class="stockData?.conditions?.cond_volume ? 'text-emerald-400 font-bold' : 'text-slate-500'">{{ stockData?.conditions?.cond_volume ? '120% 급증' : '미달성' }}</div>
          </div>

          <div class="bg-slate-950/80 border p-3 rounded-xl space-y-1" :class="stockData?.conditions?.cond_macd ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-slate-800'">
            <div class="text-[11px] font-bold" :class="stockData?.conditions?.cond_macd ? 'text-emerald-400' : 'text-slate-400'">5. MACD반전</div>
            <div class="text-xs font-black text-white">{{ stockData?.macdHist !== null && stockData?.macdHist !== undefined ? stockData.macdHist : 'N/A' }}</div>
            <div class="text-[9px]" :class="stockData?.conditions?.cond_macd ? 'text-emerald-400 font-bold' : 'text-slate-500'">{{ stockData?.conditions?.cond_macd ? '오실레이터 양전' : '미달성' }}</div>
          </div>

          <div class="bg-slate-950/80 border p-3 rounded-xl space-y-1" :class="stockData?.conditions?.cond_rsi ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-slate-800'">
            <div class="text-[11px] font-bold" :class="stockData?.conditions?.cond_rsi ? 'text-emerald-400' : 'text-slate-400'">6. RSI탈출</div>
            <div class="text-xs font-black text-white">{{ stockData?.rsi !== null && stockData?.rsi !== undefined ? stockData.rsi : 'N/A' }}</div>
            <div class="text-[9px]" :class="stockData?.conditions?.cond_rsi ? 'text-emerald-400 font-bold' : 'text-slate-500'">{{ stockData?.conditions?.cond_rsi ? '35 이하 반등' : '미달성' }}</div>
          </div>

          <div class="bg-slate-950/80 border p-3 rounded-xl space-y-1" :class="stockData?.conditions?.cond_divergence ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-slate-800'">
            <div class="text-[11px] font-bold" :class="stockData?.conditions?.cond_divergence ? 'text-emerald-400' : 'text-slate-400'">7. 다이버전스</div>
            <div class="text-xs font-black text-white">강세 반전</div>
            <div class="text-[9px]" :class="stockData?.conditions?.cond_divergence ? 'text-emerald-400 font-bold' : 'text-slate-500'">{{ stockData?.conditions?.cond_divergence ? '다이버전스 포착' : '미달성' }}</div>
          </div>

          <div class="bg-slate-950/80 border p-3 rounded-xl space-y-1" :class="stockData?.conditions?.cond_short_signal ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-slate-800'">
            <div class="text-[11px] font-bold" :class="stockData?.conditions?.cond_short_signal ? 'text-emerald-400' : 'text-slate-400'">8. 공매도수급</div>
            <div class="text-xs font-black text-white">{{ stockData?.shortSignal?.label || 'N/A' }}</div>
            <div class="text-[9px]" :class="stockData?.conditions?.cond_short_signal ? 'text-emerald-400 font-bold' : 'text-slate-500'">{{ stockData?.conditions?.cond_short_signal ? '수급 호재' : '미달성' }}</div>
          </div>
        </div>
      </div>

      <!-- Short Selling 5-Day Time Series Table (t1927 API Result) -->
      <div v-if="stockData.shortSellHistory && stockData.shortSellHistory.length > 0" class="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 class="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
            <i class="fas fa-chart-bar text-rose-400"></i>
            <span>LS증권 t1927 공매도일별추이 실시간 시계열 데이터</span>
          </h3>
          <span class="text-xs text-slate-400">최근 {{ stockData.shortSellHistory.length }}영업일</span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th class="px-3 py-3">일자 (Date)</th>
                <th class="px-3 py-3">주가 종가 (Close)</th>
                <th class="px-3 py-3 text-center">등락율 (%)</th>
                <th class="px-3 py-3 text-rose-400">공매도 평균단가 (Short Avg)</th>
                <th class="px-3 py-3 text-amber-300">누적 공매도 수량 (Short Vol)</th>
                <th class="px-3 py-3 text-purple-300">공매도 잔고비율 (%)</th>
                <th class="px-3 py-3 text-right">총 거래량 (Volume)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60 text-slate-200">
              <tr v-for="(rec, idx) in stockData.shortSellHistory" :key="idx" class="hover:bg-slate-850/50">
                <td class="px-3 py-3 font-mono font-bold">{{ rec.date }}</td>
                <td class="px-3 py-3 font-mono font-bold text-slate-100">{{ Number(rec.price).toLocaleString() }}원</td>
                <td class="px-3 py-3 font-mono font-bold text-center" :class="(rec.changeRate || 0) >= 0 ? 'text-red-400' : 'text-blue-400'">
                  {{ typeof rec.changeRate === 'number' ? (rec.changeRate > 0 ? '+' + rec.changeRate : rec.changeRate) + '%' : '-' }}
                </td>
                <td class="px-3 py-3 font-mono font-bold text-rose-300">
                  {{ rec.shortAvgPrice && rec.shortAvgPrice > 0 ? Number(rec.shortAvgPrice).toLocaleString() + '원' : '-' }}
                </td>
                <td class="px-3 py-3 font-mono font-bold text-amber-300">
                  {{ rec.shortVolume && rec.shortVolume > 0 ? Number(rec.shortVolume).toLocaleString() + '주' : '-' }}
                </td>
                <td class="px-3 py-3 font-mono font-bold text-purple-300">{{ rec.balanceRatio }}%</td>
                <td class="px-3 py-3 font-mono text-slate-300 text-right">{{ Number(rec.volume).toLocaleString() }}주</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="stockData.shortSignal?.summary" class="bg-slate-950/60 border border-slate-800 p-3 rounded-xl text-xs text-slate-300">
          <strong>수급 요약:</strong> {{ stockData.shortSignal.summary }}
        </div>
      </div>

      <!-- Technical Buy Report Renderer (Matching buy sample format) -->
      <div v-if="displayReportText" class="bg-slate-900/90 border border-purple-500/50 rounded-2xl p-6 shadow-2xl space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <span class="px-2.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-bold">
              <i class="fas fa-file-alt mr-1"></i> {{ stockData.name }} 기술적 매수 진단 보고서 양식
            </span>
            <h3 class="text-lg font-black text-white mt-1">
              📊 {{ stockData.name }} 기술적 정밀 진단 보고서
            </h3>
          </div>
          <div class="flex items-center gap-2">
            <button 
              @click="copyReport" 
              class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
            >
              <i class="fas" :class="isCopied ? 'fa-check text-emerald-400' : 'fa-copy'"></i>
              <span>{{ isCopied ? '복사 완료!' : '마크다운 보고서 복사' }}</span>
            </button>
            <button 
              @click="downloadReport" 
              class="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-purple-500/20 active:scale-95"
            >
              <i class="fas fa-download"></i>
              <span>.md 보고서 다운로드</span>
            </button>
          </div>
        </div>

        <div 
          v-if="renderedReportHtml"
          class="markdown-body bg-slate-950/90 border border-slate-800/80 p-6 rounded-xl text-xs text-slate-200 overflow-x-auto leading-relaxed space-y-4"
          v-html="renderedReportHtml"
        ></div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { marked } from 'marked';
import { useStockAnalysis, generateBuyFormatReport, type CalculatedAnalysisResult } from '~/composables/useStockAnalysis';

const props = defineProps<{
  shcode: string;
}>();

const isLoading = ref(true);
const errorMessage = ref<string | null>(null);
const stockData = ref<any>(null);
const aiAnalysis = ref<CalculatedAnalysisResult | null>(null);
const isCopied = ref(false);

const stockDetailStore = useStockDetailStore();
const { analyzeStockWithClaude, analysisError } = useStockAnalysis();

const savedReportText = ref<string>('');

const displayReportText = computed(() => {
  if (savedReportText.value) return savedReportText.value;
  if (!stockData.value) return '';
  return generateBuyFormatReport(stockData.value, aiAnalysis.value);
});

const renderedReportHtml = computed(() => {
  if (!displayReportText.value) return '';
  try {
    return marked.parse(displayReportText.value);
  } catch (e) {
    return displayReportText.value;
  }
});

function copyReport() {
  if (!displayReportText.value) return;
  navigator.clipboard.writeText(displayReportText.value);
  isCopied.value = true;
  setTimeout(() => { isCopied.value = false; }, 2000);
}

function downloadReport() {
  if (!displayReportText.value || !stockData.value) return;
  const filename = `${stockData.value.name}_종목코드_${stockData.value.shcode}_기술적진단보고서.md`;
  const blob = new Blob([displayReportText.value], { type: 'text/markdown;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function persistReportToServer(reportText: string) {
  if (!stockData.value || !reportText) return;
  try {
    await $fetch('/api/report/save', {
      method: 'POST',
      body: {
        shcode: stockData.value.shcode,
        name: stockData.value.name,
        report: reportText
      }
    });
  } catch (e) {
    console.warn('Report file auto-save to server failed:', e);
  }
}

onMounted(async () => {
  stockDetailStore.initFromStorage();
  
  // 1. LocalStorage 캐시 데이터 및 저장된 AI 보고서가 있으면 0ms 즉시 화면 우선 표기
  const cached = stockDetailStore.getStockCache(props.shcode);
  if (cached) {
    stockData.value = cached;
    if (cached.generatedReport) {
      savedReportText.value = cached.generatedReport;
    }
  }

  // 2. LS증권 Open API를 호출하여 최신 실시간 종가 및 수급 데이터를 갱신
  await loadStockDetail(true);
});

async function loadStockDetail(forceRefresh = true) {
  if (!props.shcode) return;
  if (!stockData.value) {
    isLoading.value = true;
  }
  errorMessage.value = null;

  try {
    const updated = await stockDetailStore.fetchAndCacheStock(props.shcode, forceRefresh);
    if (updated) {
      stockData.value = updated;

      // AI 퀀트 판단 수행 (AI 분석 결과가 비어있는 경우 수행)
      if (!aiAnalysis.value) {
        const result = await analyzeStockWithClaude(updated as any);
        if (result) {
          aiAnalysis.value = result;
          const freshReport = generateBuyFormatReport(updated, result);
          savedReportText.value = freshReport;
          
          // Pinia Store 및 LocalStorage에 1달 보존 저장
          stockDetailStore.saveAiReport(props.shcode, freshReport);

          // 백엔드 report/ 폴더에 md 및 json 파일로 영구 저장
          await persistReportToServer(freshReport);
        } else if (analysisError.value) {
          errorMessage.value = `[Claude AI 연동 경고]: ${analysisError.value}`;
        }
      }
    } else if (stockDetailStore.errorMessage) {
      errorMessage.value = stockDetailStore.errorMessage;
    }
  } catch (err: any) {
    console.error('Stock detail error:', err);
    errorMessage.value = err.statusMessage || err.message || '종목 상세 데이터 수집 중 오류가 발생했습니다.';
  } finally {
    isLoading.value = false;
  }
}
</script>
