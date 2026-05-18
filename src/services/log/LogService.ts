import type {
  AIConversationLog,
  AIErrorLogData,
  AIRequestLogData,
  AIResponseLogData,
  LogEntry,
  LogFilterOptions,
  LogLevel,
  LogStatistics,
  LogStorageConfig,
  LogType,
} from '@/types/log';
import { DEFAULT_LOG_CONFIG } from '@/types/log';

// 生成唯一ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// 生成会话ID
function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// 日志服务类
export class LogService {
  private logs: LogEntry[] = [];
  private conversations: AIConversationLog[] = [];
  private config: LogStorageConfig;
  private currentSessionId: string;

  constructor(config: Partial<LogStorageConfig> = {}) {
    this.config = { ...DEFAULT_LOG_CONFIG, ...config };
    this.currentSessionId = generateSessionId();
    this.loadFromStorage();
  }

  // 获取当前会话ID
  getCurrentSessionId(): string {
    return this.currentSessionId;
  }

  // 创建新会话
  newSession(): string {
    this.currentSessionId = generateSessionId();
    return this.currentSessionId;
  }

  // 添加日志条目
  addLog(
    level: LogLevel,
    type: LogType,
    message: string,
    data: LogEntry['data'],
  ): LogEntry {
    const entry: LogEntry = {
      id: generateId(),
      timestamp: Date.now(),
      level,
      type,
      message,
      data,
      sessionId: this.currentSessionId,
    };

    this.logs.unshift(entry);

    // 限制日志数量
    if (this.logs.length > this.config.maxLogs) {
      this.logs = this.logs.slice(0, this.config.maxLogs);
    }

    this.saveToStorage();
    return entry;
  }

  // 记录AI请求
  logAIRequest(requestData: AIRequestLogData): string {
    const conversationId = generateId();

    // 添加日志条目
    this.addLog('info', 'ai_request', `AI请求: ${requestData.provider} - ${requestData.model}`, requestData);

    // 创建对话记录
    const conversation: AIConversationLog = {
      id: conversationId,
      sessionId: this.currentSessionId,
      timestamp: Date.now(),
      provider: requestData.provider,
      model: requestData.model,
      request: requestData,
      duration: 0,
      status: 'pending',
    };

    this.conversations.unshift(conversation);

    // 限制对话数量
    if (this.conversations.length > this.config.maxConversations) {
      this.conversations = this.conversations.slice(0, this.config.maxConversations);
    }

    this.saveToStorage();
    return conversationId;
  }

  // 记录AI响应
  logAIResponse(conversationId: string, responseData: AIResponseLogData): void {
    const conversation = this.conversations.find(c => c.id === conversationId);

    if (conversation) {
      conversation.response = responseData;
      conversation.duration = responseData.responseTime;
      conversation.status = 'success';
    }

    this.addLog(
      'info',
      'ai_response',
      `AI响应: ${responseData.provider} - ${responseData.model} (${responseData.responseTime}ms)`,
      responseData,
    );

    this.saveToStorage();
  }

  // 记录AI错误
  logAIError(conversationId: string | null, errorData: AIErrorLogData): void {
    if (conversationId) {
      const conversation = this.conversations.find(c => c.id === conversationId);

      if (conversation) {
        conversation.error = errorData;
        conversation.duration = errorData.responseTime;
        conversation.status = 'error';
      }
    }

    this.addLog(
      'error',
      'ai_error',
      `AI错误: ${errorData.provider} - ${errorData.errorType}: ${errorData.errorMessage}`,
      errorData,
    );

    this.saveToStorage();
  }

  // 记录系统日志
  logSystem(component: string, action: string, details?: unknown): void {
    this.addLog('info', 'system', `[${component}] ${action}`, {
      component,
      action,
      details,
    });
  }

  // 记录用户操作
  logUserAction(action: string, component: string, details?: unknown): void {
    this.addLog('info', 'user_action', `[${component}] 用户操作: ${action}`, {
      action,
      component,
      details,
    });
  }

  // 记录调试信息
  debug(type: LogType, message: string, data?: unknown): void {
    this.addLog('debug', type, message, data as LogEntry['data']);
  }

  // 记录警告
  warn(type: LogType, message: string, data?: unknown): void {
    this.addLog('warn', type, message, data as LogEntry['data']);
  }

  // 记录错误
  error(type: LogType, message: string, data?: unknown): void {
    this.addLog('error', type, message, data as LogEntry['data']);
  }

  // 获取所有日志
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  // 获取所有对话
  getConversations(): AIConversationLog[] {
    return [...this.conversations];
  }

  // 筛选日志
  filterLogs(options: LogFilterOptions): LogEntry[] {
    return this.logs.filter(log => {
      // 时间范围筛选
      if (options.startTime && log.timestamp < options.startTime) return false;
      if (options.endTime && log.timestamp > options.endTime) return false;

      // 级别筛选
      if (options.levels && options.levels.length > 0 && !options.levels.includes(log.level)) {
        return false;
      }

      // 类型筛选
      if (options.types && options.types.length > 0 && !options.types.includes(log.type)) {
        return false;
      }

      // 会话筛选
      if (options.sessionId && log.sessionId !== options.sessionId) {
        return false;
      }

      // 文本搜索
      if (options.searchText) {
        const searchLower = options.searchText.toLowerCase();
        const messageMatch = log.message.toLowerCase().includes(searchLower);
        const dataMatch = JSON.stringify(log.data).toLowerCase().includes(searchLower);
        if (!messageMatch && !dataMatch) return false;
      }

      return true;
    });
  }

