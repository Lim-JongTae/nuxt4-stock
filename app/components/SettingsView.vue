<template>
  <div class="space-y-6">
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

      <button @click="saveSettings" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg flex items-center gap-2 transition-all">
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
            <input v-model="lsAppKey" type="text" placeholder="PSxqiyZfJsMtqWtGp4EiVY5xqsCJANkJb8y7" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500 font-mono">
          </div>

          <div>
            <label class="block text-slate-400 font-bold mb-1">LS증권 SECRET KEY (LS_SECREAT):</label>
            <input v-model="lsSecret" type="password" placeholder="••••••••••••••••••••••••" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500 font-mono">
          </div>

          <div>
            <label class="block text-slate-400 font-bold mb-1">Anthropic / OneProvider AI API Key:</label>
            <input v-model="aiApiKey" type="password" placeholder="sk-2a4cdf13ca5e05a9b347ae1c3cc78e03d3fbeafda57af2053054ca5b8024ae58" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500 font-mono">
          </div>

          <div>
            <label class="block text-slate-400 font-bold mb-1">최종 분석 AI 모델:</label>
            <select v-model="aiModel" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500">
              <option value="claude-sonnet-4-6">Anthropic Claude Sonnet 4-6 (권장)</option>
              <option value="claude-opus-3-5">Anthropic Claude Opus 3-5</option>
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

const lsAppKey = ref('PSxqiyZfJsMtqWtGp4EiVY5xqsCJANkJb8y7');
const lsSecret = ref('0NBTDo5J2k7HvS4HYttPoBtcVJIvI6BQ');
const aiApiKey = ref('sk-2a4cdf13ca5e05a9b347ae1c3cc78e03d3fbeafda57af2053054ca5b8024ae58');
const aiModel = ref('claude-sonnet-4-6');

const targetQuantScore = ref(85);
const stopLossRate = ref(4.5);
const trailingStopRate = ref(3.0);
const targetProfitRate = ref(8.0);

function saveSettings() {
  alert('✅ 알고리즘 및 API 연동 설정이 성공적으로 저장되었습니다!');
}
</script>
