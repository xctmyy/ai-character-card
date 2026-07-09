import type {
  AIConfig,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  IAIService,
  ModelInfo,
  OllamaConfig,
} from '@/types/ai'
import { getLogService } from '@/services/log/LogService'
import type { AIProvider } from '@/types/ai'

// Ollama本地模型服务
export class OllamaService implements IAIService {
  private config: OllamaConfig
  private provider: AIProvider = 'ollama'

  constructor(config: AIConfig) {
    if (!config.ollama) {
      throw new Error('Ollama配置未提供')
    }
    this.config = config.ollama
  }

  // 获取基础URL
  private getBaseUrl(): string {
    return this.config.baseUrl.replace(/\/$/, '')
  }

  // 测试连接
  async testConnection(): Promise<boolean> {
    const logService = getLogService()
    const startTime = Date.now()

    try {
      logService.logSystem('OllamaService', '测试连接开始', {
        baseUrl: this.getBaseUrl(),
        model: this.config.model,
      })

      const models = await this.getModels()
      const duration = Date.now() - startTime

      logService.logSystem('OllamaService', '测试连接成功', {
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
      logService.logSystem('OllamaService', '获取模型列表', {
        baseUrl: this.getBaseUrl(),
      })

      const response = await fetch(`${this.getBaseUrl()}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`获取模型列表失败: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const duration = Date.now() - startTime

      // Ollama返回格式: { models: [{ name: '...', model: '...', ... }] }
      let models: ModelInfo[] = []
      if (data.models && Array.isArray(data.models)) {
        models = data.models.map(
          (model: { name: string; model?: string; description?: string }) => ({
            id: model.name,
            name: model.name,
            description: model.description,
          }),
        )
      }

      logService.logSystem('OllamaService', '获取模型列表成功', {
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
    const { messages, temperature = 0.7, stream, onStream } = options

    // 转换消息格式
    const ollamaMessages = messages.map((msg: ChatMessage) => ({
      role: msg.role,
      content: msg.content,
    }))

    const requestBody: Record<string, unknown> = {
      model: this.config.model,
      messages: ollamaMessages,
      stream: stream ?? false,
      options: {
        temperature,
      },
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
      stream: stream ?? false,
      requestBody: JSON.stringify(requestBody),
    })

    try {
      const response = await fetch(`${this.getBaseUrl()}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`请求失败: ${response.status} ${response.statusText} - ${errorText}`)
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
          if (!trimmedLine) continue

          try {
            const data = JSON.parse(trimmedLine)
            const content = data.message?.content || ''

            if (content) {
              fullContent += content
              completionTokens += 1
              onStream(content)
            }

            // 获取token统计
            if (data.prompt_eval_count !== undefined) {
              promptTokens = data.prompt_eval_count
            }
            if (data.eval_count !== undefined) {
              completionTokens = data.eval_count
            }
          } catch {
            // 忽略解析错误
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
    message?: { content?: string }
    prompt_eval_count?: number
    eval_count?: number
  }): ChatResponse {
    const content = data.message?.content || ''
    const promptTokens = data.prompt_eval_count || 0
    const completionTokens = data.eval_count || 0

    return {
      content,
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
}
