import { ref } from 'vue';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration: number; // ms (기본 3000ms)
  progress: number; // 100 -> 0%
}

const toasts = ref<ToastMessage[]>([]);

export function useGlobalToast() {
  function showToast(options: {
    type?: 'success' | 'error' | 'warning' | 'info';
    title?: string;
    message: string;
    duration?: number;
  }) {
    const type = options.type || 'info';
    const title = options.title || (type === 'success' ? '성공' : type === 'error' ? '오류 발생' : '알림');
    const duration = options.duration || 3000;
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const toastItem: ToastMessage = {
      id,
      type,
      title,
      message: options.message,
      duration,
      progress: 100
    };

    toasts.value.push(toastItem);

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingPercent = Math.max(0, 100 - (elapsed / duration) * 100);
      toastItem.progress = remainingPercent;

      if (elapsed >= duration) {
        clearInterval(interval);
        removeToast(id);
      }
    }, 30);
  }

  function removeToast(id: string) {
    toasts.value = toasts.value.filter(t => t.id !== id);
  }

  function success(message: string, title = '성공') {
    showToast({ type: 'success', title, message });
  }

  function error(message: string, title = '오류 발생') {
    showToast({ type: 'error', title, message });
  }

  function warning(message: string, title = '경고') {
    showToast({ type: 'warning', title, message });
  }

  function info(message: string, title = '알림') {
    showToast({ type: 'info', title, message });
  }

  return {
    toasts,
    showToast,
    removeToast,
    success,
    error,
    warning,
    info
  };
}
