<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import type { AIConversationLog, LogFilterOptions, LogStatistics } from '@/types/log';
import { getLogService } from '@/services/log/LogService';

// 状态
const conversations = ref<AIConversationLog[]>([]);
const selectedConversation = ref<AIConversationLog | null>(null);
const statistics = ref<LogStatistics | null>(null);
const showStats = ref(false);
const showFilters = ref(false);

// 筛选条件
const filters = ref<LogFilterOptions>({
  types: [],
  levels: [],
});

const searchText = ref('');
const startDate = ref('');
const endDate = ref('');

// 日志服务
const logService = getLogService();

// 加载数据
function loadData() {
  conversations.value = logService.getConversations();
  statistics.value = logService.getStatistics();
}

// 应用筛选
function applyFilters() {
  const options: LogFilterOptions = {
    searchText: searchText.value || undefined,
  };

  if (startDate.value) {
    options.startTime = new Date(startDate.value).getTime();
  }
  if (endDate.value) {
    options.endTime = new Date(endDate.value).getTime();
  }

  const logs = logService.filterLogs(options);
  const conversationIds = new Set(logs.map(l => l.sessionId));
  conversations.value = logService.getConversations().filter(c => conversationIds.has(c.sessionId));
}

// 重置筛选
function resetFilters() {
  searchText.value = '';
  startDate.value = '';
  endDate.value = '';
  filters.value = { types: [], levels: [] };
  loadData();
}

// 清空日志
function clearLogs() {
  if (confirm('确定要清空所有日志吗？此操作不可恢复。')) {
    logService.clearLogs();
    loadData();
    selectedConversation.value = null;
  }
}

