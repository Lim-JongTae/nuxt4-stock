<template>
  <header class="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 shadow-xl">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      
      <!-- Logo Brand -->
      <NuxtLink to="/" class="flex items-center space-x-3 group">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-all">
          <i class="fas fa-chart-line text-white text-lg"></i>
        </div>
        <div>
          <h1 class="text-base font-extrabold bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent tracking-tight">
            Stock AI Portal <span class="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">Nuxt 4</span>
          </h1>
          <p class="text-[10px] text-slate-400">LS증권 Open API & Anthropic Claude 퀀트 시스템</p>
        </div>
      </NuxtLink>

      <!-- Desktop Navigation Links -->
      <nav class="hidden md:flex items-center space-x-1">
        <NuxtLink 
          to="/" 
          active-class="bg-indigo-600/20 text-indigo-400 border-indigo-500/40 shadow-inner"
          class="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent transition-all flex items-center gap-2"
        >
          <i class="fas fa-home text-indigo-400"></i>
          <span>메인 대시보드</span>
        </NuxtLink>

        <NuxtLink 
          to="/screener" 
          active-class="bg-cyan-600/20 text-cyan-400 border-cyan-500/40 shadow-inner"
          class="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent transition-all flex items-center gap-2"
        >
          <i class="fas fa-search-dollar text-cyan-400"></i>
          <span>유망업종 관심종목</span>
          <span class="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">LIVE</span>
        </NuxtLink>

        <NuxtLink to="/watchlist" active-class="bg-indigo-600/20 text-indigo-400 border-indigo-500/40 shadow-inner" class="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent transition-all flex items-center gap-2">
          <i class="fas fa-star text-indigo-400"></i>
          <span>관심종목</span>
        </NuxtLink>

        <NuxtLink 
          to="/portfolio" 
          active-class="bg-purple-600/20 text-purple-400 border-purple-500/40 shadow-inner"
          class="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent transition-all flex items-center gap-2"
        >
          <i class="fas fa-wallet text-purple-400"></i>
          <span>보유종목 상세관리</span>
        </NuxtLink>

        <NuxtLink 
          to="/reports" 
          active-class="bg-amber-600/20 text-amber-400 border-amber-500/40 shadow-inner"
          class="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent transition-all flex items-center gap-2"
        >
          <i class="fas fa-file-alt text-amber-400"></i>
          <span>AI 종합리포트</span>
        </NuxtLink>

        <NuxtLink 
          to="/settings" 
          active-class="bg-slate-800 text-slate-100 border-slate-700"
          class="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent transition-all flex items-center gap-2"
        >
          <i class="fas fa-cog text-slate-400"></i>
          <span>설정</span>
        </NuxtLink>
      </nav>

      <!-- Dynamic Status Badges -->
      <div class="hidden lg:flex items-center space-x-2 text-xs">
        <span 
          class="px-2.5 py-1 rounded-lg border text-slate-300 flex items-center gap-1.5 shadow-sm transition-all"
          :class="lsApiStatus.borderClass"
          :title="lsApiStatus.tooltip"
        >
          <span class="w-2 h-2 rounded-full" :class="lsApiStatus.dotClass"></span>
          <span class="text-[11px]">LS증권 API: <strong :class="lsApiStatus.badgeClass">{{ lsApiStatus.text }}</strong></span>
        </span>
      </div>

    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useScreenerStore } from '~/stores/useScreenerStore';
import { useWatchlistStore } from '~/stores/useWatchlistStore';

const screenerStore = useScreenerStore();
const watchlistStore = useWatchlistStore();

const lsApiStatus = computed(() => {
  if (screenerStore.isRefreshing || watchlistStore.isLoading) {
    return {
      text: '연동 확인 중...',
      badgeClass: 'text-amber-400 font-extrabold',
      dotClass: 'bg-amber-400 animate-pulse',
      borderClass: 'border-amber-500/30 bg-amber-950/30',
      tooltip: 'LS증권 API 실시간 데이터를 수신하는 중입니다.'
    };
  }

  if (screenerStore.errorMessage || watchlistStore.errorMessage) {
    return {
      text: '연동 오류',
      badgeClass: 'text-rose-400 font-extrabold',
      dotClass: 'bg-rose-500',
      borderClass: 'border-rose-500/40 bg-rose-950/40',
      tooltip: screenerStore.errorMessage || watchlistStore.errorMessage || 'LS증권 API 데이터 수신 오류'
    };
  }

  if (screenerStore.newData.length > 0 || watchlistStore.items.length > 0) {
    return {
      text: '정상 연동',
      badgeClass: 'text-emerald-400 font-extrabold',
      dotClass: 'bg-emerald-400 animate-pulse',
      borderClass: 'border-slate-800 bg-slate-900',
      tooltip: 'LS증권 Open API 실시간 데이터 파싱 정상 수신 중'
    };
  }

  return {
    text: '연동 대기 중',
    badgeClass: 'text-slate-400 font-semibold',
    dotClass: 'bg-slate-500',
    borderClass: 'border-slate-800 bg-slate-900',
    tooltip: '데이터 수신 대기 중'
  };
});
</script>
