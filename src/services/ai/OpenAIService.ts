import type {
  AIConfig,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  IAIService,
  ModelInfo,
  OpenAIConfig,
} from '@/types/ai'
import { getLogService } from '@/services/log/LogService'
import type { AIProvider } from '@/types/ai'

// OpenAI格式API服务
export class OpenAIService implements IAIService {
  private config: OpenAIConfig
  private provider: AIProvider = 'openai'

  constructor(config: AIConfig) {
    if (!config.openai) {
      throw new Error('OpenAI配置未提供')
    }
    this.config = config.openai
  }

  // 获取基础URL
  private getBaseUrl(): string {
    return this.config.baseUrl.replace(/\/$/, '')
  }

  // 获取请求头
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`
    }
    return headers
  }

  // 测试连接
  async testConnection(): Promise<boolean> {
    const logService = getLogService()
    const startTime = Date.now()

    try {
      logService.logSystem('OpenAIService', '测试连接开始', {
        baseUrl: this.getBaseUrl(),
        model: this.config.model,
      })

      const models = await this.getModels()
      const duration = Date.now() - startTime

      logService.logSystem('OpenAIService', '测试连接成功', {
        duration,
        modelsCount: models.length,
      })

      return models.length > 0
    } catch (error) {
      const duration = Date.now() - startTime
      logService.logAIError(null, {
        provider: this.provider,
        model: this.config.model,
        errorType: 'ConnectionError',
        errorMessage: error instanceof Error ? error.message : '连接测试失败',
        responseTime: duration,
      })
      return false
    }
  }

  // 获取模型列表
  async getModels(): Promise<ModelInfo[]> {
    const logService = getLogService()
    const startTime = Date.now()

    try {
      logService.logSystem('OpenAIService', '获取模型列表', {
        baseUrl: this.getBaseUrl(),
      })

      const response = await fetch(`${this.getBaseUrl()}/models`, {
        method: 'GET',
        headers: this.getHeaders(),
      })

      if (!response.ok) {
        throw new Error(`获取模型列表失败: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const duration = Date.now() - startTime

      // OpenAI格式响应
      let models: ModelInfo[] = []
      if (data.data && Array.isArray(data.data)) {
        models = data.data.map((model: { id: string; name?: string }) => ({
          id: model.id,
          name: model.name || model.id,
        }))
      } else if (Array.isArray(data)) {
        models = data.map((model: { id: string; name?: string }) => ({
          id: model.id,
          name: model.name || model.id,
        }))
      }

      logService.logSystem('OpenAIService', '获取模型列表成功', {
        duration,
        modelsCount: models.length,
      })

      return models
    } catch (error) {
      const duration = Date.now() - startTime
      logService.logAIError(null, {
        provider: this.provider,
        model: this.config.model,
        errorType: 'GetModelsError',
        errorMessage: error instanceof Error ? error.message : '获取模型列表失败',
        responseTime: duration,
      })
      throw error
    }
  }

  // 发送聊天请求
  async chat(options: ChatOptions): Promise<ChatResponse> {
    const logService = getLogService()
    const startTime = Date.now()
    const { messages, temperature = 0.7, maxTokens, stream, onStream } = options

    // 构建请求体
    const requestBody: Record<string, unknown> = {
      model: this.config.model,
      messages: messages.map((msg: ChatMessage) => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature,
      stream: stream ?? false,
    }

    if (maxTokens) {
      requestBody.max_tokens = maxTokens
    }

    // 记录请求日志
    const conversationId = logService.logAIRequest({
      provider: this.provider,
      model: this.config.model,
      baseUrl: this.getBaseUrl(),
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        contentLength: msg.content.length,
      })),
      temperature,
      maxTokens,
      stream: stream ?? false,
      requestBody: JSON.stringify(requestBody),
    })

    try {
      const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage =
          errorData.error?.message || `请求失败: ${response.status} ${response.statusText}`
        throw new Error(errorMessage)
      }

      // 处理流式响应
      if (stream && onStream && response.body) {
        const result = await this.handleStreamResponse(response.body, onStream)
        const duration = Date.now() - startTime

        // 记录响应日志
        logService.logAIResponse(conversationId, {
          provider: this.provider,
          model: this.config.model,
          content: result.content,
          contentLength: result.content.length,
          usage: result.usage,
          responseTime: duration,
          isStream: true,
        })

        return result
      }

      // 处理普通响应
      const data = await response.json()
      const result = this.parseResponse(data)
      const duration = Date.now() - startTime

      // 记录响应日志
      logService.logAIResponse(conversationId, {
        provider: this.provider,
        model: this.config.model,
        content: result.content,
        contentLength: result.content.length,
        usage: result.usage,
        responseTime: duration,
        isStream: false,
        responseBody: JSON.stringify(data),
      })

      return result
    } catch (error) {
      const duration = Date.now() - startTime

      // 记录错误日志
      logService.logAIError(conversationId, {
        provider: this.provider,
        model: this.config.model,
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : '未知错误',
        errorStack: error instanceof Error ? error.stack : undefined,
        requestData: requestBody,
        responseTime: duration,
      })

      throw error
    }
  }

  // 处理流式响应
  private async handleStreamResponse(
    body: ReadableStream<Uint8Array>,
    onStream: (chunk: string) => void,
  ): Promise<ChatResponse> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let fullContent = ''
    let promptTokens = 0
    let completionTokens = 0

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          const trimmedLine = line.trim()
          if (!trimmedLine || trimmedLine === 'data: [DONE]') continue

          if (trimmedLine.startsWith('data: ')) {
            try {
              const jsonStr = trimmedLine.slice(6)
              const data = JSON.parse(jsonStr)
              const content = data.choices?.[0]?.delta?.content || ''

              if (content) {
                fullContent += content
                completionTokens += 1
                onStream(content)
              }

              // 获取usage信息（通常在最后一个chunk）
              if (data.usage) {
                promptTokens = data.usage.prompt_tokens || 0
                completionTokens = data.usage.completion_tokens || completionTokens
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    return {
      content: fullContent,
      usage:
        promptTokens > 0 || completionTokens > 0
          ? {
              promptTokens,
              completionTokens,
              totalTokens: promptTokens + completionTokens,
            }
          : undefined,
    }
  }

  // 解析响应
  private parseResponse(data: {
    choices?: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  }): ChatResponse {
    const content = data.choices?.[0]?.message?.content || ''
    const usage = data.usage

    return {
      content,
      usage: usage
        ? {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
          }
        : undefined,
    }
  }
}
