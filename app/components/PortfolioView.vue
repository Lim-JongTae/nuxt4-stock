<template>
  <div class="space-y-6">
    <!-- Header Banner -->
    <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <span class="px-2.5 py-0.5 rounded-md bg-purple-500/20 text-purple-400 border border-purple-500/40 font-bold text-xs">
            <i class="fas fa-wallet mr-1"></i> 포트폴리오 관리
          </span>
          <span class="text-xs text-slate-400">평단가 × 수량 = 매수금액 자동 실시간 연동</span>
        </div>
        <h2 class="text-xl font-extrabold text-white">
          보유 종목 상세 현황 & 정밀 매수/매도 진단
        </h2>
        <p class="text-xs text-slate-400 mt-1">
          목표가(RRR 1:2), 추적 손절매(-3.0%), 기계적 손절(-4.5%) 3중 알고리즘 방어막으로 계좌를 보호합니다.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3 text-xs">
        <span class="text-slate-300 flex items-center gap-1.5 bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800 shadow-sm">
          <i class="far fa-clock text-amber-400"></i>
          <span>시세 갱신 일시: <strong class="text-amber-300 font-mono">{{ portfolioStore.holdings[0]?.updatedAt || 'LS증권 API 연동' }}</strong></span>
        </span>

        <button 
          @click="portfolioStore.refreshPrices()" 
          :disabled="portfolioStore.isLoading"
          class="px-4 py-2.5 rounded-xl bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-500/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
        >
          <i class="fas" :class="portfolioStore.isLoading ? 'fa-spinner fa-spin' : 'fa-sync-alt'"></i>
          <span>{{ portfolioStore.isLoading ? 'LS증권 시세 갱신 중...' : 'LS증권 실시간 시세 갱신' }}</span>
        </button>

        <div class="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
          <span class="text-slate-400 block text-[10px]">총 평가손익</span>
          <strong :class="portfolioStore.totalPnlAmount >= 0 ? 'text-rose-400' : 'text-emerald-400'" class="text-sm font-mono font-extrabold">
            {{ portfolioStore.totalPnlAmount >= 0 ? '+' : '' }}{{ Number(portfolioStore.totalPnlAmount).toLocaleString() }}원
            ({{ portfolioStore.totalPnlRate >= 0 ? '+' : '' }}{{ portfolioStore.totalPnlRate }}%)
          </strong>
        </div>
      </div>
    </div>

    <!-- Error Alert Banner -->
    <div v-if="portfolioStore.errorMessage" class="bg-rose-950/80 border border-rose-500/50 p-4 rounded-xl flex items-center justify-between text-rose-300 text-xs shadow-lg">
      <div class="flex items-center gap-2">
        <i class="fas fa-exclamation-triangle text-rose-400 text-sm"></i>
        <span><strong>연동 상태 경고:</strong> {{ portfolioStore.errorMessage }}</span>
      </div>
      <button @click="portfolioStore.errorMessage = null" class="text-rose-400 hover:text-rose-200 font-bold px-2">✕</button>
    </div>

    <!-- Holdings Cards & Table List -->
    <div class="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-xl">
      <div class="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/90">
        <table class="w-full text-xs text-left text-slate-300">
          <thead class="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[11px]">
            <tr>
              <th class="px-4 py-3.5">업종</th>
              <th class="px-4 py-3.5">종목코드</th>
              <th class="px-4 py-3.5">종목명</th>
              <th class="px-4 py-3.5">보유 수량</th>
              <th class="px-4 py-3.5">평균 단가</th>
              <th class="px-4 py-3.5">총 매수금액</th>
              <th class="px-4 py-3.5">실시간 현재가</th>
              <th class="px-4 py-3.5">평가 손익률</th>
              <th class="px-4 py-3.5">정밀 매도 가이드라인</th>
              <th class="px-4 py-3.5 text-center">AI 정밀 진단</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60">
            <tr 
              v-for="item in portfolioStore.holdings" 
              :key="item.shcode"
              class="hover:bg-slate-900/80 transition-all border-b border-slate-800/40"
            >
              <td class="px-4 py-3.5"><span class="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold text-[10px]">{{ item.industry }}</span></td>
              <td class="px-4 py-3.5 font-mono text-slate-400">{{ item.shcode }}</td>
              <td class="px-4 py-3.5 font-bold text-white text-xs">{{ item.name }}</td>
              <td class="px-4 py-3.5 font-mono text-slate-200 font-bold">{{ item.quantity }}주</td>
              <td class="px-4 py-3.5 font-mono text-slate-300">{{ Number(item.avgPrice).toLocaleString() }}원</td>
              <td class="px-4 py-3.5 font-mono font-extrabold text-amber-300">
                {{ Number(item.avgPrice * item.quantity).toLocaleString() }}원
              </td>
              <td class="px-4 py-3.5 font-mono font-bold text-slate-100">
                {{ Number(item.currentPrice).toLocaleString() }}원
              </td>
              
              <!-- PnL Rate (양수: 붉은색, 음수: 푸른색/Cyan) -->
              <td class="px-4 py-3.5 font-mono font-extrabold" :class="getPnl(item).rate >= 0 ? 'text-rose-400' : 'text-cyan-400'">
                {{ getPnl(item).rate >= 0 ? '+' : '' }}{{ getPnl(item).rate }}%
              </td>

              <!-- Dynamic Tech & AI Protection Guidelines -->
              <td class="px-4 py-3.5 text-[11px] space-y-0.5">
                <div class="text-rose-400">
                  💰 목표가: <strong>{{ getTargetPriceInfo(item).price.toLocaleString() }}원 ({{ getTargetPriceInfo(item).rate }}%)</strong>
                </div>
                <div class="text-amber-400">
                  🛡️ 트레일링: <strong>고점 대비 -{{ item.trailingRate || 2.5 }}%</strong>
                </div>
                <div class="text-cyan-400">
                  🚨 손절가: <strong>{{ getStopLossInfo(item).price.toLocaleString() }}원 ({{ getStopLossInfo(item).rate }}%)</strong>
                </div>
              </td>

              <!-- AI Diagnosis Trigger -->
              <td class="px-4 py-3.5 text-center">
                <button 
                  @click="openAiModal(item.name)"
                  class="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 font-bold text-xs flex items-center gap-1.5 justify-center transition-all shadow-sm"
                >
                  <i class="fas fa-brain text-indigo-400"></i> AI 정밀 진단
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- AI Diagnosis Modal Popup -->
    <div v-if="portfolioStore.selectedStockForAi" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-slate-900 border border-indigo-500/40 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl relative max-h-[85vh] flex flex-col">
        
        <!-- Modal Header -->
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 class="text-base font-extrabold text-white flex items-center gap-2">
            <i class="fas fa-brain text-indigo-400"></i>
            <span>[{{ portfolioStore.selectedStockForAi }}] AI 실시간 투자 및 매수/매도 정밀 진단</span>
          </h3>
          <button @click="portfolioStore.selectedStockForAi = null" class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <!-- Modal Content Body -->
        <div class="flex-1 overflow-y-auto space-y-4 pr-1 text-xs text-slate-200 leading-relaxed">
          <div v-if="portfolioStore.isAiAnalyzing" class="py-16 text-center space-y-3">
            <i class="fas fa-spinner fa-spin text-3xl text-indigo-400"></i>
            <p class="text-sm font-bold text-slate-300">
              Anthropic Claude AI 모델이 실시간 차트 및 퀀트 지표를 분석 중입니다...
            </p>
          </div>

          <div v-else class="space-y-4">
            <div class="bg-slate-950/80 p-5 rounded-xl border border-slate-800 whitespace-pre-line font-sans">
              {{ portfolioStore.aiAnalysisResult }}
            </div>

            <!-- Creation Timestamp at the very bottom of the report -->
            <div class="bg-slate-950/90 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span class="flex items-center gap-1.5 font-mono">
                <i class="far fa-clock text-amber-400"></i>
                <span>보고서 생성 일자 및 시간: <strong class="text-amber-300">{{ aiReportTimestamp }}</strong></span>
              </span>
              <span class="text-[10px] text-slate-500 font-sans">LS증권 Open API & Anthropic Claude 퀀트 모델</span>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="border-t border-slate-800 pt-3 flex items-center justify-between">
          <span class="text-[11px] text-slate-400">
            실시간 퀀트 진단 보고서
          </span>
          <div class="flex items-center gap-2">
            <!-- Copy Button to the left of Close Button -->
            <button 
              @click="copyAiReport" 
              :disabled="portfolioStore.isAiAnalyzing || !portfolioStore.aiAnalysisResult"
              class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-500/20"
            >
              <i class="fas" :class="isCopied ? 'fa-check text-emerald-300' : 'fa-copy'"></i>
              <span>{{ isCopied ? '복사 완료!' : '보고서 복사' }}</span>
            </button>
            <button 
              @click="portfolioStore.selectedStockForAi = null" 
              class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-all"
            >
              닫기
            </button>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { usePortfolioStore, type HoldingItem } from '~/stores/usePortfolioStore';

