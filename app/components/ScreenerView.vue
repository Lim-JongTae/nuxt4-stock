<template>
  <div class="space-y-6">
    <!-- Screener Header & Controls -->
    <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="px-2.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-bold text-xs">
              <i class="fas fa-search-dollar mr-1"></i> LS증권 API 퀀트 스크리너
            </span>
            <span class="text-xs text-slate-400">유망업종 & 6대 기술적 지표 매수타점</span>
          </div>
          <h2 class="text-xl font-extrabold text-white">
            유망업종 관심종목 발굴 & 실시간 비교 뷰 (`watchlist.csv` / `watchlist.json`)
          </h2>
          <p class="text-xs text-emerald-400 mt-1 bg-slate-950/70 border border-emerald-500/30 ">
            심리선 과매도 + 볼린저 하단 수렴 + 이평선 정배열 + 거래량 수급 + MACD 양전 + RSI 과매도 탈출 6가지 조건을 100점 만점으로 수치화합니다.
          </p>
        </div>

        <button 
          @click="screenerStore.refreshScreener()" 
          :disabled="screenerStore.isRefreshing"
          class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-500/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
        >
          <i class="fas" :class="screenerStore.isRefreshing ? 'fa-spinner fa-spin' : 'fa-sync-alt'"></i>
          <span>{{ screenerStore.isRefreshing ? 'LS증권 API 시세 분석 중...' : '실시간 스크리너 데이터 갱신' }}</span>
        </button>
      </div>

      <!-- 6 Technical Criteria Cards Summary -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2 border-t border-slate-800">
        <div class="bg-slate-950/70 border border-purple-500/30 p-2.5 rounded-xl space-y-1">
          <div class="text-[11px] font-bold text-purple-400 flex items-center justify-between">
            <span>1. 심리선(PSY)</span>
            <span class="px-1 py-0.5 rounded bg-purple-500/20 text-[9px]">25% 이하</span>
          </div>
          <p class="text-[10px] text-slate-400">12일 상승비율 과매도</p>
        </div>

        <div class="bg-slate-950/70 border border-blue-500/30 p-2.5 rounded-xl space-y-1">
          <div class="text-[11px] font-bold text-blue-400 flex items-center justify-between">
            <span>2. 볼린저 하단</span>
            <span class="px-1 py-0.5 rounded bg-blue-500/20 text-[9px]">102% 이내</span>
          </div>
          <p class="text-[10px] text-slate-400">20일 2SD 하단 밴드 수렴</p>
        </div>

        <div class="bg-slate-950/70 border border-emerald-500/30 p-2.5 rounded-xl space-y-1">
          <div class="text-[11px] font-bold text-emerald-400 flex items-center justify-between">
            <span>3. 이평선 전환</span>
            <span class="px-1 py-0.5 rounded bg-emerald-500/20 text-[9px]">5/20/60일</span>
          </div>
          <p class="text-[10px] text-slate-400">단기 이평 정배열 전환</p>
        </div>

        <div class="bg-slate-950/70 border border-amber-500/30 p-2.5 rounded-xl space-y-1">
          <div class="text-[11px] font-bold text-amber-400 flex items-center justify-between">
            <span>4. 거래량 수급</span>
            <span class="px-1 py-0.5 rounded bg-amber-500/20 text-[9px]">120% 이상</span>
          </div>
          <p class="text-[10px] text-slate-400">전일 대비 수급 급증</p>
        </div>

        <div class="bg-slate-950/70 border border-pink-500/30 p-2.5 rounded-xl space-y-1">
          <div class="text-[11px] font-bold text-pink-400 flex items-center justify-between">
            <span>5. MACD 반전</span>
            <span class="px-1 py-0.5 rounded bg-pink-500/20 text-[9px]">양전/다이버전스</span>
          </div>
          <p class="text-[10px] text-slate-400">오실레이터 상승 다이버전스</p>
        </div>

        <div class="bg-slate-950/70 border border-cyan-500/30 p-2.5 rounded-xl space-y-1">
          <div class="text-[11px] font-bold text-cyan-400 flex items-center justify-between">
            <span>6. RSI 탈출</span>
            <span class="px-1 py-0.5 rounded bg-cyan-500/20 text-[9px]">30선 돌파</span>
          </div>
          <p class="text-[10px] text-slate-400">RSI(14일) 30 이하 반등</p>
        </div>
      </div>
    </div>

    <!-- Dual Comparison Layout: OLD (Top) vs NEW (Bottom) -->
    <div class="space-y-6">
      
      <!-- 1. OLD Section (Top): 이전 분석 기록 -->
      <div class="bg-slate-900/40 border border-slate-700/50 rounded-2xl p-4 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/40 pb-2.5">
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-extrabold text-xs flex items-center gap-1.5 shadow-sm">
              <i class="fas fa-history text-amber-400"></i> 이전 거래분석 기록 (OLD)
            </span>
            <h3 class="text-sm font-bold text-slate-200">이전 기술적 관심종목 리스트</h3>
          </div>
          <div class="flex flex-wrap items-center gap-4 text-xs">
            <span class="text-slate-300 flex items-center gap-1.5 bg-slate-950/80 px-3 py-1 rounded-lg border border-amber-500/40 shadow-sm">
              <i class="far fa-clock text-amber-400"></i> 이전 기록 작성 시간: <strong class="text-amber-300 font-mono">{{ screenerStore.oldRecordTime }}</strong>
            </span>
            <span class="text-slate-400 flex items-center gap-1.5 bg-slate-950/60 px-3 py-1 rounded-lg border border-slate-800">
              <i class="fas fa-server text-amber-400"></i> 자료수집처: <strong class="text-slate-200">{{ screenerStore.sourceProvider }}</strong>
            </span>
          </div>
        </div>

        <div class="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/80">
          <table class="w-full text-xs text-left text-slate-300">
            <thead class="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[11px]">
              <tr>
                <th class="px-3 py-3">업종</th>
                <th class="px-3 py-3">종목코드</th>
                <th class="px-3 py-3">종목명</th>
                <th class="px-3 py-3">이전 현재가</th>
                <th class="px-3 py-3">심리선(12일)</th>
                <th class="px-3 py-3">볼린저 하단</th>
                <th class="px-3 py-3">이평선 상태</th>
                <th class="px-3 py-3">MACD 오실레이터</th>
                <th class="px-3 py-3">RSI(14일)</th>
                <th class="px-3 py-3">거래량 비율</th>
                <th class="px-3 py-3 text-center">이전 퀀트 스코어</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60">
              <tr 
                v-for="item in screenerStore.oldData" 
                :key="item.shcode"
                class="hover:bg-slate-900/60 transition-all"
              >
                <td class="px-3 py-3"><span class="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold text-[10px]">{{ item.industry }}</span></td>
                <td class="px-3 py-3 font-mono text-slate-400">{{ item.shcode }}</td>
                <td class="px-3 py-3 font-bold text-white">{{ item.name }}</td>
                <td class="px-3 py-3 font-extrabold text-slate-200">{{ Number(item.closePrice).toLocaleString() }}원</td>
                <td class="px-3 py-3">{{ item.psy }}%</td>
                <td class="px-3 py-3 font-mono text-slate-400">{{ Number(item.bbLower).toLocaleString() }}원</td>
                <td class="px-3 py-3 text-emerald-400 font-semibold">정배열 지지</td>
                <td class="px-3 py-3">+{{ item.macdHist }}</td>
                <td class="px-3 py-3">{{ item.rsi }}</td>
                <td class="px-3 py-3">{{ item.volumeRatio }}%</td>
                <td class="px-3 py-3 text-center">
                  <span class="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-bold">
                    {{ item.score }}점 / 100점
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 2. NEW Section (Bottom): 실시간 갱신 관심종목 -->
      <div class="bg-slate-900/70 border border-indigo-500/40 rounded-2xl p-4 space-y-3 shadow-xl relative overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-500/30 pb-2.5">
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-extrabold text-xs flex items-center gap-1.5 shadow-sm">
              <i class="fas fa-bolt text-emerald-400"></i> 실시간 갱신 (NEW)
            </span>
            <h3 class="text-sm font-bold text-white">실시간 유망업종 기술적 지표 포착 관심종목</h3>
            <span class="text-xs text-slate-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 ml-2">
              총 {{ screenerStore.newData.length }}개 중 <strong class="text-emerald-400 font-bold">{{ screenerStore.matchedCount }}개 종목 85점+ 매수포착</strong>
            </span>
          </div>
          <div class="flex flex-wrap items-center gap-4 text-xs">
            <span class="text-slate-300 flex items-center gap-1.5 bg-slate-950/80 px-3 py-1 rounded-lg border border-indigo-500/40 shadow-sm">
              <i class="far fa-clock text-indigo-400"></i> 자료 갱신 일시: <strong class="text-emerald-400 font-mono">{{ screenerStore.lastUpdated || '실시간' }}</strong>
            </span>
            <span class="text-slate-300 flex items-center gap-1.5 bg-slate-950/80 px-3 py-1 rounded-lg border border-indigo-500/40 shadow-sm">
              <i class="fas fa-database text-indigo-400"></i> 자료수집처: <strong class="text-indigo-400">{{ screenerStore.sourceProvider }}</strong>
            </span>
          </div>
        </div>

        <div class="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/90 shadow-md">
          <table class="w-full text-xs text-left text-slate-300">
            <thead class="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[11px]">
              <tr>
                <th class="px-3 py-3">업종</th>
                <th class="px-3 py-3">종목코드</th>
                <th class="px-3 py-3">종목명</th>
                <th class="px-3 py-3">최신 현재가 (OLD 대비 변동)</th>
                <th class="px-3 py-3">심리선(12일)</th>
                <th class="px-3 py-3">볼린저 하단</th>
                <th class="px-3 py-3">이평선 상태</th>
                <th class="px-3 py-3">MACD 오실레이터</th>
                <th class="px-3 py-3">RSI(14일)</th>
                <th class="px-3 py-3">거래량 비율</th>
                <th class="px-3 py-3 text-center">실시간 퀀트 스코어</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60">
              <tr 
                v-for="item in screenerStore.newData" 
                :key="item.shcode"
                :class="item.score >= 85 ? 'bg-emerald-950/30 hover:bg-emerald-900/40 border-l-4 border-l-emerald-500' : 'hover:bg-slate-900/80'"
                class="transition-all border-b border-slate-800/40"
              >
                <td class="px-3 py-3"><span class="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold text-[10px]">{{ item.industry }}</span></td>
                <td class="px-3 py-3 font-mono text-slate-400">{{ item.shcode }}</td>
                <td class="px-3 py-3 font-bold text-white">{{ item.name }}</td>
                
                <!-- Price Display with Delta -->
                <td class="px-3 py-3 font-extrabold text-slate-100">
                  <div>{{ Number(item.closePrice).toLocaleString() }}원</div>
                  <div v-if="getPriceDelta(item)" class="text-[10px] font-bold" :class="getPriceDelta(item).class">
                    {{ getPriceDelta(item).text }}
                  </div>
                </td>

                <td class="px-3 py-3" :class="item.psy <= 25 ? 'text-emerald-400 font-extrabold' : 'text-slate-300'">
                  {{ item.psy }}% {{ item.psy <= 25 ? '(과매도)' : '' }}
                </td>
                <td class="px-3 py-3 font-mono text-slate-300 text-[11px]">{{ Number(item.bbLower).toLocaleString() }}원</td>
                <td class="px-3 py-3 text-emerald-400 font-semibold text-[11px]"><i class="fas fa-chart-line text-[10px] mr-1"></i> 정배열 지지</td>
                <td class="px-3 py-3 text-pink-400 font-bold">+{{ item.macdHist }}</td>
                <td class="px-3 py-3 text-cyan-400 font-bold">{{ item.rsi }}</td>
                <td class="px-3 py-3 font-bold" :class="item.volumeRatio >= 120 ? 'text-emerald-400' : 'text-slate-400'">
                  {{ item.volumeRatio }}% {{ item.volumeRatio >= 120 ? '🔥' : '' }}
                </td>
                
                <td class="px-3 py-3 text-center">
                  <span 
                    v-if="item.score >= 85" 
                    class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 inline-flex items-center gap-1 shadow-sm"
                  >
                    <i class="fas fa-check-circle"></i> 🎯 강력 매수 ({{ item.score }}점)
                  </span>
                  <span 
                    v-else-if="item.score >= 70" 
                    class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 inline-flex items-center gap-1"
                  >
                    👀 관심 관찰 ({{ item.score }}점)
                  </span>
                  <span v-else class="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">
                    일부 매칭 ({{ item.score }}점)
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { useScreenerStore, type StockItem } from '~/stores/useScreenerStore';

const screenerStore = useScreenerStore();

onMounted(async () => {
  if (screenerStore.newData.length === 0) {
    await screenerStore.refreshScreener();
  }
});

function getPriceDelta(newItem: StockItem) {
  const oldItem = screenerStore.oldData.find(o => o.shcode === newItem.shcode);
  if (!oldItem) return null;

  const diff = newItem.closePrice - oldItem.closePrice;
  if (diff > 0) {
    return { text: `▲ +${diff.toLocaleString()}원`, class: 'text-rose-400' };
  } else if (diff < 0) {
    return { text: `▼ ${diff.toLocaleString()}원`, class: 'text-emerald-400' };
  } else {
    return { text: `(= 변동없음)`, class: 'text-slate-400' };
  }
}
</script>
