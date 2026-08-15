<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in">
    <div class="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
      <!-- Modal Header -->
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 class="text-base font-extrabold text-white flex items-center gap-2">
          <i class="fas" :class="isEditMode ? 'fa-edit text-amber-400' : 'fa-plus-circle text-purple-400'"></i>
          <span>{{ isEditMode ? '종목 정보 및 보유수량 편집' : '신규 종목 DB 등록' }}</span>
        </h3>
        <button @click="closeModal" class="text-slate-400 hover:text-white font-bold text-sm">닫기 ✕</button>
      </div>

      <!-- Form Inputs -->
      <form @submit.prevent="submitForm" class="space-y-4 text-xs">
        <div>
          <label class="block text-slate-300 font-bold mb-1">구분 (유형)</label>
          <div class="grid grid-cols-2 gap-2">
            <button 
              type="button"
              @click="form.type = 'holding'"
              :class="form.type === 'holding' ? 'bg-amber-500/20 text-amber-300 border-amber-500' : 'bg-slate-800 text-slate-400 border-slate-700'"
              class="py-2 rounded-xl font-bold border flex items-center justify-center gap-1.5 transition-all"
            >
              <i class="fas fa-wallet"></i> 보유 종목 (Holdings)
            </button>
            <button 
              type="button"
              @click="form.type = 'watchlist'"
              :class="form.type === 'watchlist' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500' : 'bg-slate-800 text-slate-400 border-slate-700'"
              class="py-2 rounded-xl font-bold border flex items-center justify-center gap-1.5 transition-all"
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
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
              required 
            />
          </div>
          <div>
            <label class="block text-slate-300 font-bold mb-1">종목명 <span class="text-rose-400">*</span></label>
            <input 
              v-model="form.name" 
              type="text" 
              placeholder="예: 삼성전자"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
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
            class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div v-if="form.type === 'holding'" class="grid grid-cols-2 gap-3 p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl">
          <div>
            <label class="block text-amber-300 font-bold mb-1">매수 평단가 (원)</label>
            <input 
              v-model.number="form.avgPrice" 
              type="number" 
              placeholder="0"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label class="block text-amber-300 font-bold mb-1">보유 수량 (주)</label>
            <input 
              v-model.number="form.quantity" 
              type="number" 
              placeholder="0"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div v-if="errorMsg" class="text-xs text-rose-400 font-bold bg-rose-950/40 p-2.5 rounded-lg border border-rose-500/40">
          {{ errorMsg }}
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center justify-between pt-3 border-t border-slate-800">
          <button 
            v-if="isEditMode" 
            type="button" 
            @click="deleteStock"
            :disabled="isSubmitting"
            class="px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 font-bold flex items-center gap-1.5 transition-all"
          >
            <i class="fas fa-trash-alt"></i> 종목 삭제
          </button>
          <div v-else></div>

          <div class="flex items-center gap-2">
            <button 
              type="button" 
              @click="closeModal" 
              class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
            >
              취소
            </button>
            <button 
              type="submit" 
              :disabled="isSubmitting"
              class="px-5 py-2 rounded-xl bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold shadow-lg flex items-center gap-1.5 disabled:opacity-50"
            >
              <i class="fas" :class="isSubmitting ? 'fa-spinner fa-spin' : 'fa-check'"></i>
              <span>{{ isSubmitting ? '저장 중...' : 'SQLite DB 저장' }}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
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

const isEditMode = ref(false);
const isSubmitting = ref(false);
const errorMsg = ref<string | null>(null);

const form = ref<StockItemForm>({
  shcode: '',
  name: '',
  industry: '',
  type: 'holding',
  avgPrice: 0,
  quantity: 0
});

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    errorMsg.value = null;
    if (props.initialData) {
      isEditMode.value = true;
      form.value = { ...props.initialData };
    } else {
      isEditMode.value = false;
      form.value = {
        shcode: '',
        name: '',
        industry: '',
        type: 'holding',
        avgPrice: 0,
        quantity: 0
      };
    }
  }
});

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
    closeModal();

    // 종목 추가/편집 후 스크리너 및 포트폴리오 실시간 8대 지표 데이터 즉시 갱신
    portfolioStore.fetchHoldings();
    screenerStore.refreshScreener();
  } catch (err: any) {
    console.error('Submit stock form error:', err);
    errorMsg.value = err.statusMessage || err.message || 'SQLite DB 저장 중 오류가 발생했습니다.';
  } finally {
    isSubmitting.value = false;
  }
}

async function deleteStock() {
  if (!form.value.shcode || !confirm(`정말 ${form.value.name} 종목을 DB에서 삭제하시겠습니까?`)) return;
  isSubmitting.value = true;
  errorMsg.value = null;

  try {
    await $fetch(`/api/stocks/${form.value.shcode}`, {
      method: 'DELETE'
    });
    emit('saved');
    closeModal();

    // 종목 삭제 후 스크리너 및 포트폴리오 갱신
    portfolioStore.fetchHoldings();
    screenerStore.refreshScreener();
  } catch (err: any) {
    console.error('Delete stock error:', err);
    errorMsg.value = err.statusMessage || err.message || '종목 삭제 실패';
  } finally {
    isSubmitting.value = false;
  }
}
</script>
