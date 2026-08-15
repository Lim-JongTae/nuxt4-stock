<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in">
    <div class="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
      
      <!-- Modal Header -->
      <div class="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
        <div>
          <h3 class="text-base font-extrabold text-white flex items-center gap-2">
            <i class="fas fa-list-check text-purple-400"></i>
            <span>종목 목록 관리 및 DB 추가/수정</span>
          </h3>
          <p class="text-[11px] text-slate-400 mt-0.5">상단: 보유종목 리스트 / 하단: 관심종목 리스트 순서로 표기됩니다.</p>
        </div>
        <button @click="closeModal" class="text-slate-400 hover:text-white font-bold text-sm px-2 py-1 rounded-lg hover:bg-slate-800 cursor-pointer">
          닫기 ✕
        </button>
      </div>

      <!-- Navigation Tabs (List View vs Add/Edit Form) -->
      <div class="flex items-center justify-between gap-2 shrink-0">
        <div class="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button 
            @click="switchToList"
            :class="viewMode === 'list' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'"
            class="px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <i class="fas fa-th-list"></i>
            <span>등록 종목 리스트 ({{ stockList.length }}개)</span>
          </button>
          <button 
            @click="switchToCreate"
            :class="viewMode === 'form' && !isEditMode ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'"
            class="px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <i class="fas fa-plus-circle"></i>
            <span>신규 종목 추가</span>
          </button>
        </div>

        <span v-if="viewMode === 'form' && isEditMode" class="text-xs px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1">
          <i class="fas fa-edit"></i> {{ form.name }} ({{ form.shcode }}) 수정 중
        </span>
      </div>

      <!-- Error Alert Banner -->
      <div v-if="errorMsg" class="shrink-0 text-xs text-rose-300 font-semibold bg-rose-950/80 p-3 rounded-xl border border-rose-500/40 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <i class="fas fa-exclamation-circle text-rose-400"></i>
          <span>{{ errorMsg }}</span>
        </div>
        <button @click="errorMsg = null" class="text-rose-400 hover:text-white">✕</button>
      </div>

      <!-- VIEW 1: REGISTERED STOCKS LIST VIEW -->
      <div v-if="viewMode === 'list'" class="space-y-3 flex-1 overflow-hidden flex flex-col min-h-0">
        
        <!-- List Filters & Search Bar -->
        <div class="flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div class="relative flex-1 min-w-[200px]">
            <i class="fas fa-search absolute left-3 top-2.5 text-slate-500 text-xs"></i>
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="종목명 또는 종목코드 검색..."
              class="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          <div class="flex items-center gap-1 text-[11px]">
            <button 
              @click="typeFilter = 'all'"
              :class="typeFilter === 'all' ? 'bg-slate-700 text-white font-bold' : 'bg-slate-950 text-slate-400 border border-slate-800'"
              class="px-2.5 py-1 rounded-lg transition cursor-pointer"
            >
              전체 ({{ stockList.length }})
            </button>
            <button 
              @click="typeFilter = 'holding'"
              :class="typeFilter === 'holding' ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold' : 'bg-slate-950 text-slate-400 border border-slate-800'"
              class="px-2.5 py-1 rounded-lg transition cursor-pointer"
            >
              보유종목 ({{ holdingCount }})
            </button>
            <button 
              @click="typeFilter = 'watchlist'"
              :class="typeFilter === 'watchlist' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold' : 'bg-slate-950 text-slate-400 border border-slate-800'"
              class="px-2.5 py-1 rounded-lg transition cursor-pointer"
            >
              관심종목 ({{ watchlistCount }})
            </button>
          </div>
        </div>

        <!-- Stock Items List Container (Holdings at TOP, Watchlist BELOW) -->
        <div class="flex-1 overflow-y-auto pr-1 space-y-4 border border-slate-800/80 rounded-xl p-3 bg-slate-950/50">
          <div v-if="isLoadingList" class="py-12 text-center text-xs text-slate-400 space-y-2">
            <i class="fas fa-spinner fa-spin text-lg text-indigo-400"></i>
            <p>DB 종목 목록을 불러오는 중...</p>
          </div>

          <div v-else-if="filteredStockList.length === 0" class="py-12 text-center text-xs text-slate-500 space-y-1">
            <i class="fas fa-folder-open text-2xl text-slate-600 mb-1"></i>
            <p>조건에 일치하는 등록 종목이 없습니다.</p>
          </div>

          <template v-else>
            <!-- SECTION 1: HOLDING STOCKS (보유 종목 - 상단 배치) -->
            <div v-if="holdingStocks.length > 0" class="space-y-2">
              <div class="flex items-center justify-between pb-1.5 border-b border-amber-500/30">
                <span class="text-xs font-extrabold text-amber-300 flex items-center gap-1.5">
                  <i class="fas fa-wallet text-amber-400"></i>
                  <span>보유 종목 리스트</span>
                  <span class="px-2 py-0.2 rounded-md bg-amber-500/20 text-[10px] border border-amber-500/30 font-mono">{{ holdingStocks.length }}개</span>
                </span>
                <span class="text-[10px] text-amber-400/80">매수금액 및 수량 보유</span>
              </div>

              <div 
                v-for="item in holdingStocks" 
                :key="item.shcode"
                class="bg-slate-900/90 border border-amber-500/30 hover:border-amber-500/60 p-3 rounded-xl flex items-center justify-between gap-3 transition-all hover:bg-slate-900"
              >
                <!-- Left Info -->
                <div class="flex items-center gap-3 min-w-0">
                  <span class="px-2 py-0.5 rounded text-[10px] font-extrabold shrink-0 bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    보유
                  </span>

                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-extrabold text-white text-xs truncate" :title="item.name">{{ item.name }}</span>
                      <span class="font-mono text-[11px] text-slate-400 shrink-0">({{ item.shcode }})</span>
                    </div>
                    <div class="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                      <span>{{ item.industry || '주요업종' }}</span>
                      <span class="text-amber-300 font-mono font-semibold">
                        평단가: {{ Number(item.avgPrice || 0).toLocaleString() }}원 / {{ Number(item.quantity || 0).toLocaleString() }}주
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Action Buttons -->
                <div class="flex items-center gap-1.5 shrink-0">
                  <button 
                    @click="editStockItem(item)"
                    class="px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/40 text-amber-200 border border-amber-500/40 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <i class="fas fa-edit text-[10px]"></i>
                    <span>수정</span>
                  </button>
                  <button 
                    @click="deleteStockItemDirect(item)"
                    class="px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <i class="fas fa-trash-alt text-[10px]"></i>
                    <span>삭제</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- SECTION 2: WATCHLIST STOCKS (관심 종목 - 하단 배치) -->
            <div v-if="watchlistStocks.length > 0" class="space-y-2 pt-2">
              <div class="flex items-center justify-between pb-1.5 border-b border-cyan-500/30">
                <span class="text-xs font-extrabold text-cyan-300 flex items-center gap-1.5">
                  <i class="fas fa-eye text-cyan-400"></i>
                  <span>관심 종목 리스트</span>
                  <span class="px-2 py-0.2 rounded-md bg-cyan-500/20 text-[10px] border border-cyan-500/30 font-mono">{{ watchlistStocks.length }}개</span>
                </span>
                <span class="text-[10px] text-cyan-400/80">시세 및 8대 기술지표 모니터링</span>
              </div>

              <div 
                v-for="item in watchlistStocks" 
                :key="item.shcode"
                class="bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 p-3 rounded-xl flex items-center justify-between gap-3 transition-all hover:bg-slate-900"
              >
                <!-- Left Info -->
                <div class="flex items-center gap-3 min-w-0">
                  <span class="px-2 py-0.5 rounded text-[10px] font-extrabold shrink-0 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    관심
                  </span>

                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-extrabold text-white text-xs truncate" :title="item.name">{{ item.name }}</span>
                      <span class="font-mono text-[11px] text-slate-400 shrink-0">({{ item.shcode }})</span>
                    </div>
                    <div class="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                      <span>{{ item.industry || '주요업종' }}</span>
                    </div>
                  </div>
                </div>

                <!-- Action Buttons -->
                <div class="flex items-center gap-1.5 shrink-0">
                  <button 
                    @click="editStockItem(item)"
                    class="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <i class="fas fa-edit text-[10px]"></i>
                    <span>수정</span>
                  </button>
                  <button 
                    @click="deleteStockItemDirect(item)"
                    class="px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <i class="fas fa-trash-alt text-[10px]"></i>
                    <span>삭제</span>
                  </button>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- List Footer Action -->
        <div class="pt-2 border-t border-slate-800 flex items-center justify-between shrink-0">
          <span class="text-xs text-slate-400">보유 {{ holdingCount }}개 / 관심 {{ watchlistCount }}개 (총 {{ stockList.length }}개)</span>
          <button 
            @click="switchToCreate" 
            class="px-4 py-2 rounded-xl bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <i class="fas fa-plus-circle"></i>
            <span>신규 종목 DB 추가하기</span>
          </button>
        </div>

      </div>

      <!-- VIEW 2: ADD / EDIT FORM VIEW -->
      <div v-else class="space-y-4 overflow-y-auto pr-1">
        <form @submit.prevent="submitForm" class="space-y-4 text-xs">
          <div>
            <label class="block text-slate-300 font-bold mb-1">구분 (유형)</label>
            <div class="grid grid-cols-2 gap-2">
              <button 
                type="button"
                @click="form.type = 'holding'"
                :class="form.type === 'holding' ? 'bg-amber-500/20 text-amber-300 border-amber-500' : 'bg-slate-800 text-slate-400 border-slate-700'"
                class="py-2.5 rounded-xl font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <i class="fas fa-wallet"></i> 보유 종목 (Holdings)
              </button>
              <button 
                type="button"
                @click="form.type = 'watchlist'"
                :class="form.type === 'watchlist' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500' : 'bg-slate-800 text-slate-400 border-slate-700'"
                class="py-2.5 rounded-xl font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <i class="fas fa-eye"></i> 관심 종목 (Watchlist)
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-slate-300 font-bold mb-1">종목코드 <span class="text-rose-400">*</span></label>
              <input 
                v-model="form.shcode" 
                :disabled="isEditMode"
                type="text" 
                placeholder="예: 005930, 0186L0"
                class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60"
                required 
              />
            </div>
            <div>
              <label class="block text-slate-300 font-bold mb-1">종목명 <span class="text-rose-400">*</span></label>
              <input 
                v-model="form.name" 
                type="text" 
                placeholder="예: 삼성전자"
                class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                required 
              />
            </div>
          </div>

          <div>
            <label class="block text-slate-300 font-bold mb-1">업종 / 분류</label>
            <input 
              v-model="form.industry" 
              type="text" 
              placeholder="예: 전기전자, 인공지능/피지컬AI"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          <div v-if="form.type === 'holding'" class="grid grid-cols-2 gap-3 p-3.5 bg-amber-950/20 border border-amber-500/30 rounded-xl">
            <div>
              <label class="block text-amber-300 font-bold mb-1">매수 평단가 (원)</label>
              <input 
                v-model.number="form.avgPrice" 
                type="number" 
                placeholder="0"
                class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
            <div>
              <label class="block text-amber-300 font-bold mb-1">보유 수량 (주)</label>
              <input 
                v-model.number="form.quantity" 
                type="number" 
                placeholder="0"
                class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
          </div>

          <!-- Form Buttons -->
          <div class="flex items-center justify-between pt-3 border-t border-slate-800">
            <button 
              type="button" 
              @click="switchToList" 
              class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <i class="fas fa-arrow-left"></i>
              <span>목록으로 돌아가기</span>
            </button>

            <div class="flex items-center gap-2">
              <button 
                v-if="isEditMode" 
                type="button" 
                @click="deleteStockForm"
                :disabled="isSubmitting"
                class="px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <i class="fas fa-trash-alt"></i> 종목 삭제
              </button>

              <button 
                type="submit" 
                :disabled="isSubmitting"
                class="px-5 py-2 rounded-xl bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold shadow-lg flex items-center gap-1.5 disabled:opacity-50 cursor-pointer active:scale-95"
              >
                <i class="fas" :class="isSubmitting ? 'fa-spinner fa-spin' : 'fa-check'"></i>
                <span>{{ isSubmitting ? '저장 중...' : (isEditMode ? 'SQLite DB 수정 저장' : 'SQLite DB 신규 추가') }}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useScreenerStore } from '@/stores/useScreenerStore';