  // 获取统计信息
  getStatistics(): LogStatistics {
    const aiLogs = this.conversations;
    const successful = aiLogs.filter(c => c.status === 'success');
    const failed = aiLogs.filter(c => c.status === 'error');

    const totalResponseTime = successful.reduce((sum, c) => sum + c.duration, 0);

    const providerUsage: Record<string, number> = {};
    const modelUsage: Record<string, number> = {};
    const errorTypes: Record<string, number> = {};

    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    for (const log of aiLogs) {
      // 统计提供商使用
      providerUsage[log.provider] = (providerUsage[log.provider] || 0) + 1;

      // 统计模型使用
      modelUsage[log.model] = (modelUsage[log.model] || 0) + 1;

      // 统计Token使用
      if (log.response?.usage) {
        totalPromptTokens += log.response.usage.promptTokens;
        totalCompletionTokens += log.response.usage.completionTokens;
      }

      // 统计错误类型
      if (log.error) {
        errorTypes[log.error.errorType] = (errorTypes[log.error.errorType] || 0) + 1;
      }
    }

    return {
      totalRequests: aiLogs.length,
      successfulRequests: successful.length,
      failedRequests: failed.length,
      averageResponseTime: successful.length > 0 ? totalResponseTime / successful.length : 0,
      totalTokens: {
        prompt: totalPromptTokens,
        completion: totalCompletionTokens,
        total: totalPromptTokens + totalCompletionTokens,
      },
      providerUsage,
      modelUsage,
      errorCount: failed.length,
      errorTypes,
    };
  }

  // 清空日志
  clearLogs(): void {
    this.logs = [];
    this.conversations = [];
    this.saveToStorage();
  }

  // 导出日志为JSON
  exportLogs(): string {
    return JSON.stringify(
      {
        exportTime: new Date().toISOString(),
        sessionId: this.currentSessionId,
        logs: this.logs,
        conversations: this.conversations,
        statistics: this.getStatistics(),
      },
      null,
      2,
    );
  }

  // 导出为Markdown格式
  exportAsMarkdown(): string {
    const stats = this.getStatistics();
    const conversations = this.conversations;

    let md = `# AI对话日志报告\n\n`;
    md += `生成时间: ${new Date().toLocaleString()}\n\n`;

    // 统计信息
    md += `## 统计概览\n\n`;
    md += `- 总请求数: ${stats.totalRequests}\n`;
    md += `- 成功请求: ${stats.successfulRequests}\n`;
    md += `- 失败请求: ${stats.failedRequests}\n`;
    md += `- 平均响应时间: ${stats.averageResponseTime.toFixed(2)}ms\n`;
    md += `- 总Token使用量: ${stats.totalTokens.total} (Prompt: ${stats.totalTokens.prompt}, Completion: ${stats.totalTokens.completion})\n\n`;

    // 提供商使用统计
    md += `### 提供商使用统计\n\n`;
    for (const [provider, count] of Object.entries(stats.providerUsage)) {
      md += `- ${provider}: ${count}次\n`;
    }
    md += '\n';

    // 模型使用统计
    md += `### 模型使用统计\n\n`;
    for (const [model, count] of Object.entries(stats.modelUsage)) {
      md += `- ${model}: ${count}次\n`;
    }
    md += '\n';

    // 详细对话记录
    md += `## 详细对话记录\n\n`;
    for (const conv of conversations) {
      md += `### ${new Date(conv.timestamp).toLocaleString()} - ${conv.provider}/${conv.model}\n\n`;
      md += `**状态**: ${conv.status === 'success' ? '✅ 成功' : conv.status === 'error' ? '❌ 失败' : '⏳ 进行中'}\n\n`;
      md += `**响应时间**: ${conv.duration}ms\n\n`;

      // 请求信息
      md += `**请求**:\n\n`;
      for (const msg of conv.request.messages) {
        md += `*${msg.role}*: ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}\n\n`;
      }

      // 响应信息
      if (conv.response) {
        md += `**响应**:\n\n`;
        md += `${conv.response.content.substring(0, 500)}${conv.response.content.length > 500 ? '...' : ''}\n\n`;

        if (conv.response.usage) {
          md += `**Token使用**: Prompt ${conv.response.usage.promptTokens}, Completion ${conv.response.usage.completionTokens}, Total ${conv.response.usage.totalTokens}\n\n`;
        }
      }

      // 错误信息
      if (conv.error) {
        md += `**错误**:\n\n`;
        md += `- 类型: ${conv.error.errorType}\n`;
        md += `- 消息: ${conv.error.errorMessage}\n\n`;
      }

      md += '---\n\n';
    }

    return md;
  }

  // 保存到本地存储
  private saveToStorage(): void {
    if (!this.config.enablePersistence) return;

    try {
      const data = {
        logs: this.logs,
        conversations: this.conversations,
        sessionId: this.currentSessionId,
        lastSaveTime: Date.now(),
      };
      localStorage.setItem(this.config.storageKey, JSON.stringify(data));
    } catch {
      // 忽略存储错误
    }
  }

  // 从本地存储加载
  private loadFromStorage(): void {
    if (!this.config.enablePersistence) return;

    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.logs = data.logs || [];
        this.conversations = data.conversations || [];
        this.currentSessionId = data.sessionId || generateSessionId();
      }
    } catch {
      // 忽略加载错误
    }
  }
}

// 创建单例实例
let logServiceInstance: LogService | null = null;

export function getLogService(config?: Partial<LogStorageConfig>): LogService {
  if (!logServiceInstance) {
    logServiceInstance = new LogService(config);
  }
  return logServiceInstance;
}

export function resetLogService(): void {
  logServiceInstance = null;
}
