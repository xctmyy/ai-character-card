import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { AIConfig, ChatOptions, ChatResponse, ModelInfo } from '@/types/ai';
import { AIServiceFactory } from '@/services/ai/AIServiceFactory';

// AI配置存储键名
const AI_CONFIG_KEY = 'ai_config';

// AI Store
export const useAIStore = defineStore('ai', () => {
  // ============ State ============
  const config = ref<AIConfig | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const availableModels = ref<ModelInfo[]>([]);
  const isConnected = ref(false);

  // ============ Getters ============
  const hasConfig = computed(() => config.value !== null);
  const currentProvider = computed(() => config.value?.provider || null);
  const currentModel = computed(() => {
    if (!config.value) return null;
    if (config.value.provider === 'openai') {
      return config.value.openai?.model || null;
    }
    if (config.value.provider === 'ollama') {
      return config.value.ollama?.model || null;
    }
    return null;
  });

  // ============ Actions ============

  // 从本地存储加载配置
  function loadConfigFromStorage(): void {
    try {
      const savedConfig = localStorage.getItem(AI_CONFIG_KEY);
      if (savedConfig) {
        config.value = JSON.parse(savedConfig);
      }
    } catch (err) {
      console.error('加载AI配置失败:', err);
    }
  }

  // 保存配置到本地存储
  function saveConfigToStorage(): void {
    try {
      if (config.value) {
        localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config.value));
      } else {
        localStorage.removeItem(AI_CONFIG_KEY);
      }
    } catch (err) {
      console.error('保存AI配置失败:', err);
    }
  }

  // 设置配置
  function setConfig(newConfig: AIConfig): void {
    config.value = newConfig;
    saveConfigToStorage();
    isConnected.value = false;
    availableModels.value = [];
  }

  // 清除配置
  function clearConfig(): void {
    config.value = null;
    localStorage.removeItem(AI_CONFIG_KEY);
    isConnected.value = false;
    availableModels.value = [];
  }

  // 获取AI服务实例
  function getService() {
    if (!config.value) {
      throw new Error('AI配置未设置');
    }
    return AIServiceFactory.createService(config.value);
  }

  // 测试连接
  async function testConnection(): Promise<boolean> {
    if (!config.value) {
      error.value = '请先配置AI服务';
      return false;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const service = getService();
      const result = await service.testConnection();
      isConnected.value = result;
      return result;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '连接测试失败';
      isConnected.value = false;
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  // 获取模型列表
  async function fetchModels(): Promise<ModelInfo[]> {
    if (!config.value) {
      error.value = '请先配置AI服务';
      return [];
    }

    isLoading.value = true;
    error.value = null;

    try {
      const service = getService();
      const models = await service.getModels();
      availableModels.value = models;
      return models;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取模型列表失败';
      return [];
    } finally {
      isLoading.value = false;
    }
  }

  // 发送聊天消息
  async function chat(options: ChatOptions): Promise<ChatResponse | null> {
    if (!config.value) {
      error.value = '请先配置AI服务';
      return null;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const service = getService();
      const response = await service.chat(options);
      return response;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '聊天请求失败';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  // 更新模型
  function updateModel(modelId: string): void {
    if (!config.value) return;

    if (config.value.provider === 'openai' && config.value.openai) {
      config.value.openai.model = modelId;
      saveConfigToStorage();
    } else if (config.value.provider === 'ollama' && config.value.ollama) {
      config.value.ollama.model = modelId;
      saveConfigToStorage();
    }
  }

  // 更新OpenAI配置
  function updateOpenAIConfig(updates: Partial<NonNullable<AIConfig['openai']>>): void {
    if (!config.value || config.value.provider !== 'openai' || !config.value.openai) return;

    config.value.openai = {
      ...config.value.openai,
      ...updates,
    };
    saveConfigToStorage();
  }

  // 更新Ollama配置
  function updateOllamaConfig(updates: Partial<NonNullable<AIConfig['ollama']>>): void {
    if (!config.value || config.value.provider !== 'ollama' || !config.value.ollama) return;

    config.value.ollama = {
      ...config.value.ollama,
      ...updates,
    };
    saveConfigToStorage();
  }

  // 初始化
  loadConfigFromStorage();

  return {
    // State
    config,
    isLoading,
    error,
    availableModels,
    isConnected,

    // Getters
    hasConfig,
    currentProvider,
    currentModel,

    // Actions
    setConfig,
    clearConfig,
    testConnection,
    fetchModels,
    chat,
    updateModel,
    updateOpenAIConfig,
    updateOllamaConfig,
    loadConfigFromStorage,
  };
});
