import type { AIConfig, AIProvider, IAIService } from '@/types/ai';
import { OpenAIService } from './OpenAIService';
import { OllamaService } from './OllamaService';

// AI服务工厂
export class AIServiceFactory {
  // 创建AI服务实例
  static createService(config: AIConfig): IAIService {
    switch (config.provider) {
      case 'openai':
        return new OpenAIService(config);
      case 'ollama':
        return new OllamaService(config);
      default:
        throw new Error(`不支持的AI提供商: ${config.provider}`);
    }
  }

  // 获取默认配置
  static getDefaultConfig(provider: AIProvider): AIConfig {
    switch (provider) {
      case 'openai':
        return {
          provider: 'openai',
          openai: {
            baseUrl: 'https://api.openai.com/v1',
            apiKey: '',
            model: 'gpt-3.5-turbo',
          },
        };
      case 'ollama':
        return {
          provider: 'ollama',
          ollama: {
            baseUrl: 'http://localhost:11434',
            model: '',
          },
        };
      default:
        throw new Error(`不支持的AI提供商: ${provider}`);
    }
  }

  // 获取可用的提供商列表
  static getAvailableProviders(): { value: AIProvider; label: string }[] {
    return [
      { value: 'openai', label: 'OpenAI格式API' },
      { value: 'ollama', label: 'Ollama本地模型' },
    ];
  }
}
