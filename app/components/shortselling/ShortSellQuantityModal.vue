<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
    <UCard variant="outline" class="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border-slate-700/80 bg-slate-900 shadow-2xl flex flex-col p-0">
      
      <!-- Header -->
      <template #header>
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base font-extrabold text-white flex items-center gap-2">
              <i class="fas fa-file-csv text-cyan-400"></i>
              공매도수량 CSV 관리
            </h3>
            <p class="mt-0.5 text-xs text-slate-400">
              <template v-if="showFileList">저장된 CSV 파일을 선택하거나 새로 생성하세요</template>
              <template v-else>{{ editableStockName || '종목명을 입력하세요' }} · 날짜, 공매도 거래량, 순보유 잔고수량만 관리합니다.</template>
            </p>
          </div>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            class="font-bold text-slate-400 hover:text-white cursor-pointer"
            @click="emit('close')"
          >
            ✕ 닫기
          </UButton>
        </div>
      </template>

      <!-- Body Content -->
      <div class="space-y-4 p-5 overflow-auto max-h-[calc(90vh-140px)]">

        <!-- 파일 목록 선택 화면 -->
        <template v-if="showFileList">
          <div class="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <h4 class="text-sm font-bold text-white flex items-center gap-2">
              <i class="fas fa-folder-open text-cyan-400"></i>
              저장된 CSV 파일 목록
            </h4>
            <UButton
              color="neutral"
              variant="subtle"
              size="xs"
              :loading="isLoadingFiles"
              class="font-bold cursor-pointer"
              @click="loadAvailableFiles"
            >
              <i class="fas" :class="isLoadingFiles ? 'fa-spinner fa-spin' : 'fa-sync-alt'"></i>
              {{ isLoadingFiles ? '새로고침 중...' : '새로고침' }}
            </UButton>
          </div>

          <UAlert
            v-if="errorMessage"
            color="error"
            variant="subtle"
            class="font-semibold text-xs"
            :title="errorMessage"
            icon="fas fa-exclamation-triangle"
          />

          <div v-if="isLoadingFiles" class="text-center py-12 text-slate-400 text-sm flex flex-col items-center justify-center gap-3">
            <i class="fas fa-spinner fa-spin text-cyan-400 text-2xl"></i>
            <span>파일 목록을 불러오는 중입니다...</span>
          </div>

          <div v-else-if="availableFiles.length === 0" class="text-center py-12 text-slate-500 text-sm flex flex-col items-center gap-3">
            <i class="fas fa-inbox text-slate-600 text-3xl"></i>
            <span>저장된 CSV 파일이 없습니다.</span>
            <UButton
              color="success"
              variant="solid"
              size="sm"
              class="mt-2 font-bold cursor-pointer"
              @click="showNewFileInput"
            >
              <i class="fas fa-plus-circle mr-1"></i>
              새 종목 CSV 생성
            </UButton>
          </div>

          <div v-else class="space-y-2 max-h-96 overflow-auto pr-1">
            <button
              v-for="file in availableFiles"
              :key="file.stockName"
              type="button"
              class="w-full text-left p-4 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800/60 hover:border-cyan-500/40 transition-all flex items-center justify-between group cursor-pointer"
              @click="selectFile(file)"
            >
              <div class="flex-1">
                <div class="font-bold text-white text-sm mb-1 flex items-center gap-2">
                  <i class="fas fa-file-csv text-cyan-400"></i>
                  {{ file.stockName }}
                  <UBadge color="error" variant="subtle" size="xs" class="font-mono font-bold">
                    {{ file.recordCount || 0 }}건
                  </UBadge>
                </div>
                <div class="text-xs text-slate-400">
                  <i class="fas fa-clock text-slate-500 mr-1"></i>
                  마지막 수정: {{ formatDate(file.modifiedAt) }}
                </div>
              </div>
              <i class="fas fa-chevron-right text-slate-600 group-hover:text-cyan-400 transition-colors"></i>
            </button>
          </div>

          <div v-if="availableFiles.length > 0" class="text-center border-t border-slate-800 pt-4">
            <UButton
              color="success"
              variant="subtle"
              size="sm"
              class="font-bold cursor-pointer mx-auto"
              @click="showNewFileInput"
            >
              <i class="fas fa-plus-circle mr-1"></i>
              새 종목 CSV 생성
            </UButton>
          </div>
        </template>

        <!-- CSV 편집 화면 -->
        <template v-else>
          <div class="flex items-center justify-between gap-3">
            <UButton
              color="neutral"
              variant="subtle"
              size="xs"
              class="font-bold cursor-pointer"
              @click="backToFileList"
            >
              <i class="fas fa-arrow-left mr-1"></i>
              파일 목록으로 돌아가기
            </UButton>
            <UButton
              color="success"
              variant="solid"
              size="sm"
              class="font-bold cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-emerald-50"
              :loading="isSaving"
              :disabled="!editableStockName"
              @click="saveRecords"
            >
              <i class="fas fa-save mr-1"></i>
              {{ isSaving ? '저장 중...' : 'CSV 저장' }}
            </UButton>
          </div>

          <div class="flex flex-wrap items-end gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <div class="flex min-w-56 flex-1 flex-col gap-1 text-xs font-semibold text-slate-300">
              <label>종목명</label>
              <UInput
                v-model.trim="editableStockName"
                type="text"
                placeholder="예: sk텔레콤"
                color="primary"
                size="sm"
                class="w-full"
                @keyup.enter="loadRecords"
              />
            </div>
            <UButton
              color="primary"
              variant="solid"
              size="sm"
              class="font-bold cursor-pointer"
              :loading="isLoading"
              :disabled="!editableStockName"
              @click="loadRecords"
            >
              {{ isLoading ? '불러오는 중...' : 'CSV 불러오기' }}
            </UButton>
          </div>

          <UAlert
            v-if="errorMessage"
            color="error"
            variant="subtle"
            class="font-semibold text-xs"
            :title="errorMessage"
            icon="fas fa-exclamation-triangle"
          />
          <UAlert
            v-else-if="hasLoaded && !csvExists"
            color="warning"
            variant="subtle"
            class="font-bold text-xs"
            title="CSV 파일 없음"
            icon="fas fa-info-circle"
          />

          <template v-if="hasLoaded">
            <form class="grid grid-cols-1 gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3 md:grid-cols-4 items-end" @submit.prevent="addRecord">
              <div class="flex flex-col gap-1 text-xs font-semibold text-slate-300">
                <label>날짜</label>
                <UInput
                  v-model="form.date"
                  type="date"
                  :max="today"
                  required
                  color="primary"
                  size="sm"
                  class="w-full"
                />
              </div>
              <div class="flex flex-col gap-1 text-xs font-semibold text-slate-300">
                <label>공매도 거래량</label>
                <UInput
                  v-model="form.shortSellingVolume"
                  type="number"
                  min="0"
                  step="1"
                  required
                  placeholder="0"
                  color="primary"
                  size="sm"
                  class="w-full"
                />
              </div>
              <div class="flex flex-col gap-1 text-xs font-semibold text-slate-300">
                <label>순보유 잔고수량</label>
                <UInput
                  v-model="form.netShortBalanceQuantity"
                  type="number"
                  min="0"
                  step="1"
                  required
                  placeholder="0"
                  color="primary"
                  size="sm"
                  class="w-full"
                />
              </div>
              <UButton
                type="submit"
                color="primary"
                variant="subtle"
                size="sm"
                class="font-bold cursor-pointer w-full justify-center"
              >
                기록 추가
              </UButton>
            </form>

            <div class="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-800">
              <table class="w-full min-w-155 text-left text-sm">
                <thead class="sticky top-0 bg-slate-800 text-xs text-slate-300">
                  <tr>
                    <th class="px-4 py-3">날짜</th>
                    <th class="px-4 py-3 text-right">공매도 거래량</th>
                    <th class="px-4 py-3 text-right">순보유 잔고수량</th>
                    <th class="w-24 px-4 py-3 text-center whitespace-nowrap">삭제</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/60">
                  <tr v-if="records.length === 0">
                    <td colspan="4" class="px-4 py-10 text-center text-slate-500">입력된 기록이 없습니다.</td>
                  </tr>
                  <tr v-for="record in records" :key="record.date" class="hover:bg-slate-800/40">
                    <td class="px-4 py-2">
                      <UInput
                        v-model="record.date"
                        type="date"
                        :max="today"
                        variant="none"
                        size="xs"
                        class="text-slate-100 font-mono"
                      />
                    </td>
                    <td class="px-4 py-2 text-right">
                      <input
                        v-if="isEditing(record.date, 'volume')"
                        v-model.number="record.shortSellingVolume"
                        type="number"
                        min="0"
                        step="1"
                        :data-cell="`${record.date}-volume`"
                        class="w-full rounded border border-cyan-500 bg-slate-900 py-1 px-2 text-right font-mono text-rose-300 outline-none"
                        @blur="stopEdit"
                        @keyup.enter="stopEdit"
                      />
                      <div v-else class="font-mono text-rose-300 cursor-pointer py-1 hover:underline" @click="startEdit(record.date, 'volume')">
                        {{ formatNumber(record.shortSellingVolume) }}
                      </div>
                    </td>
                    <td class="px-4 py-2 text-right">
                      <input
                        v-if="isEditing(record.date, 'balance')"
                        v-model.number="record.netShortBalanceQuantity"
                        type="number"
                        min="0"
                        step="1"
                        :data-cell="`${record.date}-balance`"
                        class="w-full rounded border border-cyan-500 bg-slate-900 py-1 px-2 text-right font-mono text-cyan-300 outline-none"
                        @blur="stopEdit"
                        @keyup.enter="stopEdit"
                      />
                      <div v-else class="font-mono text-cyan-300 cursor-pointer py-1 hover:underline" @click="startEdit(record.date, 'balance')">
                        {{ formatNumber(record.netShortBalanceQuantity) }}
                      </div>
                    </td>
                    <td class="px-2 py-2 text-center whitespace-nowrap">
                      <UButton color="error" variant="ghost" size="xs" class="font-bold cursor-pointer whitespace-nowrap inline-flex items-center" @click="removeRecord(record.date)"><UIcon name="i-lucide-trash" class="text-base text-rose-400 mr-1 shrink-0" /><span>삭제</span></UButton>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <footer class="pt-2">
              <p class="text-xs text-slate-500">저장하면 CSV는 `일자, 공매도 거래량, 순보유 잔고수량` 3개 열로 정리됩니다.</p>
            </footer>
          </template>
        </template>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { ShortSellQuantityCsvRecord, ShortSellQuantityCsvResponse, ShortSellCsvFileInfo, ShortSellCsvListResponse } from '../../../utils/types/lsSecurities';

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

