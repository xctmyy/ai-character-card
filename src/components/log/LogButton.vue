<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { getLogService } from '@/services/log/LogService';
import LogViewer from './LogViewer.vue';

const showViewer = ref(false);
const unreadCount = ref(0);
const logService = getLogService();

// 获取最近的错误数量
const errorCount = computed(() => {
  const conversations = logService.getConversations();
  return conversations.filter(c => c.status === 'error').length;
});

// 切换查看器显示
function toggleViewer() {
  showViewer.value = !showViewer.value;
  if (showViewer.value) {
    unreadCount.value = 0;
  }
}

// 定期刷新未读计数
let intervalId: number | null = null;

onMounted(() => {
  // 初始加载
  const conversations = logService.getConversations();
  unreadCount.value = conversations.length;

  // 每秒刷新一次
  intervalId = window.setInterval(() => {
    if (!showViewer.value) {
      const conversations = logService.getConversations();
      unreadCount.value = conversations.length;
    }
  }, 1000);
});

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId);
  }
});
</script>

<template>
  <div class="log-button-container">
    <!-- 悬浮按钮 -->
    <button
      class="log-fab"
      :class="{ 'has-error': errorCount > 0 }"
      @click="toggleViewer"
      title="查看AI日志"
    >
      <span class="log-icon">📋</span>
      <span v-if="errorCount > 0" class="error-badge">{{ errorCount }}</span>
    </button>

    <!-- 日志查看器弹窗 -->
    <div v-if="showViewer" class="log-modal-overlay" @click.self="showViewer = false">
      <div class="log-modal">
        <div class="log-modal-header">
          <h3>AI日志查看器</h3>
          <button class="btn-close" @click="showViewer = false">×</button>
        </div>
        <div class="log-modal-body">
          <LogViewer />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.log-button-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
}

.log-fab {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #007bff;
  color: #fff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.3s;
  position: relative;
}

.log-fab:hover {
  background: #0056b3;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.log-fab.has-error {
  background: #dc3545;
  animation: pulse 2s infinite;
}

.log-fab.has-error:hover {
  background: #c82333;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 4px 12px rgba(220, 53, 69, 0.4);
  }
  50% {
    box-shadow: 0 4px 20px rgba(220, 53, 69, 0.6);
  }
}

.log-icon {
  line-height: 1;
}

.error-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 20px;
  height: 20px;
  background: #dc3545;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #fff;
}

/* 弹窗样式 */
.log-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
  padding: 20px;
}

.log-modal {
  width: 90%;
  max-width: 1200px;
  height: 80%;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.log-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e0e0e0;
  background: #f8f9fa;
}

.log-modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.btn-close {
  background: none;
  border: none;
  font-size: 28px;
  cursor: pointer;
  color: #999;
  line-height: 1;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-close:hover {
  background: #e0e0e0;
  color: #333;
}

.log-modal-body {
  flex: 1;
  overflow: hidden;
  padding: 0;
}

.log-modal-body :deep(.log-viewer) {
  border-radius: 0;
  height: 100%;
}
</style>
