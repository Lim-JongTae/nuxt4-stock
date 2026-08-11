<template>
  <div class="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans">
    <!-- Main Navigation Bar Component -->
    <Navbar />

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
