<template>
  <UCard variant="subtle" class="bg-slate-900/80 border-slate-800 rounded-2xl shadow-xl space-y-4">
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <i class="fas fa-table text-cyan-400"></i>
          <span>📊 전 종목 8대 기술적 지표 & 퀀트 배점 매트릭스 (Nuxt UI UTable)</span>
        </h3>
        <UBadge color="primary" variant="subtle" class="text-xs">
          Store 중앙집중 관리
        </UBadge>
      </div>
    </template>

    <div class="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/90 shadow-md">
      <UTable 
        :columns="(columns as any)" 
        :data="(formattedRows as any)"
        class="w-full text-xs text-left"
      >
        <!-- Custom Industry Cell -->
        <template #industry-cell="{ row }: any">
          <UBadge color="primary" variant="subtle" size="xs" class="font-bold">
            {{ row.industry }}
          </UBadge>
        </template>

        <!-- Custom Shcode Cell -->
        <template #shcode-cell="{ row }: any">
          <span class="font-mono text-slate-400">{{ row.shcode }}</span>
        </template>

        <!-- Custom Name Cell -->
        <template #name-cell="{ row }: any">
          <button 
            @click="$emit('select-stock', row.original)"
            class="font-bold text-white hover:text-purple-300 hover:underline cursor-pointer text-left"
          >
            {{ row.name }}
          </button>
        </template>

        <!-- Custom ClosePrice Cell -->
        <template #closePrice-cell="{ row }: any">
          <span class="font-bold font-mono text-slate-100">
            {{ Number(row.closePrice).toLocaleString() }}원
          </span>
        </template>

        <!-- Custom Psy Cell -->
        <template #psy-cell="{ row }: any">
          <span class="font-mono" :class="row.original?.psy && row.original.psy <= 25 ? 'text-emerald-400 font-bold' : 'text-slate-300'">
            {{ row.original?.psy ?? '-' }}%
          </span>
        </template>

        <!-- Custom BbLower Cell -->
        <template #bbLower-cell="{ row }: any">
          <span class="font-mono text-slate-300">
            {{ row.original?.bbLower ? Number(row.original.bbLower).toLocaleString() + '원' : '-' }}
          </span>
        </template>

        <!-- Custom MaSignal Cell -->
        <template #maSignal-cell="{ row }: any">
          <span class="font-mono" :class="row.original?.ma5 && row.original?.ma20 && row.original.ma5 >= row.original.ma20 ? 'text-emerald-400 font-bold' : 'text-sky-400'">
            {{ row.original?.ma5 && row.original?.ma20 && row.original.ma5 >= row.original.ma20 ? '🟢 우상향' : '☁️ 보합' }}
          </span>
        </template>

        <!-- Custom VolumeRatio Cell -->
        <template #volumeRatio-cell="{ row }: any">
          <span class="font-mono" :class="row.original?.volumeRatio && row.original.volumeRatio >= 120 ? 'text-rose-400 font-bold' : 'text-slate-300'">
            {{ row.original?.volumeRatio ?? '-' }}%
          </span>
        </template>

        <!-- Custom MacdHist Cell -->
        <template #macdHist-cell="{ row }: any">
          <span class="font-mono" :class="row.original?.macdHist && row.original.macdHist > 0 ? 'text-rose-400 font-bold' : 'text-blue-400'">
            {{ row.original?.macdHist ?? '양전' }}
          </span>
        </template>

        <!-- Custom Rsi Cell -->
        <template #rsi-cell="{ row }: any">
          <span class="font-mono" :class="row.original?.rsi && row.original.rsi <= 30 ? 'text-emerald-400 font-bold' : 'text-slate-300'">
            {{ row.original?.rsi ?? '-' }}
          </span>
        </template>

        <!-- Custom ShortSellingStatus Cell -->
        <template #shortSellingStatus-cell="{ row }: any">
          <span class="font-bold text-[11px]" :class="row.original?.shortSellingStatus?.includes('COVERING') ? 'text-rose-400' : 'text-cyan-300'">
            {{ row.original?.shortSellingStatus || '수급 안정' }}
          </span>
        </template>

        <!-- Custom Score Cell -->
        <template #score-cell="{ row }: any">
          <div class="text-center">
            <UBadge 
              :color="row.score >= 85 ? 'emerald' : 'neutral'" 
              variant="solid" 
              size="md" 
              class="font-extrabold cursor-pointer"
              @click="$emit('select-stock', row.original)"
            >
              {{ row.score }}점
            </UBadge>
          </div>
        </template>
      </UTable>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { StockItem } from '~/stores/useScreenerStore';

const props = defineProps<{
  stockList: StockItem[];
  activeShcode: string;
}>();

defineEmits<{
  (e: 'select-stock', item: StockItem): void;
}>();

const columns = [
  { key: 'industry', label: '업종' },
  { key: 'shcode', label: '종목코드' },
  { key: 'name', label: '종목명' },
  { key: 'closePrice', label: '현재가' },
  { key: 'psy', label: '심리선(12일)' },
  { key: 'bbLower', label: '볼린저 하단' },
  { key: 'maSignal', label: '이평선 5/20/60' },
  { key: 'volumeRatio', label: '거래량비율' },
  { key: 'macdHist', label: 'MACD' },
  { key: 'rsi', label: 'RSI(14)' },
  { key: 'shortSellingStatus', label: '수급 상태' },
  { key: 'score', label: '퀀트 스코어' }
];

const formattedRows = computed(() => {
  return props.stockList.map(item => ({
    industry: item.industry || '기타',
    shcode: item.shcode,
    name: item.name,
    closePrice: item.closePrice,
    psy: item.psy,
    bbLower: item.bbLower,
    maSignal: item.ma5 && item.ma20 && item.ma5 >= item.ma20 ? '우상향' : '보합',
    volumeRatio: item.volumeRatio,
    macdHist: item.macdHist,
    rsi: item.rsi,
    shortSellingStatus: item.shortSellingStatus || '수급 안정',
    score: item.score,
    original: item
  }));
});
</script>
