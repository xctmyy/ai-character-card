<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useAIStore } from '@/stores/ai';
import { AIServiceFactory } from '@/services/ai/AIServiceFactory';
import type { AIConfig, AIProvider, ModelInfo } from '@/types/ai';

const aiStore = useAIStore();

// 本地表单状态
const provider = ref<AIProvider>('openai');
const openaiBaseUrl = ref('');
const openaiApiKey = ref('');
const openaiModel = ref('');
const ollamaBaseUrl = ref('http://localhost:11434');
const ollamaModel = ref('');

// 模型列表
const models = ref<ModelInfo[]>([]);
const isFetchingModels = ref(false);

// 消息提示
const message = ref('');
const messageType = ref<'success' | 'error'>('success');

// 提供商选项
const providerOptions = AIServiceFactory.getAvailableProviders();

// 是否已保存配置
const isConfigSaved = computed(() => aiStore.hasConfig);

// 初始化表单
function initForm() {
  if (aiStore.config) {
    provider.value = aiStore.config.provider;

    if (aiStore.config.openai) {
      openaiBaseUrl.value = aiStore.config.openai.baseUrl;
      openaiApiKey.value = aiStore.config.openai.apiKey;
      openaiModel.value = aiStore.config.openai.model;
    }

    if (aiStore.config.ollama) {
      ollamaBaseUrl.value = aiStore.config.ollama.baseUrl;
      ollamaModel.value = aiStore.config.ollama.model;
    }
  }
}

// 获取当前配置
function getCurrentConfig(): AIConfig {
  if (provider.value === 'openai') {
    return {
      provider: 'openai',
      openai: {
        baseUrl: openaiBaseUrl.value || 'https://api.openai.com/v1',
        apiKey: openaiApiKey.value,
        model: openaiModel.value,
      },
    };
  } else {
    return {
      provider: 'ollama',
      ollama: {
        baseUrl: ollamaBaseUrl.value || 'http://localhost:11434',
        model: ollamaModel.value,
      },
    };
  }
}

// 保存配置
async function saveConfig() {
  message.value = '';

  const config = getCurrentConfig();
  aiStore.setConfig(config);

  showMessage('配置已保存', 'success');
}

// 测试连接
async function testConnection() {
  message.value = '';

  const config = getCurrentConfig();
  aiStore.setConfig(config);

  const result = await aiStore.testConnection();

  if (result) {
    showMessage('连接成功', 'success');
  } else {
    showMessage(aiStore.error || '连接失败', 'error');
  }
}

// 获取模型列表
async function fetchModels() {
  message.value = '';
  isFetchingModels.value = true;

  const config = getCurrentConfig();
  aiStore.setConfig(config);

  const modelList = await aiStore.fetchModels();
  models.value = modelList;

  isFetchingModels.value = false;

  if (modelList.length > 0) {
    showMessage(`成功获取 ${modelList.length} 个模型`, 'success');
  } else {
    showMessage(aiStore.error || '获取模型列表失败', 'error');
  }
}

// 选择模型
function selectModel(modelId: string) {
  if (provider.value === 'openai') {
    openaiModel.value = modelId;
  } else {
    ollamaModel.value = modelId;
  }
  aiStore.updateModel(modelId);
  showMessage(`已选择模型: ${modelId}`, 'success');
}

// 显示消息
function showMessage(msg: string, type: 'success' | 'error') {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => {
    message.value = '';
  }, 3000);
}

// 清除配置
function clearConfig() {
  aiStore.clearConfig();
  provider.value = 'openai';
  openaiBaseUrl.value = '';
  openaiApiKey.value = '';
  openaiModel.value = '';
  ollamaBaseUrl.value = 'http://localhost:11434';
  ollamaModel.value = '';
  models.value = [];
  showMessage('配置已清除', 'success');
}

// 监听提供商变化
watch(provider, () => {
  models.value = [];
});

// 初始化
initForm();
</script>