import { usePortfolioStore } from '@/stores/usePortfolioStore';

export interface StockItemForm {
  shcode: string;
  name: string;
  industry?: string;
  type: 'holding' | 'watchlist';
  avgPrice?: number;
  quantity?: number;
}

const props = defineProps<{
  isOpen: boolean;
  initialData?: StockItemForm | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved'): void;
}>();

const screenerStore = useScreenerStore();
const portfolioStore = usePortfolioStore();

const viewMode = ref<'list' | 'form'>('list');
const isEditMode = ref(false);
const isSubmitting = ref(false);
const isLoadingList = ref(false);
const errorMsg = ref<string | null>(null);

const searchQuery = ref('');
const typeFilter = ref<'all' | 'holding' | 'watchlist'>('all');
const stockList = ref<StockItemForm[]>([]);

const form = ref<StockItemForm>({
  shcode: '',
  name: '',
  industry: '',
  type: 'holding',
  avgPrice: 0,
  quantity: 0
});

const holdingCount = computed(() => stockList.value.filter(s => s.type === 'holding').length);
const watchlistCount = computed(() => stockList.value.filter(s => s.type === 'watchlist').length);

const filteredStockList = computed(() => {
  let list = [...stockList.value];
  if (typeFilter.value === 'holding') {
    list = list.filter(s => s.type === 'holding');
  } else if (typeFilter.value === 'watchlist') {
    list = list.filter(s => s.type === 'watchlist');
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase();
    list = list.filter(s => 
      s.name.toLowerCase().includes(q) || 
      s.shcode.toLowerCase().includes(q) ||
      (s.industry && s.industry.toLowerCase().includes(q))
    );
  }

  // 보유종목 우선 배치 (holding -> 0, watchlist -> 1)
  return list.sort((a, b) => {
    const typeOrderA = a.type === 'holding' ? 0 : 1;
    const typeOrderB = b.type === 'holding' ? 0 : 1;
    if (typeOrderA !== typeOrderB) return typeOrderA - typeOrderB;
    return a.name.localeCompare(b.name, 'ko');
  });
});

