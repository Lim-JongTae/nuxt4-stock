<template>
  <div class="fixed top-20 right-5 z-9999 flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4 sm:px-0">
    <TransitionGroup name="toast-slide">
      <div 
        v-for="toast in toasts" 
        :key="toast.id" 
        class="pointer-events-auto rounded-2xl p-4 shadow-2xl border backdrop-blur-md relative overflow-hidden transition-all space-y-1.5"
        :class="{
          'bg-slate-900/95 border-emerald-500/60 text-emerald-200': toast.type === 'success',
          'bg-slate-900/95 border-rose-500/60 text-rose-200': toast.type === 'error',
          'bg-slate-900/95 border-amber-500/60 text-amber-200': toast.type === 'warning',
          'bg-slate-900/95 border-cyan-500/60 text-cyan-200': toast.type === 'info'
        }"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-start gap-2.5">
            <div class="mt-0.5 shrink-0 text-base">
              <i class="fas" :class="{
                'fa-check-circle text-emerald-400': toast.type === 'success',
                'fa-exclamation-triangle text-rose-400': toast.type === 'error',
                'fa-exclamation-circle text-amber-400': toast.type === 'warning',
                'fa-info-circle text-cyan-400': toast.type === 'info'
              }"></i>
            </div>
            <div>
              <h4 class="text-xs font-black tracking-wide" :class="{
                'text-emerald-300': toast.type === 'success',
                'text-rose-300': toast.type === 'error',
                'text-amber-300': toast.type === 'warning',
                'text-cyan-300': toast.type === 'info'
              }">
                {{ toast.title }}
              </h4>
              <p class="text-[11px] text-slate-200 mt-0.5 leading-relaxed">
                {{ toast.message }}
              </p>
            </div>
          </div>
          <button 
            @click="removeToast(toast.id)" 
            class="text-slate-400 hover:text-white font-bold text-xs p-1 rounded-md transition-colors cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>

        <!-- Dynamic Shrinking Progress Time Bar -->
        <div class="absolute bottom-0 left-0 right-0 h-1 bg-slate-950/60 overflow-hidden">
          <div 
            class="h-full transition-all ease-linear"
            :class="{
              'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]': toast.type === 'success',
              'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]': toast.type === 'error',
              'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]': toast.type === 'warning',
              'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]': toast.type === 'info'
            }"
            :style="{ width: `${toast.progress}%` }"
          ></div>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { useGlobalToast } from '~/composables/useGlobalToast';

const { toasts, removeToast } = useGlobalToast();
</script>

<style scoped>
.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-slide-enter-from {
  opacity: 0;
  transform: translateX(100%) scale(0.95);
}
.toast-slide-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(0.9);
}
</style>
