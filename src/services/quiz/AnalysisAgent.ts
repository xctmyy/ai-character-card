import type { CharacterCard, AIGeneratedQuestions, QuizState } from '@/types/question';
import type { ChatMessage } from '@/types/ai';
import { useAIStore } from '@/stores/ai';
import { getLogService } from '@/services/log/LogService';

// 缓存键常量
const ANALYSIS_CACHE_KEY = 'analysis_session';

// AnalysisAgent - 负责分析答题结果并生成人物卡
export class AnalysisAgent {
  private logService = getLogService();

  // 分析所有答案并生成人物卡
  async analyzeAnswers(
    questions: AIGeneratedQuestions,
    answers: QuizState['answers'],
  ): Promise<CharacterCard> {
    const aiStore = useAIStore();

    if (!aiStore.hasConfig) {
      this.logService.error('system', 'AI配置未设置，无法分析答案');
      throw new Error('请先配置AI服务');
    }

    // 统计答题情况
    const mcAnswered = Object.keys(answers.multipleChoice).length;
    const saAnswered = Object.keys(answers.shortAnswer).length;
    const dgAnswered = Object.keys(answers.dialogue).length;

    this.logService.logSystem('AnalysisAgent', '开始分析答题结果', {
      multipleChoiceAnswered: mcAnswered,
      multipleChoiceTotal: questions.multipleChoice.length,
      shortAnswerAnswered: saAnswered,
      shortAnswerTotal: questions.shortAnswer.length,
      dialogueAnswered: dgAnswered,
      dialogueTotal: questions.dialogue.length,
    });

    // 构建分析提示（只包含答案和前置分数，不包含完整题目）
    const analysisPrompt = this.buildAnalysisPrompt(questions, answers);

    // 构建缓存友好的消息序列
    // 策略：将完整题目作为"上下文"放在前面，让API缓存命中
    // 新内容（答案和分数）放在后面
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: this.getAnalysisSystemPrompt(),
      },
      // 题目上下文（用于缓存命中，与QuestionAgent生成的内容相同）
      {
        role: 'user',
        content: this.buildQuestionContext(questions),
      },
      {
        role: 'assistant',
        content: '好的，我已经记录了所有40道题目。请提供用户的答案，我将进行分析。',
      },
      // 新内容：答案和前置分数（这是本次请求的新增内容）
      {
        role: 'user',
        content: analysisPrompt,
      },
    ];

    try {
      const response = await aiStore.chat({
        messages,
        temperature: 0.7,
      });

      if (!response) {
        throw new Error('分析答题结果失败');
      }

      const characterCard = this.extractJSON<CharacterCard>(response.content);

      this.logService.logSystem('AnalysisAgent', '人物卡生成成功', {
        mbti: characterCard.mbti,
        enneagramType: characterCard.enneagram.type,
        discPrimary: characterCard.disc.primary,
        moralAlignment: characterCard.moralAlignment.label,
      });

      // 记录token使用情况
      if (response.usage) {
        this.logService.logSystem('AnalysisAgent', 'Token使用情况', {
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          totalTokens: response.usage.totalTokens,
          note: '题目上下文已缓存，仅计算增量token',
        });
      }

      return characterCard;
    } catch (error) {
      this.logService.error(
        'system',
        '解析人物卡失败',
        {
          error: error instanceof Error ? error.message : '未知错误',
        },
      );
      throw new Error('生成的人物卡格式不正确');
    }
  }

  // 获取分析系统提示（与QuestionAgent共享前缀，提高缓存命中率）
  private getAnalysisSystemPrompt(): string {
    return `你是一个专业的心理测评分析师，精通大五人格、荣格八维、九型人格、MBTI、DISC和道德阵营等理论体系。

你的任务是根据用户的答题结果，生成一份详细的人物卡分析报告。

分析要求：
1. 综合所有答题数据，计算各维度的得分
2. 大五人格：计算开放性、尽责性、外向性、宜人性、神经质的百分位数（0-100）
3. 荣格八维：计算8个认知功能的强度（0-100）
4. 九型人格：判断主型（1-9）、侧翼和本能副型
5. MBTI：根据认知功能推导4字母类型
6. DISC：计算4个维度的强度，确定主导类型
7. 道德阵营：计算守序-混乱轴和善良-邪恶轴的坐标
8. 生成性格描述：用富有文学性的语言描述这个人的性格特征
9. 角色建议：提供角色原型、优势、劣势和成长方向

输出必须是严格的JSON格式。`;
  }

  // 构建题目上下文（用于缓存，与QuestionAgent生成的内容保持一致）
  private buildQuestionContext(questions: AIGeneratedQuestions): string {
    const context = {
      cacheKey: ANALYSIS_CACHE_KEY,
      timestamp: Date.now(),
      questions: {
        multipleChoice: questions.multipleChoice.map((q) => ({
          id: q.id,
          measurementTargets: q.measurementTargets,
          scenario: q.scenario,
          options: q.options.map((o) => ({
            id: o.id,
            text: o.text,
            traits: o.traits,
          })),
        })),
        shortAnswer: questions.shortAnswer.map((q) => ({
          id: q.id,
          measurementTargets: q.measurementTargets,
          theme: q.theme,
          question: q.question,
        })),
        dialogue: questions.dialogue.map((q) => ({
          id: q.id,
          measurementTargets: q.measurementTargets,
          scenario: q.scenario,
          npcLine: q.npcLine,
          context: q.context,
        })),
      },
    };

    return `以下是本次测评的完整题目（共40题）：\n\n${JSON.stringify(context, null, 2)}`;
  }

  // 构建分析提示（只包含答案和前置分数，不包含完整题目）
  private buildAnalysisPrompt(
    questions: AIGeneratedQuestions,
    answers: QuizState['answers'],
  ): string {
    // 构建选择题答案（只包含ID和选择的traits分数）
    const mcAnswers = questions.multipleChoice.map((q) => {
      const selectedOptionId = answers.multipleChoice[q.id];
      const selectedOption = q.options.find((o) => o.id === selectedOptionId);
      return {
        id: q.id,
        targets: q.measurementTargets,
        // 只传递选择的分数，不传递完整选项文本
        selected: selectedOption
          ? {
              optionId: selectedOption.id,
              traits: selectedOption.traits,
            }
          : null,
      };
    });

    // 构建问答题答案（只包含ID和答案文本）
    const saAnswers = questions.shortAnswer.map((q) => ({
      id: q.id,
      targets: q.measurementTargets,
      answer: answers.shortAnswer[q.id] || '',
    }));

    // 构建对话题答案（只包含ID和答案）
    const dgAnswers = questions.dialogue.map((q) => ({
      id: q.id,
      targets: q.measurementTargets,
      answer: answers.dialogue[q.id] || { innerThought: '', response: '' },
    }));

    return `请根据以下答题结果，生成人物卡分析报告。

## 选择题答案（30题）
${JSON.stringify(mcAnswers)}

## 问答题答案（5题）
${JSON.stringify(saAnswers)}

## 对话题答案（5题）
${JSON.stringify(dgAnswers)}

请生成以下格式的人物卡JSON：
{
  "bigFive": { "openness": 0-100, "conscientiousness": 0-100, "extraversion": 0-100, "agreeableness": 0-100, "neuroticism": 0-100 },
  "cognitiveFunctions": { "Ne": 0-100, "Ni": 0-100, "Se": 0-100, "Si": 0-100, "Te": 0-100, "Ti": 0-100, "Fe": 0-100, "Fi": 0-100 },
  "enneagram": { "type": 1-9, "wing": 1-9, "instinctualVariant": "sp/so/sx" },
  "mbti": "4字母类型",
  "disc": { "D": 0-100, "I": 0-100, "S": 0-100, "C": 0-100, "primary": "主导类型" },
  "moralAlignment": { "lawChaos": -100到100, "goodEvil": -100到100, "label": "如守序善良" },
  "description": "详细性格描述（300-500字）",
  "characterSuggestions": { "archetype": "角色原型", "strengths": ["优势1", "优势2", "优势3"], "weaknesses": ["劣势1", "劣势2", "劣势3"], "growthDirection": "成长方向" }
}

请直接返回JSON格式。`;
  }

  // 从AI响应中提取JSON
  private extractJSON<T>(content: string): T {
    // 尝试直接解析
    try {
      return JSON.parse(content) as T;
    } catch {
      // 尝试提取代码块中的JSON
      const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        return JSON.parse(codeBlockMatch[1]) as T;
      }

      // 尝试提取方括号或花括号包裹的内容
      const jsonMatch = content.match(/(\{[\s\S]*\})/);
      if (jsonMatch && jsonMatch[1]) {
        return JSON.parse(jsonMatch[1]) as T;
      }

      this.logService.error('system', '无法从AI响应中提取JSON', { content: content.substring(0, 500) });
      throw new Error('无法从响应中提取JSON');
    }
  }
}