// 导出JSON
function exportJSON() {
  const json = logService.exportLogs();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ai-logs-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 导出Markdown
function exportMarkdown() {
  const md = logService.exportAsMarkdown();
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ai-logs-${Date.now()}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 格式化时间戳
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN');
}

// 格式化时长
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// 截断文本
function truncate(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// 获取状态图标
function getStatusIcon(status: string): string {
  switch (status) {
    case 'success': return '✅';
    case 'error': return '❌';
    case 'pending': return '⏳';
    default: return '❓';
  }
}

// 获取状态文本
function getStatusText(status: string): string {
  switch (status) {
    case 'success': return '成功';
    case 'error': return '失败';
    case 'pending': return '进行中';
    default: return '未知';
  }
}

// 监听筛选条件变化
watch([searchText, startDate, endDate], () => {
  applyFilters();
});

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="log-viewer">
    <!-- 头部工具栏 -->
    <div class="log-toolbar">
      <h3>AI对话日志</h3>
      <div class="toolbar-actions">
        <button class="btn btn-sm" @click="showStats = !showStats">
          {{ showStats ? '隐藏统计' : '显示统计' }}
        </button>
        <button class="btn btn-sm" @click="showFilters = !showFilters">
          {{ showFilters ? '隐藏筛选' : '筛选' }}
        </button>
        <button class="btn btn-sm btn-primary" @click="exportJSON">
          导出JSON
        </button>
        <button class="btn btn-sm btn-primary" @click="exportMarkdown">
          导出Markdown
        </button>
        <button class="btn btn-sm btn-danger" @click="clearLogs">
          清空日志
        </button>
      </div>
    </div>

    <!-- 统计面板 -->
    <div v-if="showStats && statistics" class="stats-panel">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ statistics.totalRequests }}</div>
          <div class="stat-label">总请求</div>
        </div>
        <div class="stat-card success">
          <div class="stat-value">{{ statistics.successfulRequests }}</div>
          <div class="stat-label">成功</div>
        </div>
        <div class="stat-card error">
          <div class="stat-value">{{ statistics.failedRequests }}</div>
          <div class="stat-label">失败</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ formatDuration(statistics.averageResponseTime) }}</div>
          <div class="stat-label">平均响应</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ statistics.totalTokens.total }}</div>
          <div class="stat-label">总Token</div>
        </div>
      </div>

      <!-- 提供商使用统计 -->
      <div v-if="Object.keys(statistics.providerUsage).length > 0" class="stats-section">
        <h4>提供商使用</h4>
        <div class="stats-bars">
          <div v-for="(count, provider) in statistics.providerUsage" :key="provider" class="stat-bar">
            <span class="bar-label">{{ provider }}</span>
            <div class="bar-track">
              <div
                class="bar-fill"
                :style="{ width: `${(count / statistics.totalRequests) * 100}%` }"
              />
            </div>
            <span class="bar-value">{{ count }}</span>
          </div>
        </div>
      </div>

      <!-- 模型使用统计 -->
      <div v-if="Object.keys(statistics.modelUsage).length > 0" class="stats-section">
        <h4>模型使用</h4>
        <div class="stats-bars">
          <div v-for="(count, model) in statistics.modelUsage" :key="model" class="stat-bar">
            <span class="bar-label">{{ model }}</span>
            <div class="bar-track">
              <div
                class="bar-fill"
                :style="{ width: `${(count / statistics.totalRequests) * 100}%` }"
              />
            </div>
            <span class="bar-value">{{ count }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 筛选面板 -->
    <div v-if="showFilters" class="filter-panel">
      <div class="filter-row">
        <div class="filter-group">
          <label>搜索</label>
          <input v-model="searchText" type="text" placeholder="搜索日志内容..." />
        </div>
        <div class="filter-group">
          <label>开始时间</label>
          <input v-model="startDate" type="datetime-local" />
        </div>
        <div class="filter-group">
          <label>结束时间</label>
          <input v-model="endDate" type="datetime-local" />
        </div>
        <button class="btn btn-sm" @click="resetFilters">重置</button>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="log-content">
      <!-- 对话列表 -->
      <div class="conversation-list">
        <div v-if="conversations.length === 0" class="empty-state">
          暂无日志记录
        </div>
        <div
          v-for="conv in conversations"
          :key="conv.id"
          class="conversation-item"
          :class="{ active: selectedConversation?.id === conv.id, [conv.status]: true }"
          @click="selectedConversation = conv"
        >
          <div class="conv-header">
            <span class="status-icon">{{ getStatusIcon(conv.status) }}</span>
            <span class="provider">{{ conv.provider }}</span>
            <span class="model">{{ conv.model }}</span>
            <span class="time">{{ formatTime(conv.timestamp) }}</span>
          </div>
          <div class="conv-preview">
            {{ truncate(conv.request.messages[conv.request.messages.length - 1]?.content || '无内容') }}
          </div>
          <div class="conv-meta">
            <span class="duration">⏱️ {{ formatDuration(conv.duration) }}</span>
            <span v-if="conv.response?.usage" class="tokens">
              📝 {{ conv.response.usage.totalTokens }} tokens
            </span>
          </div>
        </div>
      </div>

      <!-- 对话详情 -->
      <div v-if="selectedConversation" class="conversation-detail">
        <div class="detail-header">
          <h4>对话详情</h4>
          <button class="btn-close" @click="selectedConversation = null">×</button>
        </div>

        <div class="detail-content">
          <!-- 基本信息 -->
          <div class="detail-section">
            <h5>基本信息</h5>
            <div class="info-grid">
              <div class="info-item">
                <label>提供商:</label>
                <span>{{ selectedConversation.provider }}</span>
              </div>
              <div class="info-item">
                <label>模型:</label>
                <span>{{ selectedConversation.model }}</span>
              </div>
              <div class="info-item">
                <label>状态:</label>
                <span>{{ getStatusText(selectedConversation.status) }}</span>
              </div>
              <div class="info-item">
                <label>响应时间:</label>
                <span>{{ formatDuration(selectedConversation.duration) }}</span>
              </div>
              <div class="info-item">
                <label>时间戳:</label>
                <span>{{ formatTime(selectedConversation.timestamp) }}</span>
              </div>
            </div>
          </div>

          <!-- Token使用 -->
          <div v-if="selectedConversation.response?.usage" class="detail-section">
            <h5>Token使用</h5>
            <div class="info-grid">
              <div class="info-item">
                <label>Prompt:</label>
                <span>{{ selectedConversation.response.usage.promptTokens }}</span>
              </div>
              <div class="info-item">
                <label>Completion:</label>
                <span>{{ selectedConversation.response.usage.completionTokens }}</span>
              </div>
              <div class="info-item">
                <label>总计:</label>
                <span>{{ selectedConversation.response.usage.totalTokens }}</span>
              </div>
            </div>
          </div>

          <!-- 请求消息 -->
          <div class="detail-section">
            <h5>请求消息</h5>
            <div class="message-list">
              <div
                v-for="(msg, index) in selectedConversation.request.messages"
                :key="index"
                class="message-item"
                :class="msg.role"
              >
                <div class="message-role">{{ msg.role }}</div>
                <pre class="message-content">{{ msg.content }}</pre>
              </div>
            </div>
          </div>

          <!-- 响应内容 -->
          <div v-if="selectedConversation.response" class="detail-section">
            <h5>响应内容</h5>
            <pre class="response-content">{{ selectedConversation.response.content }}</pre>
          </div>

          <!-- 错误信息 -->
          <div v-if="selectedConversation.error" class="detail-section error">
            <h5>错误信息</h5>
            <div class="error-info">
              <p><strong>类型:</strong> {{ selectedConversation.error.errorType }}</p>
              <p><strong>消息:</strong> {{ selectedConversation.error.errorMessage }}</p>
              <pre v-if="selectedConversation.error.errorStack" class="error-stack">
                {{ selectedConversation.error.errorStack }}
              </pre>
            </div>
          </div>
        </div>
      </div>

      <!-- 空详情状态 -->
      <div v-else class="detail-empty">
        <p>选择一个对话查看详情</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.log-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f5f5f5;
  border-radius: 8px;
  overflow: hidden;
}