const portfolioStore = usePortfolioStore();
const aiReportTimestamp = ref('');
const isCopied = ref(false);

onMounted(async () => {
  await portfolioStore.fetchHoldings(false);
});

function getPnl(item: HoldingItem) {
  const pnlAmount = (item.currentPrice - item.avgPrice) * item.quantity;
  const rate = Math.round((pnlAmount / (item.avgPrice * item.quantity)) * 1000) / 10;
  return { amount: pnlAmount, rate };
}

function getTargetPriceInfo(item: HoldingItem) {
  const currentPrice = item.currentPrice || 0;
  const targetPrice = item.targetPrice || Math.round(currentPrice * 1.075);
  if (!currentPrice) return { price: 0, rate: '0.0' };
  const diffRate = (((targetPrice - currentPrice) / currentPrice) * 100).toFixed(1);
  const sign = Number(diffRate) >= 0 ? '+' : '';
  return { price: targetPrice, rate: `${sign}${diffRate}` };
}

function getStopLossInfo(item: HoldingItem) {
  const currentPrice = item.currentPrice || 0;
  const stopLossPrice = item.stopLossPrice || Math.round(currentPrice * 0.95);
  if (!currentPrice) return { price: 0, rate: '0.0' };
  const diffRate = (((stopLossPrice - currentPrice) / currentPrice) * 100).toFixed(1);
  const sign = Number(diffRate) >= 0 ? '+' : '';
  return { price: stopLossPrice, rate: `${sign}${diffRate}` };
}

function openAiModal(stockName: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  aiReportTimestamp.value = `${year}-${month}-${day} ${hours}:${minutes}:${seconds} (KST)`;
  
  isCopied.value = false;
  portfolioStore.runAiDiagnosis(stockName);
}

async function copyAiReport() {
  if (!portfolioStore.aiAnalysisResult) return;
  const contentToCopy = `${portfolioStore.aiAnalysisResult}\n\n[보고서 생성 일자 및 시간: ${aiReportTimestamp.value}]`;
  try {
    await navigator.clipboard.writeText(contentToCopy);
    isCopied.value = true;
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  } catch (err) {
    console.error('Clipboard copy error:', err);
  }
}
</script>
