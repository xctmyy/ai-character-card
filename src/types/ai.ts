// AI服务类型定义

// AI提供商类型
export type AIProvider = 'openai' | 'ollama';

// OpenAI配置
export interface OpenAIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

// Ollama配置
export interface OllamaConfig {
  baseUrl: string;
  model: string;
}

// AI配置
export interface AIConfig {
  provider: AIProvider;
  openai?: OpenAIConfig;
  ollama?: OllamaConfig;
}

// 模型信息
export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
}

// 聊天消息
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// 聊天请求选项
export interface ChatOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  onStream?: (chunk: string) => void;
}

// 聊天响应
export interface ChatResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// AI服务接口
export interface IAIService {
  chat(options: ChatOptions): Promise<ChatResponse>;
  getModels(): Promise<ModelInfo[]>;
  testConnection(): Promise<boolean>;
}
