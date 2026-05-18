import type { CharacterCard, AIGeneratedQuestions, QuizState } from '@/types/question';
import type { ChatMessage } from '@/types/ai';
import { useAIStore } from '@/stores/ai';
import { getLogService } from '@/services/log/LogService';

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

    const prompt = this.buildAnalysisPrompt(questions, answers);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `你是一个专业的心理测评分析师，精通大五人格、荣格八维、九型人格、MBTI、DISC和道德阵营等理论体系。

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

输出必须是严格的JSON格式。`,
      },
      {
        role: 'user',
        content: prompt,
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

  // 构建分析提示
  private buildAnalysisPrompt(
    questions: AIGeneratedQuestions,
    answers: QuizState['answers'],
  ): string {
    // 构建选择题答案
    const mcAnswers = questions.multipleChoice.map((q) => {
      const selectedOptionId = answers.multipleChoice[q.id];
      const selectedOption = q.options.find((o) => o.id === selectedOptionId);
      return {
        questionId: q.id,
        measurementTargets: q.measurementTargets,
        selectedOption: selectedOption
          ? {
              text: selectedOption.text,
              traits: selectedOption.traits,
            }
          : null,
      };
    });

    // 构建问答题答案
    const saAnswers = questions.shortAnswer.map((q) => ({
      questionId: q.id,
      measurementTargets: q.measurementTargets,
      theme: q.theme,
      answer: answers.shortAnswer[q.id] || '',
    }));

    // 构建对话题答案
    const dgAnswers = questions.dialogue.map((q) => ({
      questionId: q.id,
      measurementTargets: q.measurementTargets,
      scenario: q.scenario,
      answer: answers.dialogue[q.id] || { innerThought: '', response: '' },
    }));

    return `请根据以下答题结果，生成一份详细的人物卡分析报告。

## 选择题答案（共30题）
${JSON.stringify(mcAnswers, null, 2)}

## 问答题答案（共5题）
${JSON.stringify(saAnswers, null, 2)}

## 对话题答案（共5题）
${JSON.stringify(dgAnswers, null, 2)}

请生成以下格式的人物卡：

{
  "bigFive": {
    "openness": 0-100,
    "conscientiousness": 0-100,
    "extraversion": 0-100,
    "agreeableness": 0-100,
    "neuroticism": 0-100
  },
  "cognitiveFunctions": {
    "Ne": 0-100,
    "Ni": 0-100,
    "Se": 0-100,
    "Si": 0-100,
    "Te": 0-100,
    "Ti": 0-100,
    "Fe": 0-100,
    "Fi": 0-100
  },
  "enneagram": {
    "type": 1-9,
    "wing": 1-9,
    "instinctualVariant": "sp/so/sx等组合"
  },
  "mbti": "4字母类型如INTJ",
  "disc": {
    "D": 0-100,
    "I": 0-100,
    "S": 0-100,
    "C": 0-100,
    "primary": "主导类型如D"
  },
  "moralAlignment": {
    "lawChaos": -100到100（负值偏向混乱，正值偏向守序）,
    "goodEvil": -100到100（负值偏向邪恶，正值偏向善良）,
    "label": "如守序善良、中立邪恶等"
  },
  "description": "详细的性格描述（300-500字）",
  "characterSuggestions": {
    "archetype": "角色原型如智者、战士等",
    "strengths": ["优势1", "优势2", "优势3"],
    "weaknesses": ["劣势1", "劣势2", "劣势3"],
    "growthDirection": "成长方向建议"
  }
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