// 파일 목록 관련 상태
const showFileList = ref(true);
const availableFiles = ref<ShortSellCsvFileInfo[]>([]);
const isLoadingFiles = ref(false);
const editingCell = ref<string | null>(null);

function startEdit(recordDate: string, field: 'volume' | 'balance') {
  editingCell.value = `${recordDate}-${field}`;
  // nextTick으로 포커스 설정
  setTimeout(() => {
    const input = document.querySelector<HTMLInputElement>(`input[data-cell="${recordDate}-${field}"]`);
    if (input) input.focus();
  }, 0);
}

function stopEdit() {
  editingCell.value = null;
}

function isEditing(recordDate: string, field: 'volume' | 'balance'): boolean {
  return editingCell.value === `${recordDate}-${field}`;
}

function sortRecords() {
  records.value.sort((a: ShortSellQuantityCsvRecord, b: ShortSellQuantityCsvRecord) => b.date.localeCompare(a.date));
}

async function loadAvailableFiles() {
  isLoadingFiles.value = true;
  errorMessage.value = '';
  try {
    const response = await $fetch<ShortSellCsvListResponse>('/api/short-selling/list');
    availableFiles.value = response.files;
  } catch (error: any) {
    errorMessage.value = error.statusMessage || error.message || '파일 목록을 불러올 수 없습니다.';
  } finally {
    isLoadingFiles.value = false;
  }
}