const holdingStocks = computed(() => filteredStockList.value.filter(s => s.type === 'holding'));
const watchlistStocks = computed(() => filteredStockList.value.filter(s => s.type === 'watchlist'));

async function fetchStockList() {
  isLoadingList.value = true;
  try {
    const res = await $fetch<any>('/api/stocks?ts=' + Date.now());
    if (res && res.success && res.data && Array.isArray(res.data.all)) {
      stockList.value = res.data.all;
    }
  } catch (err: any) {
    console.error('Fetch stocks in modal error:', err);
    errorMsg.value = 'DB 종목 목록 수신 실패';
  } finally {
    isLoadingList.value = false;
  }
}

watch(() => props.isOpen, async (newVal) => {
  if (newVal) {
    errorMsg.value = null;
    searchQuery.value = '';
    typeFilter.value = 'all';
    await fetchStockList();

    if (props.initialData) {
      editStockItem(props.initialData);
    } else {
      viewMode.value = 'list';
    }
  }
});

function switchToList() {
  viewMode.value = 'list';
  errorMsg.value = null;
}

function switchToCreate() {
  isEditMode.value = false;
  form.value = {
    shcode: '',
    name: '',
    industry: '',
    type: 'holding',
    avgPrice: 0,
    quantity: 0
  };
  viewMode.value = 'form';
  errorMsg.value = null;
}

