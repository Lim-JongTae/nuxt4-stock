<template>
  <div class="p-6 max-w-5xl mx-auto">
    <h1 class="text-2xl font-bold mb-4 text-white">관심종목 / 보유종목</h1>
    <div class="flex items-center space-x-4 mb-4">
            <button @click="refresh" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-900 hover:cursor-pointer text-white rounded transition">
        실시간 새로고침
      </button>
      <span v-if="store.isLoading" class="text-sm text-gray-400">로딩 중...</span>
      <span v-else-if="store.errorMessage" class="text-sm text-red-400">{{ store.errorMessage }}</span>
    </div>
    <table class="w-full table-auto border-collapse bg-slate-800/60 backdrop-blur-sm rounded-lg overflow-hidden">
      <thead class="bg-slate-900/80 text-slate-200">
        <tr>
          <th class="px-4 py-2">코드</th>
          <th class="px-4 py-2">종목명</th>
          <th class="px-4 py-2">산업</th>
          <th class="px-4 py-2">보유량</th>
          <th class="px-4 py-2">매입가</th>
          <th class="px-4 py-2">현재가</th>
          <th class="px-4 py-2">목표가</th>
          <th class="px-4 py-2">손절가</th>
          <th class="px-4 py-2">갱신</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in store.items" :key="item.shcode" class="border-b border-slate-700/30">
          <td class="px-4 py-2 text-sm text-indigo-300">{{ item.shcode }}</td>
          <td class="px-4 py-2 text-sm text-white">{{ item.name }}</td>
          <td class="px-4 py-2 text-sm text-gray-400">{{ item.industry }}</td>
          <td class="px-4 py-2 text-sm text-green-300">{{ item.quantity ?? '-' }}</td>
          <td class="px-4 py-2 text-sm text-amber-300">{{ item.avgPrice ?? '-' }}</td>
          <td class="px-4 py-2 text-sm text-cyan-300">{{ item.currentPrice ?? '-' }}</td>
          <td class="px-4 py-2 text-sm text-green-400">{{ item.targetPrice ?? '-' }}</td>
          <td class="px-4 py-2 text-sm text-red-400">{{ item.stopLossPrice ?? '-' }}</td>
          <td class="px-4 py-2 text-xs text-gray-500">{{ item.updatedAt }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { useWatchlistStore } from '@/stores/useWatchlistStore';

const store = useWatchlistStore();

// Load once on component mount
store.loadInitial();

function refresh() {
  store.refresh();
}
</script>

<style scoped>
/* Glassmorphism effect */
.table-auto {
  backdrop-filter: blur(8px);
}
</style>
