// 日志类型定义

import type { AIProvider } from './ai';

// 日志级别
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// 日志类型
export type LogType = 'ai_request' | 'ai_response' | 'ai_error' | 'system' | 'user_action';

// AI请求日志数据
export interface AIRequestLogData {
  provider: AIProvider;
  model: string;
  baseUrl: string;
  messages: Array<{
    role: string;
    content: string;
    contentLength: number;
  }>;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  requestBody: string;
}

// AI响应日志数据
export interface AIResponseLogData {
  provider: AIProvider;
  model: string;
  content: string;
  contentLength: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  responseTime: number;
  isStream: boolean;
  responseBody?: string;
}

// AI错误日志数据
export interface AIErrorLogData {
  provider: AIProvider;
  model: string;
  errorType: string;
  errorMessage: string;
  errorStack?: string;
  requestData?: unknown;
  responseTime: number;
}

// 系统日志数据
export interface SystemLogData {
  component: string;
  action: string;
  details?: unknown;
}

// 用户操作日志数据
export interface UserActionLogData {
  action: string;
  component: string;
  details?: unknown;
}

// 日志条目
export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  type: LogType;
  message: string;
  data: AIRequestLogData | AIResponseLogData | AIErrorLogData | SystemLogData | UserActionLogData;
  sessionId?: string;
}

// AI对话日志（完整的一次对话记录）
export interface AIConversationLog {
  id: string;
  sessionId: string;
  timestamp: number;
  provider: AIProvider;
  model: string;
  request: AIRequestLogData;
  response?: AIResponseLogData;
  error?: AIErrorLogData;
  duration: number;
  status: 'success' | 'error' | 'pending';
}

// 日志筛选选项
export interface LogFilterOptions {
  startTime?: number;
  endTime?: number;
  levels?: LogLevel[];
  types?: LogType[];
  providers?: AIProvider[];
  searchText?: string;
  sessionId?: string;
}

// 日志统计
export interface LogStatistics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  totalTokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  providerUsage: Record<string, number>;
  modelUsage: Record<string, number>;
  errorCount: number;
  errorTypes: Record<string, number>;
}

// 日志存储配置
export interface LogStorageConfig {
  maxLogs: number;
  maxConversations: number;
  enablePersistence: boolean;
  storageKey: string;
}

// 默认日志配置
export const DEFAULT_LOG_CONFIG: LogStorageConfig = {
  maxLogs: 1000,
  maxConversations: 100,
  enablePersistence: true,
  storageKey: 'renwuka_ai_logs',
};
