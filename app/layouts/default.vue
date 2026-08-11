<template>
  <div class="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans">
    <!-- Main Navigation Bar -->
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

        <!-- Status Badges -->
        <div class="hidden lg:flex items-center space-x-2 text-xs">
          <span class="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1.5 shadow-sm">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span class="text-[11px]">LS증권 API: <strong class="text-emerald-400">정상 연동</strong></span>
          </span>
          <span class="px-2.5 py-1 rounded-lg bg-indigo-950/60 border border-indigo-800/50 text-indigo-300 flex items-center gap-1.5 shadow-sm">
            <i class="fas fa-brain text-indigo-400 text-[10px]"></i>
            <span class="text-[11px]">Anthropic Claude AI</span>
          </span>
        </div>

      </div>
    </header>

    <!-- Main Content Area -->
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <slot />
    </main>

    <!-- Footer -->
    <footer class="border-t border-slate-800/80 bg-slate-950/60 py-6 mt-12">
      <div class="max-w-7xl mx-auto px-4 text-center text-xs text-slate-400 space-y-1">
        <p>&copy; {{ currentYear }} Stock AI Portal (Nuxt 4 Architecture). 본 대시보드는 LS증권 Open API 및 Anthropic Claude 퀀트 모델 기반 주식 분석 포털입니다.</p>
        <p class="text-[11px] text-slate-400">본 정보는 주식 투자 참고용 지표이며 최종 투자 결정 및 책임은 투자자 본인에게 있습니다.</p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const currentYear = computed(() => new Date().getFullYear());
</script>
