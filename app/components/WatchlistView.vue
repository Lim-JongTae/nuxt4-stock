<template>
  <div class="p-6 max-w-7xl mx-auto space-y-6">
    <!-- Header Banner -->
    <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <span class="px-2.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-bold text-xs">
            <i class="fas fa-eye mr-1"></i> LS증권 관심종목 & 보유종목 모니터링
          </span>
        </div>
        <h1 class="text-2xl font-extrabold text-white">보유/관심종목 8대 지표 실시간 시세</h1>
        <p class="text-xs text-slate-400 mt-1">심리선(PSY), 거래량 수급 비율, 공매도 수급 상태 등 LS증권 API 실시간 파싱 데이터를 표기합니다.</p>
      </div>

      <button 
        @click="refresh" 
        :disabled="store.isLoading"
        class="px-5 py-2.5 bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 transition cursor-pointer active:scale-95 disabled:opacity-50"
      >
        <i class="fas" :class="store.isLoading ? 'fa-spinner fa-spin' : 'fa-sync-alt'"></i>
        <span>LS증권 실시간 새로고침</span>
      </button>
    </div>

    <!-- Error Alert Banner -->
    <div v-if="store.errorMessage" class="bg-rose-950/80 border border-rose-500/50 p-4 rounded-xl text-rose-300 text-xs shadow-lg flex items-center justify-between">
      <div class="flex items-center gap-2">
        <i class="fas fa-exclamation-triangle text-rose-400"></i>
        <span>{{ store.errorMessage }}</span>
      </div>
      <button @click="store.errorMessage = null" class="text-rose-400 font-bold">✕</button>
    </div>

    <!-- Watchlist Table -->
    <div class="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead class="bg-slate-950 text-slate-300 font-bold border-b border-slate-800">
            <tr>
              <th class="px-4 py-3 whitespace-nowrap">코드</th>
              <th class="px-4 py-3 whitespace-nowrap">종목명</th>
              <th class="px-4 py-3 whitespace-nowrap">구분</th>
              <th class="px-4 py-3 whitespace-nowrap">업종/분류</th>
              <th class="px-4 py-3 whitespace-nowrap">현재가 (LS증권)</th>
              <th class="px-4 py-3 text-purple-400 whitespace-nowrap">심리선 (PSY)</th>
              <th class="px-4 py-3 text-amber-400 whitespace-nowrap">거래량수급 (비율)</th>
              <th class="px-4 py-3 text-rose-400 whitespace-nowrap">공매도 수급</th>
              <th class="px-4 py-3 text-emerald-400 whitespace-nowrap">퀀트 스코어</th>
              <th class="px-4 py-3 text-right whitespace-nowrap">최종 갱신</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60 text-slate-200">
            <tr v-for="item in store.items" :key="item.shcode" class="hover:bg-slate-800/40 transition-all">
              <td class="px-4 py-3 font-mono font-bold text-indigo-300 whitespace-nowrap">{{ item.shcode }}</td>
              <td class="px-4 py-3 font-bold text-white whitespace-nowrap" :title="item.name">
                <NuxtLink :to="`/stock/${item.shcode}`" class="hover:text-cyan-300 hover:underline flex items-center gap-1.5">
                  <span>{{ truncateName(item.name, 13) }}</span>
                  <i class="fas fa-external-link-alt text-[10px] text-slate-500 shrink-0"></i>
                </NuxtLink>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span 
                  class="px-2 py-0.5 rounded text-[10px] font-bold border"
                  :class="item.type === 'holding' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'"
                >
                  {{ item.type === 'holding' ? '보유' : '관심' }}
                </span>
              </td>
              <td class="px-4 py-3 text-slate-400 whitespace-nowrap">{{ item.industry }}</td>
              <td class="px-4 py-3 font-mono font-bold text-cyan-300 text-sm whitespace-nowrap">
                {{ item.currentPrice > 0 ? Number(item.currentPrice).toLocaleString() + '원' : '조회 중...' }}
              </td>
              <td class="px-4 py-3 font-mono font-bold whitespace-nowrap">
                <span :class="typeof item.psy === 'number' && item.psy <= 25 ? 'text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30' : 'text-slate-300'">
                  {{ typeof item.psy === 'number' ? item.psy + '%' : '-' }}
                </span>
              </td>
              <td class="px-4 py-3 font-mono font-bold whitespace-nowrap">
                <span :class="typeof item.volumeRatio === 'number' && item.volumeRatio >= 120 ? 'text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/30' : 'text-slate-300'">
                  {{ typeof item.volumeRatio === 'number' ? item.volumeRatio + '%' : '-' }}
                </span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span 
                  v-if="isEtfItem(item)"
                  class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40"
                  title="ETF/ETN 상품은 LS증권 Open API (t1927) 공매도 분석 대상 제외 항목입니다"
                >
                  ETF/ETN (공매도 t1927 제외 종목)
                </span>
                <span 
                  v-else
                  class="px-2 py-0.5 rounded text-[10px] font-bold border"
                  :class="{
                    'bg-red-500/20 text-red-400 border-red-500/40': item.shortSellingStatus === '숏커버링(환매수) 유력',
                    'bg-pink-500/20 text-pink-400 border-pink-500/40': item.shortSellingStatus === '매수세가 공매도 흡수 중',
                    'bg-blue-500/20 text-blue-400 border-blue-500/40': item.shortSellingStatus === '신규 공매도 유입',
                    'bg-slate-800 text-slate-400 border-slate-700': !item.shortSellingStatus
                  }"
                >
                  {{ item.shortSellingStatus || '판단 보류' }}
                </span>
              </td>
              <td class="px-4 py-3 font-mono font-extrabold text-purple-300 whitespace-nowrap">
                {{ item.score ? item.score + '점' : '0점' }}
              </td>
              <td class="px-4 py-3 text-xs text-slate-500 text-right font-mono whitespace-nowrap">{{ item.updatedAt }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useWatchlistStore } from '@/stores/useWatchlistStore';

const store = useWatchlistStore();

onMounted(() => {
  store.loadInitial(false);
});

function refresh() {
  store.loadInitial(true);
}

function isEtfItem(item: any): boolean {
  if (!item) return false;
  const name = item.name || '';
  const ind = item.industry || '';
  const etfKeywords = ['KODEX', 'TIGER', 'ACE', 'SOL', 'RISE', 'KoAct', 'PLUS', 'HANARO', 'WOORI', 'UNICORN', 'TIMEFOLIO', 'HERO', 'KBSTAR', 'ARIRANG', 'ETF', 'ETN'];
  return ind.includes('ETF') || ind.includes('ETN') || etfKeywords.some(k => name.includes(k));
}

function truncateName(name: string, maxLen: number = 13): string {
  if (!name) return '';
  return name.length > maxLen ? `${name.slice(0, maxLen)}...` : name;
}
</script>
