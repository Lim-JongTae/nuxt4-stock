<template>
  <UCard variant="subtle" class="bg-slate-900/80 border-slate-800 rounded-2xl shadow-xl space-y-4">
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <i class="fas fa-table text-cyan-400"></i>
          <span>📊 '8대지표_과매도반등_퀀트' 조건검색 발굴 매트릭스 (Nuxt UI)</span>
        </h3>
        <UBadge color="neutral" variant="subtle" class="text-xs">t1859 ➔ 2차 8대 지표 수급 파싱</UBadge>
      </div>
    </template>

    <div v-if="items.length === 0" class="bg-slate-950/60 p-8 rounded-xl text-center text-slate-400 text-xs space-y-2 border border-slate-800">
      <i class="fas fa-info-circle text-amber-400 text-lg"></i>
      <p>상단 [🔍 조건검색 실행] 버튼을 누르시거나 장 운영시간(08:00~20:00)에 실행하시면 실시간 스크리닝 종목이 표출됩니다.</p>
    </div>

    <div v-else class="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/90 shadow-md">
      <table class="w-full text-xs text-left text-slate-300">
        <thead class="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800 text-[11px]">
          <tr>
            <th class="px-3 py-3">분류</th>
            <th class="px-3 py-3">종목코드</th>
            <th class="px-3 py-3">종목명</th>
            <th class="px-3 py-3">현재가</th>
            <th class="px-3 py-3">심리선(12일)</th>
            <th class="px-3 py-3">볼린저 하단</th>
            <th class="px-3 py-3">거래량비율</th>
            <th class="px-3 py-3">MACD</th>
            <th class="px-3 py-3">RSI(14)</th>
            <th class="px-3 py-3">공매도 2차 검증</th>
            <th class="px-3 py-3 text-center">퀀트 점수</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800/60">
          <tr 
            v-for="item in items" 
            :key="item.shcode"
            @click="$emit('select-stock', item)"
            class="hover:bg-slate-900 cursor-pointer transition-colors"
            :class="activeShcode === item.shcode ? 'bg-purple-950/40 border-l-4 border-l-purple-500' : ''"
          >
            <td class="px-3 py-3">
              <UBadge color="success" variant="subtle" size="xs">조건검색</UBadge>
            </td>
            <td class="px-3 py-3 font-mono text-slate-400">{{ item.shcode }}</td>
            <td class="px-3 py-3 font-bold text-white group-hover:text-purple-300">{{ item.name }}</td>
            <td class="px-3 py-3 font-bold text-slate-100 font-mono">{{ Number(item.closePrice).toLocaleString() }}원</td>
            <td class="px-3 py-3 font-mono" :class="item.psy && item.psy <= 25 ? 'text-emerald-400 font-bold' : ''">{{ item.psy ?? '-' }}%</td>
            <td class="px-3 py-3 font-mono text-slate-300">{{ item.bbLower ? Number(item.bbLower).toLocaleString() + '원' : '-' }}</td>
            <td class="px-3 py-3 font-mono" :class="item.volumeRatio && item.volumeRatio >= 120 ? 'text-amber-400 font-bold' : ''">{{ item.volumeRatio ?? '-' }}%</td>
            <td class="px-3 py-3 font-mono" :class="item.macdHist && item.macdHist > 0 ? 'text-emerald-400' : ''">{{ item.macdHist ?? '양전' }}</td>
            <td class="px-3 py-3 font-mono" :class="item.rsi && item.rsi <= 30 ? 'text-emerald-400 font-bold' : ''">{{ item.rsi ?? '-' }}</td>
            <td class="px-3 py-3 text-cyan-300 font-bold text-[11px]">{{ item.shortSellingStatus || '판단 보류' }}</td>
            <td class="px-3 py-3 text-center">
              <UBadge :color="item.score >= 85 ? 'success' : 'neutral'" variant="solid" size="md" class="font-extrabold">
                {{ item.score }}점
              </UBadge>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </UCard>
</template>

<script setup lang="ts">
export interface ConditionStockItem {
  shcode: string;
  name: string;
  industry: string;
  closePrice: number;
  score: number;
  psy?: number;
  rsi?: number;
  bbLower?: number;
  volumeRatio?: number;
  macdHist?: number;
  shortSellingStatus?: string;
}

defineProps<{
  items: ConditionStockItem[];
  activeShcode: string;
}>();

defineEmits<{
  (e: 'select-stock', item: ConditionStockItem): void;
}>();
</script>