function editStockItem(item: StockItemForm) {
  isEditMode.value = true;
  form.value = {
    shcode: item.shcode,
    name: item.name,
    industry: item.industry || '',
    type: item.type || 'holding',
    avgPrice: item.avgPrice || 0,
    quantity: item.quantity || 0
  };
  viewMode.value = 'form';
  errorMsg.value = null;
}

function closeModal() {
  emit('close');
}

async function submitForm() {
  if (!form.value.shcode || !form.value.name) return;
  isSubmitting.value = true;
  errorMsg.value = null;

  try {
    if (isEditMode.value) {
      await $fetch(`/api/stocks/${form.value.shcode}`, {
        method: 'PUT',
        body: form.value
      });
    } else {
      await $fetch('/api/stocks', {
        method: 'POST',
        body: form.value
      });
    }
    
    emit('saved');
    await fetchStockList();
    switchToList();

    // 종목 추가/편집 후 스토어 실시간 갱신
    portfolioStore.fetchHoldings(true);
    screenerStore.refreshScreener();
  } catch (err: any) {
    console.error('Submit stock form error:', err);
    errorMsg.value = err.statusMessage || err.message || 'SQLite DB 저장 중 오류가 발생했습니다.';
  } finally {
    isSubmitting.value = false;
  }
}

async function deleteStockItemDirect(item: StockItemForm) {
  if (!confirm(`정말 ${item.name} (${item.shcode}) 종목을 DB에서 삭제하시겠습니까?`)) return;
  isSubmitting.value = true;
  errorMsg.value = null;

  try {
    await $fetch(`/api/stocks/${item.shcode}`, {
      method: 'DELETE'
    });
    emit('saved');
    await fetchStockList();

    portfolioStore.fetchHoldings(true);
    screenerStore.refreshScreener();
  } catch (err: any) {
    console.error('Delete stock error:', err);
    errorMsg.value = err.statusMessage || err.message || '종목 삭제 실패';
  } finally {
    isSubmitting.value = false;
  }
}

async function deleteStockForm() {
  if (!form.value.shcode) return;
  await deleteStockItemDirect(form.value);
  switchToList();
}
</script>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.97); }
  to { opacity: 1; transform: scale(1); }
}
</style>
