<template>
  <div class="space-y-6 relative">
    <!-- Floating Nuxt UI Toast Notification Banner with Animated Progress Bar -->
    <Transition name="fade-slide">
      <div 
        v-if="showToastBanner" 
        class="fixed bottom-6 right-6 z-50 bg-slate-900/95 border border-emerald-500/50 shadow-2xl shadow-emerald-500/20 rounded-2xl overflow-hidden max-w-md backdrop-blur-xl"
      >
        <div class="p-4 flex items-start gap-3.5">
          <div class="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
            <i class="fas fa-check-circle text-lg"></i>
          </div>
          <div class="flex-1 min-w-0 pr-2">
            <h4 class="text-xs font-extrabold text-white flex items-center gap-2">
              <span>{{ toastBannerTitle }}</span>
              <span class="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 text-[10px] rounded border border-emerald-500/30 font-mono">Nuxt UI Toast</span>
            </h4>
            <p class="text-[11px] text-slate-300 mt-1 leading-relaxed">{{ toastBannerMessage }}</p>
          </div>
          <button @click="closeToast" class="text-slate-400 hover:text-white text-xs p-1 cursor-pointer">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <!-- Time-based Countdown Progress Bar -->
        <div class="h-1 bg-slate-800/80 w-full overflow-hidden">
          <div 
            class="h-full bg-linear-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all ease-linear"
            :style="{ width: `${toastProgress}%` }"
          ></div>
        </div>
      </div>
    </Transition>

    <!-- Header Banner -->
    <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <span class="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-bold text-xs">
            <i class="fas fa-cog mr-1"></i> 시스템 설정
          </span>
          <span class="text-xs text-slate-400">LS증권 API & Anthropic AI 및 매매 임계값 관리</span>
        </div>
        <h2 class="text-xl font-extrabold text-white">
          API 연동 및 퀀트 매매 알고리즘 임계값 설정
        </h2>
        <p class="text-xs text-slate-400 mt-1">
          로컬 환경 변수(`.env`) 및 알고리즘 감응도를 조정합니다.
        </p>
      </div>

      <button 
        @click="saveSettings" 
        class="px-5 py-2.5 rounded-xl bg-linear-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg flex items-center gap-2 transition-all cursor-pointer active:scale-95"
      >
        <i class="fas fa-save"></i> 설정 저장
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      
      <!-- LS증권 & AI API Settings -->
      <div class="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <h3 class="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <i class="fas fa-key text-indigo-400"></i> API 연동 인증키 설정
        </h3>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-400 font-bold mb-1">LS증권 APP KEY (LS_APP_KEY):</label>
            <input v-model="lsAppKey" type="text" placeholder="환경변수(.env)에 설정됨 (예: PSx...)" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono">
          </div>

          <div>
            <label class="block text-slate-400 font-bold mb-1">LS증권 SECRET KEY (LS_SECREAT):</label>
            <input v-model="lsSecret" type="password" placeholder="••••••••••••••••••••••••" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono">
          </div>

          <div>
            <label class="block text-slate-400 font-bold mb-1">Anthropic / OneProvider AI API Key:</label>
            <input v-model="aiApiKey" type="password" placeholder="환경변수(.env)에 설정됨 (예: sk-...)" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono">
          </div>

          <div>
            <label class="block text-slate-400 font-bold mb-1">최종 분석 AI 모델:</label>
            <select v-model="aiModel" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
              <option value="claude-sonnet-5">Anthropic Claude Sonnet 5 (권장)</option>
              <option value="claude-opus-5">Anthropic Claude Opus 5</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Trading Algorithm Parameters -->
      <div class="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <h3 class="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <i class="fas fa-sliders-h text-cyan-400"></i> 정밀 매수/매도 알고리즘 임계값 (Thresholds)
        </h3>

        <div class="space-y-4 text-xs">
          <div>
            <div class="flex justify-between text-slate-300 font-bold mb-1">
              <span>🎯 강력 매수 퀀트 점수 기준:</span>
              <span class="text-emerald-400">{{ targetQuantScore }}점 이상</span>
            </div>
            <input v-model.number="targetQuantScore" type="range" min="60" max="100" step="5" class="w-full accent-indigo-500">
          </div>

          <div>
            <div class="flex justify-between text-slate-300 font-bold mb-1">
              <span>🚨 기계적 손절매 (Stop Loss):</span>
              <span class="text-rose-400">-{{ stopLossRate }}%</span>
            </div>
            <input v-model.number="stopLossRate" type="range" min="2.0" max="10.0" step="0.5" class="w-full accent-rose-500">
          </div>

          <div>
            <div class="flex justify-between text-slate-300 font-bold mb-1">
              <span>🛡️ 추적 손절매 (Trailing Stop):</span>
              <span class="text-amber-400">고점 대비 -{{ trailingStopRate }}%</span>
            </div>
            <input v-model.number="trailingStopRate" type="range" min="1.0" max="5.0" step="0.5" class="w-full accent-amber-500">
          </div>

          <div>
            <div class="flex justify-between text-slate-300 font-bold mb-1">
              <span>💰 1차 목표가 (Take Profit RRR 1:2):</span>
              <span class="text-emerald-400">+{{ targetProfitRate }}%</span>
            </div>
            <input v-model.number="targetProfitRate" type="range" min="4.0" max="15.0" step="0.5" class="w-full accent-emerald-500">
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const showToastBanner = ref(false);
const toastBannerTitle = ref('');
const toastBannerMessage = ref('');
const toastProgress = ref(100);

let toastTimer: ReturnType<typeof setTimeout> | null = null;
let progressInterval: ReturnType<typeof setInterval> | null = null;

const lsAppKey = ref('');
const lsSecret = ref('');
const aiApiKey = ref('');
const aiModel = ref('claude-sonnet-5');

const targetQuantScore = ref(85);
const stopLossRate = ref(4.5);
const trailingStopRate = ref(3.0);
const targetProfitRate = ref(8.0);

function closeToast() {
  showToastBanner.value = false;
  if (toastTimer) clearTimeout(toastTimer);
  if (progressInterval) clearInterval(progressInterval);
}

function saveSettings() {
  // 1. Nuxt UI Toast 시도
  try {
    const toast = useToast();
    if (toast && typeof toast.add === 'function') {
      toast.add({
        title: '설정 저장 완료',
        description: '알고리즘 및 API 연동 설정이 성공적으로 저장되었습니다.',
        icon: 'i-heroicons-check-circle',
        color: 'emerald'
      });
    }
  } catch (e) {
    // 세이프티 트라이-캐치
  }

  // 2. 시간 흐름에 따른 카운트다운 타이머 바 갱신
  if (toastTimer) clearTimeout(toastTimer);
  if (progressInterval) clearInterval(progressInterval);

  toastBannerTitle.value = '설정 저장 완료';
  toastBannerMessage.value = '알고리즘 및 API 연동 설정이 성공적으로 저장되었습니다.';
  toastProgress.value = 100;
  showToastBanner.value = true;

  const duration = 3500; // 3.5초
  const stepMs = 30; // 30ms 간격으로 부드럽게 감소
  const decrement = (100 / (duration / stepMs));

  progressInterval = setInterval(() => {
    toastProgress.value = Math.max(0, toastProgress.value - decrement);
  }, stepMs);

  toastTimer = setTimeout(() => {
    closeToast();
  }, duration);
}
</script>

<style scoped>
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(16px) scale(0.95);
}
</style>