function selectFile(file: ShortSellCsvFileInfo) {
  editableStockName.value = file.stockName;
  showFileList.value = false;
  loadRecords();
}

function backToFileList() {
  showFileList.value = true;
  hasLoaded.value = false;
  records.value = [];
  errorMessage.value = '';
  editableStockName.value = '';
  loadAvailableFiles();
}

function showNewFileInput() {
  showFileList.value = false;
  hasLoaded.value = true;
  editableStockName.value = '';
  records.value = [];
  csvExists.value = false;
  errorMessage.value = '';
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function formatNumber(value: number | string): string {
  const num = typeof value === 'string' ? Number(value) : value;
  if (isNaN(num)) return '0';
  return num.toLocaleString('ko-KR');
}

async function loadRecords() {
  if (!editableStockName.value) return;
  isLoading.value = true;
  errorMessage.value = '';
  try {
    const response = await $fetch<ShortSellQuantityCsvResponse>('/api/short-selling/quantity', { query: { stockName: editableStockName.value } });
    csvExists.value = response.csvExists;
    records.value = response.records.map((record: ShortSellQuantityCsvRecord) => ({ ...record }));
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
  if (records.value.some((record: ShortSellQuantityCsvRecord) => record.date === date)) {
    errorMessage.value = '같은 날짜의 기록이 이미 있습니다.';
    return;
  }
  records.value.push({ date, shortSellingVolume, netShortBalanceQuantity });
  sortRecords();
  errorMessage.value = '';
  form.value = { date: today, shortSellingVolume: '', netShortBalanceQuantity: '' };
}

function removeRecord(date: string) {
  records.value = records.value.filter((record: ShortSellQuantityCsvRecord) => record.date !== date);
}

async function saveRecords() {
  isSaving.value = true;
  errorMessage.value = '';
  try {
    const response = await $fetch<ShortSellQuantityCsvResponse>('/api/short-selling/quantity', {
      method: 'PUT',
      body: { stockName: editableStockName.value, records: records.value }
    });
    records.value = response.records.map((record: ShortSellQuantityCsvRecord) => ({ ...record }));
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
  showFileList.value = true;
  if (editableStockName.value) {
    showFileList.value = false;
    loadRecords();
  } else {
    loadAvailableFiles();
  }
});
</script>
