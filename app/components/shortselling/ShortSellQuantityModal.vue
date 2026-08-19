<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
    <section class="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl flex flex-col gap-4">
      <header class="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 class="text-base font-extrabold text-white">공매도수량 CSV 입력</h3>
          <p class="mt-0.5 text-xs text-slate-400">{{ stockName || '종목명을 입력하세요' }} · 날짜, 공매도 거래량, 순보유 잔고수량만 관리합니다.</p>
        </div>
        <button type="button" class="rounded-lg px-2 py-1 text-sm font-bold text-slate-400 hover:bg-slate-800 hover:text-white" @click="emit('close')">닫기</button>
      </header>

      <div class="flex flex-wrap items-end gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
        <label class="flex min-w-56 flex-1 flex-col gap-1 text-xs font-semibold text-slate-300">
          종목명
          <input v-model.trim="editableStockName" type="text" placeholder="예: sk텔레콤" class="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" @keyup.enter="loadRecords" />
        </label>
        <button type="button" class="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50" :disabled="isLoading || !editableStockName" @click="loadRecords">
          {{ isLoading ? '불러오는 중...' : 'CSV 불러오기' }}
        </button>
      </div>

      <p v-if="errorMessage" class="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-300">{{ errorMessage }}</p>
      <p v-else-if="hasLoaded && !csvExists" class="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-bold text-amber-300">CSV 파일 없음</p>

      <template v-if="hasLoaded">
        <form class="grid grid-cols-1 gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3 md:grid-cols-4" @submit.prevent="addRecord">
          <label class="flex flex-col gap-1 text-xs font-semibold text-slate-300">
            날짜
            <input v-model="form.date" type="date" :max="today" required class="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
          </label>
          <label class="flex flex-col gap-1 text-xs font-semibold text-slate-300">
            공매도 거래량
            <input v-model="form.shortSellingVolume" type="number" min="0" step="1" required class="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
          </label>
          <label class="flex flex-col gap-1 text-xs font-semibold text-slate-300">
            순보유 잔고수량
            <input v-model="form.netShortBalanceQuantity" type="number" min="0" step="1" required class="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
          </label>
          <button type="submit" class="rounded-lg border border-cyan-500/50 bg-cyan-500/15 px-4 py-2 text-sm font-bold text-cyan-200 hover:bg-cyan-500/25">기록 추가</button>
        </form>

        <div class="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-800">
          <table class="w-full min-w-[620px] text-left text-sm">
            <thead class="sticky top-0 bg-slate-800 text-xs text-slate-300">
              <tr>
                <th class="px-4 py-3">날짜</th>
                <th class="px-4 py-3 text-right">공매도 거래량</th>
                <th class="px-4 py-3 text-right">순보유 잔고수량</th>
                <th class="w-20 px-4 py-3 text-center">삭제</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="records.length === 0"><td colspan="4" class="px-4 py-10 text-center text-slate-500">입력된 기록이 없습니다.</td></tr>
              <tr v-for="record in records" :key="record.date" class="border-t border-slate-800 hover:bg-slate-800/40">
                <td class="px-4 py-2"><input v-model="record.date" type="date" :max="today" class="rounded border border-transparent bg-transparent py-1 text-slate-100 outline-none focus:border-cyan-500" /></td>
                <td class="px-4 py-2 text-right"><input v-model.number="record.shortSellingVolume" type="number" min="0" step="1" class="w-36 rounded border border-transparent bg-transparent py-1 text-right font-mono text-rose-300 outline-none focus:border-cyan-500" /></td>
                <td class="px-4 py-2 text-right"><input v-model.number="record.netShortBalanceQuantity" type="number" min="0" step="1" class="w-36 rounded border border-transparent bg-transparent py-1 text-right font-mono text-cyan-300 outline-none focus:border-cyan-500" /></td>
                <td class="px-4 py-2 text-center"><button type="button" class="text-xs font-bold text-rose-400 hover:text-rose-300" @click="removeRecord(record.date)">삭제</button></td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer class="flex items-center justify-between gap-3">
          <p class="text-xs text-slate-500">저장하면 CSV는 `일자, 공매도 거래량, 순보유 잔고수량` 3개 열로 정리됩니다.</p>
          <button type="button" class="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50" :disabled="isSaving || !editableStockName" @click="saveRecords">
            {{ isSaving ? '저장 중...' : 'CSV 저장' }}
          </button>
        </footer>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { ShortSellQuantityCsvRecord, ShortSellQuantityCsvResponse } from '~/utils/types/lsSecurities';

const props = defineProps<{ isOpen: boolean; stockName?: string }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const today = '2026-08-19';
const editableStockName = ref('');
const records = ref<ShortSellQuantityCsvRecord[]>([]);
const csvExists = ref(false);
const hasLoaded = ref(false);
const isLoading = ref(false);
const isSaving = ref(false);
const errorMessage = ref('');
const form = ref({ date: today, shortSellingVolume: '', netShortBalanceQuantity: '' });

function sortRecords() {
  records.value.sort((a, b) => b.date.localeCompare(a.date));
}

async function loadRecords() {
  if (!editableStockName.value) return;
  isLoading.value = true;
  errorMessage.value = '';
  try {
    const response = await $fetch<ShortSellQuantityCsvResponse>('/api/short-selling/quantity', { query: { stockName: editableStockName.value } });
    csvExists.value = response.csvExists;
    records.value = response.records.map(record => ({ ...record }));
    sortRecords();
    hasLoaded.value = true;
  } catch (error: any) {
    errorMessage.value = error.statusMessage || error.message || 'CSV를 불러오지 못했습니다.';
    hasLoaded.value = false;
  } finally {
    isLoading.value = false;
  }
}

function addRecord() {
  const date = form.value.date;
  const shortSellingVolume = Number(form.value.shortSellingVolume);
  const netShortBalanceQuantity = Number(form.value.netShortBalanceQuantity);
  if (!date || !Number.isSafeInteger(shortSellingVolume) || shortSellingVolume < 0 || !Number.isSafeInteger(netShortBalanceQuantity) || netShortBalanceQuantity < 0) {
    errorMessage.value = '날짜와 0 이상의 정수 수량을 입력하세요.';
    return;
  }
  if (records.value.some(record => record.date === date)) {
    errorMessage.value = '같은 날짜의 기록이 이미 있습니다.';
    return;
  }
  records.value.push({ date, shortSellingVolume, netShortBalanceQuantity });
  sortRecords();
  errorMessage.value = '';
  form.value = { date: today, shortSellingVolume: '', netShortBalanceQuantity: '' };
}

function removeRecord(date: string) {
  records.value = records.value.filter(record => record.date !== date);
}

async function saveRecords() {
  isSaving.value = true;
  errorMessage.value = '';
  try {
    const response = await $fetch<ShortSellQuantityCsvResponse>('/api/short-selling/quantity', {
      method: 'PUT',
      body: { stockName: editableStockName.value, records: records.value }
    });
    records.value = response.records.map(record => ({ ...record }));
    csvExists.value = true;
    hasLoaded.value = true;
    sortRecords();
  } catch (error: any) {
    errorMessage.value = error.statusMessage || error.message || 'CSV를 저장하지 못했습니다.';
  } finally {
    isSaving.value = false;
  }
}

watch(() => props.isOpen, (isOpen) => {
  if (!isOpen) return;
  editableStockName.value = props.stockName || '';
  records.value = [];
  csvExists.value = false;
  hasLoaded.value = false;
  errorMessage.value = '';
  if (editableStockName.value) loadRecords();
});
</script>
