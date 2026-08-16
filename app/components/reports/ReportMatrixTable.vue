<template>
  <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
    <div class="flex items-center justify-between border-b border-slate-800 pb-3">
      <h3 class="text-base font-bold text-white flex items-center gap-2">
        <i class="fas fa-table text-cyan-400"></i>
        <span>📊 전 종목 8대 기술적 지표 & 퀀트 배점 매트릭스</span>
      </h3>
      <span class="px-2.5 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-bold">
        Store 중앙집중 관리
      </span>
    </div>

    <div class="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/90 shadow-md">
      <table class="w-full text-xs text-left text-slate-300">
        <thead class="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[11px]">
          <tr>
            <th class="px-3 py-3">업종</th>
            <th class="px-3 py-3">종목코드</th>
            <th class="px-3 py-3">종목명</th>
            <th class="px-3 py-3">현재가</th>
            <th class="px-3 py-3">심리선(12일)</th>
            <th class="px-3 py-3">볼린저 하단</th>
            <th class="px-3 py-3">이평선 5/20/60</th>
            <th class="px-3 py-3">거래량비율</th>
            <th class="px-3 py-3">MACD</th>
            <th class="px-3 py-3">RSI(14)</th>
            <th class="px-3 py-3">수급 상태</th>
            <th class="px-3 py-3 text-center">퀀트 스코어</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800/60">
          <tr 
            v-for="item in stockList" 
            :key="item.shcode"
            :class="[
              item.shcode === activeShcode ? 'bg-purple-950/40 border-l-4 border-l-purple-500' : 'hover:bg-slate-900/80',
              item.score >= 85 ? 'bg-emerald-950/20' : ''
            ]"
            class="transition-all"
          >
            <!-- 업종 -->
            <td class="px-3 py-3">
              <span class="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold text-[10px]">
                {{ item.industry || '기타' }}
              </span>
            </td>

            <!-- 종목코드 -->
            <td class="px-3 py-3 font-mono text-slate-400">
              {{ item.shcode }}
            </td>

            <!-- 종목명 -->
            <td class="px-3 py-3 font-bold text-white">
              <button 
                @click="$emit('select-stock', item)"
                class="font-bold text-indigo-300 hover:text-white hover:underline cursor-pointer text-left flex items-center gap-1 group"
              >
                <span>{{ item.name }}</span>
                <i class="fas fa-arrow-right text-[9px] text-indigo-400 opacity-60 group-hover:opacity-100"></i>
              </button>
            </td>

            <!-- 현재가 -->
            <td class="px-3 py-3 font-bold font-mono text-slate-100">
              {{ Number(item.closePrice).toLocaleString() }}원
            </td>

            <!-- 심리선 -->
            <td class="px-3 py-3 font-mono" :class="typeof item.psy === 'number' && item.psy <= 25 ? 'text-emerald-400 font-bold' : 'text-slate-300'">
              {{ typeof item.psy === 'number' ? item.psy + '%' : '-' }}
            </td>

            <!-- 볼린저 하단 -->
            <td class="px-3 py-3 font-mono text-slate-300">
              {{ item.bbLower ? Number(item.bbLower).toLocaleString() + '원' : '-' }}
            </td>

            <!-- 이평선 -->
            <td class="px-3 py-3 font-mono text-emerald-400 font-semibold">
              <span v-if="item.ma5 && item.ma20 && item.ma5 >= item.ma20">🟢 우상향 지지</span>
              <span v-else class="text-slate-400 font-normal">☁️ 보합</span>
            </td>

            <!-- 거래량비율 -->
            <td class="px-3 py-3 font-mono" :class="typeof item.volumeRatio === 'number' && item.volumeRatio >= 120 ? 'text-amber-400 font-extrabold' : 'text-slate-300'">
              {{ typeof item.volumeRatio === 'number' ? item.volumeRatio + '%' : '-' }}
            </td>

            <!-- MACD -->
            <td class="px-3 py-3 font-mono" :class="typeof item.macdHist === 'number' && item.macdHist > 0 ? 'text-pink-400 font-bold' : 'text-blue-400'">
              {{ typeof item.macdHist === 'number' ? (item.macdHist > 0 ? '+' + item.macdHist : item.macdHist) : '-' }}
            </td>

            <!-- RSI -->
            <td class="px-3 py-3 font-mono" :class="typeof item.rsi === 'number' && item.rsi <= 30 ? 'text-emerald-400 font-bold' : 'text-slate-300'">
              {{ typeof item.rsi === 'number' ? item.rsi : '-' }}
            </td>

            <!-- 수급 상태 -->
            <td class="px-3 py-3 font-bold text-[11px]">
              <span 
                class="px-2 py-0.5 rounded text-[10px] font-semibold"
                :class="{
                  'bg-red-500/20 text-red-400 border border-red-500/40': item.shortSellingStatus === '숏커버링(환매수) 유력',
                  'bg-blue-500/20 text-blue-400 border border-blue-500/40': item.shortSellingStatus === '신규 공매도 유입',
                  'bg-pink-500/20 text-pink-400 border border-pink-500/40': item.shortSellingStatus === '매수세가 공매도 흡수 중',
                  'bg-slate-900 text-slate-300 border border-slate-700': !['숏커버링(환매수) 유력', '신규 공매도 유입', '매수세가 공매도 흡수 중'].includes(item.shortSellingStatus || '')
                }"
              >
                {{ item.shortSellingStatus || '판단 보류' }}
              </span>
            </td>

            <!-- 퀀트 스코어 -->
            <td class="px-3 py-3 text-center">
              <button 
                @click="$emit('select-stock', item)"
                class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer transition-all active:scale-95"
                :class="item.score >= 85 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-300 border border-slate-700'"
              >
                {{ item.score }}점
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { StockItem } from '~/stores/useScreenerStore';

defineProps<{
  stockList: StockItem[];
  activeShcode: string;
}>();

defineEmits<{
  (e: 'select-stock', item: StockItem): void;
}>();
</script>