.log-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
}

.log-toolbar h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 6px 12px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.btn:hover {
  background: #f0f0f0;
}

.btn-primary {
  background: #007bff;
  color: #fff;
  border-color: #007bff;
}

.btn-primary:hover {
  background: #0056b3;
}

.btn-danger {
  background: #dc3545;
  color: #fff;
  border-color: #dc3545;
}

.btn-danger:hover {
  background: #c82333;
}

.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}

/* 统计面板 */
.stats-panel {
  padding: 16px;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
  text-align: center;
}

.stat-card.success {
  background: #d4edda;
  color: #155724;
}

.stat-card.error {
  background: #f8d7da;
  color: #721c24;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: #666;
}

.stats-section {
  margin-top: 16px;
}

.stats-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #333;
}

.stats-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bar-label {
  width: 100px;
  font-size: 12px;
  color: #666;
  flex-shrink: 0;
}

.bar-track {
  flex: 1;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: #007bff;
  border-radius: 4px;
  transition: width 0.3s;
}

.bar-value {
  width: 40px;
  text-align: right;
  font-size: 12px;
  color: #666;
}

/* 筛选面板 */
.filter-panel {
  padding: 12px 16px;
  background: #fafafa;
  border-bottom: 1px solid #e0e0e0;
}

.filter-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-group label {
  font-size: 12px;
  color: #666;
}

.filter-group input {
  padding: 6px 10px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  font-size: 13px;
}

/* 主内容区 */
.log-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* 对话列表 */
.conversation-list {
  width: 400px;
  overflow-y: auto;
  border-right: 1px solid #e0e0e0;
  background: #fff;
}

.empty-state {
  padding: 40px;
  text-align: center;
  color: #999;
}

.conversation-item {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background 0.2s;
}

.conversation-item:hover {
  background: #f8f9fa;
}

.conversation-item.active {
  background: #e3f2fd;
}

.conversation-item.error {
  border-left: 3px solid #dc3545;
}

.conversation-item.success {
  border-left: 3px solid #28a745;
}

.conv-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 12px;
}

.status-icon {
  font-size: 14px;
}

.provider {
  font-weight: 600;
  color: #007bff;
}

.model {
  color: #666;
}

.time {
  margin-left: auto;
  color: #999;
}

.conv-preview {
  font-size: 13px;
  color: #333;
  line-height: 1.4;
  margin-bottom: 6px;
}

.conv-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: #999;
}

/* 对话详情 */
.conversation-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow: hidden;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e0e0e0;
}

.detail-header h4 {
  margin: 0;
  font-size: 16px;
}

.btn-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
  line-height: 1;
}

.btn-close:hover {
  color: #333;
}

.detail-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.detail-section {
  margin-bottom: 20px;
}

.detail-section h5 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #333;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 6px;
}

.detail-section.error h5 {
  color: #dc3545;
  border-color: #dc3545;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 8px;
}

.info-item {
  display: flex;
  gap: 8px;
  font-size: 13px;
}

.info-item label {
  color: #666;
  flex-shrink: 0;
}

.info-item span {
  color: #333;
  font-weight: 500;
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message-item {
  padding: 12px;
  border-radius: 6px;
  background: #f8f9fa;
}

.message-item.system {
  background: #e3f2fd;
}

.message-item.user {
  background: #e8f5e9;
}

.message-item.assistant {
  background: #fff3e0;
}

.message-role {
  font-size: 11px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  margin-bottom: 6px;
}

.message-content {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
}

.response-content {
  margin: 0;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
}

.error-info {
  padding: 12px;
  background: #f8d7da;
  border-radius: 6px;
  color: #721c24;
}

.error-info p {
  margin: 0 0 8px 0;
  font-size: 13px;
}

.error-stack {
  margin: 8px 0 0 0;
  padding: 8px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  font-size: 11px;
  overflow-x: auto;
}

.detail-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 14px;
}
</style>