<template>
  <div class="ai-settings">
    <h2 class="title">AI服务设置</h2>

    <div v-if="message" class="message" :class="messageType">
      {{ message }}
    </div>

    <div class="form-group">
      <label class="label">AI提供商</label>
      <select v-model="provider" class="select">
        <option v-for="opt in providerOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>

    <!-- OpenAI 配置 -->
    <div v-if="provider === 'openai'" class="config-section">
      <div class="form-group">
        <label class="label">API地址</label>
        <input
          v-model="openaiBaseUrl"
          type="text"
          class="input"
          placeholder="https://api.openai.com/v1"
        />
        <span class="hint">支持OpenAI格式API，可填入第三方API地址</span>
      </div>

      <div class="form-group">
        <label class="label">API密钥</label>
        <input
          v-model="openaiApiKey"
          type="password"
          class="input"
          placeholder="sk-..."
        />
      </div>

      <div class="form-group">
        <label class="label">模型</label>
        <div class="model-select">
          <input
            v-model="openaiModel"
            type="text"
            class="input"
            placeholder="gpt-3.5-turbo"
          />
          <button
            class="btn btn-secondary"
            :disabled="isFetchingModels"
            @click="fetchModels"
          >
            {{ isFetchingModels ? '获取中...' : '获取模型列表' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Ollama 配置 -->
    <div v-else class="config-section">
      <div class="form-group">
        <label class="label">服务地址</label>
        <input
          v-model="ollamaBaseUrl"
          type="text"
          class="input"
          placeholder="http://localhost:11434"
        />
        <span class="hint">Ollama默认运行在 http://localhost:11434</span>
      </div>

      <div class="form-group">
        <label class="label">模型</label>
        <div class="model-select">
          <input
            v-model="ollamaModel"
            type="text"
            class="input"
            placeholder="llama2"
          />
          <button
            class="btn btn-secondary"
            :disabled="isFetchingModels"
            @click="fetchModels"
          >
            {{ isFetchingModels ? '获取中...' : '获取模型列表' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 模型列表 -->
    <div v-if="models.length > 0" class="models-section">
      <h3 class="subtitle">可用模型</h3>
      <div class="models-list">
        <button
          v-for="model in models"
          :key="model.id"
          class="model-item"
          :class="{
            active:
              (provider === 'openai' && openaiModel === model.id) ||
              (provider === 'ollama' && ollamaModel === model.id),
          }"
          @click="selectModel(model.id)"
        >
          <span class="model-name">{{ model.name }}</span>
          <span v-if="model.description" class="model-desc">{{ model.description }}</span>
        </button>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="actions">
      <button class="btn btn-primary" @click="saveConfig">保存配置</button>
      <button class="btn btn-secondary" @click="testConnection">测试连接</button>
      <button v-if="isConfigSaved" class="btn btn-danger" @click="clearConfig">
        清除配置
      </button>
    </div>

    <!-- 状态显示 -->
    <div class="status-section">
      <div class="status-item">
        <span class="status-label">连接状态:</span>
        <span class="status-value" :class="aiStore.isConnected ? 'connected' : 'disconnected'">
          {{ aiStore.isConnected ? '已连接' : '未连接' }}
        </span>
      </div>
      <div v-if="aiStore.currentModel" class="status-item">
        <span class="status-label">当前模型:</span>
        <span class="status-value">{{ aiStore.currentModel }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-settings {
  max-width: 600px;
  margin: 0 auto;
  padding: 24px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.title {
  margin: 0 0 24px 0;
  font-size: 24px;
  font-weight: 600;
  color: #333;
}

.subtitle {
  margin: 16px 0 12px 0;
  font-size: 16px;
  font-weight: 500;
  color: #555;
}

.message {
  padding: 12px 16px;
  border-radius: 6px;
  margin-bottom: 16px;
  font-size: 14px;
}

.message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.form-group {
  margin-bottom: 20px;
}

.label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #444;
}

.input,
.select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.input:focus,
.select:focus {
  outline: none;
  border-color: #4a90d9;
}

.hint {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: #888;
}

.model-select {
  display: flex;
  gap: 12px;
}

.model-select .input {
  flex: 1;
}

.models-section {
  margin: 20px 0;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 6px;
}

.models-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.model-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.model-item:hover {
  border-color: #4a90d9;
  background: #f0f7ff;
}

.model-item.active {
  border-color: #4a90d9;
  background: #e3f2fd;
}

.model-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.model-desc {
  font-size: 12px;
  color: #888;
  margin-top: 4px;
}

.actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #eee;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #4a90d9;
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: #357abd;
}

.btn-secondary {
  background: #6c757d;
  color: #fff;
}

.btn-secondary:hover:not(:disabled) {
  background: #5a6268;
}

.btn-danger {
  background: #dc3545;
  color: #fff;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
}

.status-section {
  margin-top: 20px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 6px;
}

.status-item {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 14px;
}

.status-item:last-child {
  margin-bottom: 0;
}

.status-label {
  color: #666;
}

.status-value {
  font-weight: 500;
  color: #333;
}

.status-value.connected {
  color: #28a745;
}

.status-value.disconnected {
  color: #dc3545;
}
</style>
