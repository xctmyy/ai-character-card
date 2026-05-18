import type {
  AIGeneratedQuestions,
  MultipleChoiceQuestion,
  ShortAnswerQuestion,
  DialogueQuestion,
} from '@/types/question';
import type { ChatMessage } from '@/types/ai';
import { useAIStore } from '@/stores/ai';
import { getLogService } from '@/services/log/LogService';

// 原始题目模板
interface RawQuestionItem {
  id: string;
  measurement_targets: string[];
  scenario_hint?: string;
  theme?: string;
  scenario_type?: string;
}

interface RawQuestionData {
  sections: {
    multiple_choice: {
      count: number;
      instruction: string;
      items: RawQuestionItem[];
    };
    short_answer: {
      count: number;
      instruction: string;
      items: RawQuestionItem[];
    };
    dialogue: {
      count: number;
      instruction: string;
      items: RawQuestionItem[];
    };
  };
}

// 进度回调类型
export type ProgressCallback = (stage: string, completed: number, total: number) => void;

// QuestionAgent - 负责与AI交互生成题目
export class QuestionAgent {
  private rawQuestions: RawQuestionData;
  private logService = getLogService();

  constructor(rawQuestions: RawQuestionData) {
    this.rawQuestions = rawQuestions;
  }

  // 生成所有题目（带进度回调）
  async generateAllQuestionsWithProgress(
    onProgress: ProgressCallback,
  ): Promise<AIGeneratedQuestions> {
    const aiStore = useAIStore();

    if (!aiStore.hasConfig) {
      this.logService.error('system', 'AI配置未设置，无法生成题目');
      throw new Error('请先配置AI服务');
    }

    this.logService.logSystem('QuestionAgent', '开始生成所有题目', {
      multipleChoiceCount: this.rawQuestions.sections.multiple_choice.items.length,
      shortAnswerCount: this.rawQuestions.sections.short_answer.items.length,
      dialogueCount: this.rawQuestions.sections.dialogue.items.length,
    });

    const total = 3; // 三个阶段
    let completed = 0;

    try {
      // 串行生成题目，以便跟踪进度
      onProgress('正在生成选择题...', completed, total);
      const multipleChoice = await this.generateMultipleChoiceQuestions();
      completed++;
      onProgress('选择题生成完成', completed, total);

      onProgress('正在生成问答题...', completed, total);
      const shortAnswer = await this.generateShortAnswerQuestions();
      completed++;
      onProgress('问答题生成完成', completed, total);

      onProgress('正在生成对话题...', completed, total);
      const dialogue = await this.generateDialogueQuestions();
      completed++;
      onProgress('对话题生成完成', completed, total);

      this.logService.logSystem('QuestionAgent', '所有题目生成完成', {
        multipleChoiceCount: multipleChoice.length,
        shortAnswerCount: shortAnswer.length,
        dialogueCount: dialogue.length,
      });

      return {
        multipleChoice,
        shortAnswer,
        dialogue,
      };
    } catch (error) {
      this.logService.error(
        'system',
        '生成题目失败',
        {
          error: error instanceof Error ? error.message : '未知错误',
        },
      );
      throw error;
    }
  }

  // 生成所有题目（兼容旧版本，并行生成）
  async generateAllQuestions(): Promise<AIGeneratedQuestions> {
    const aiStore = useAIStore();

    if (!aiStore.hasConfig) {
      this.logService.error('system', 'AI配置未设置，无法生成题目');
      throw new Error('请先配置AI服务');
    }

    this.logService.logSystem('QuestionAgent', '开始生成所有题目', {
      multipleChoiceCount: this.rawQuestions.sections.multiple_choice.items.length,
      shortAnswerCount: this.rawQuestions.sections.short_answer.items.length,
      dialogueCount: this.rawQuestions.sections.dialogue.items.length,
    });

    try {
      // 并行生成三类题目
      const [multipleChoice, shortAnswer, dialogue] = await Promise.all([
        this.generateMultipleChoiceQuestions(),
        this.generateShortAnswerQuestions(),
        this.generateDialogueQuestions(),
      ]);

      this.logService.logSystem('QuestionAgent', '所有题目生成完成', {
        multipleChoiceCount: multipleChoice.length,
        shortAnswerCount: shortAnswer.length,
        dialogueCount: dialogue.length,
      });

      return {
        multipleChoice,
        shortAnswer,
        dialogue,
      };
    } catch (error) {
      this.logService.error(
        'system',
        '生成题目失败',
        {
          error: error instanceof Error ? error.message : '未知错误',
        },
      );
      throw error;
    }
  }

  // 仅生成选择题
  async generateOnlyMultipleChoiceQuestions(): Promise<MultipleChoiceQuestion[]> {
    return this.generateMultipleChoiceQuestions();
  }

  // 仅生成问答题
  async generateOnlyShortAnswerQuestions(): Promise<ShortAnswerQuestion[]> {
    return this.generateShortAnswerQuestions();
  }

  // 仅生成对话题
  async generateOnlyDialogueQuestions(): Promise<DialogueQuestion[]> {
    return this.generateDialogueQuestions();
  }

  // 生成选择题
  private async generateMultipleChoiceQuestions(): Promise<MultipleChoiceQuestion[]> {
    const aiStore = useAIStore();
    const items = this.rawQuestions.sections.multiple_choice.items;

    this.logService.logSystem('QuestionAgent', '开始生成选择题', {
      count: items.length,
    });

    const prompt = this.buildMultipleChoicePrompt(items);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `你是一个专业的心理测评题目设计专家。你的任务是根据给定的测量目标，自主创作全新的心理测评选择题。

重要提示：
- 输入的JSON只是示例参考，展示测量目标的类型和风格
- 你必须创作全新的、原创的题目，绝对不能照搬示例的情境或选项
- 每道题都应该是独特的、富有想象力的虚构情境

设计要求：
1. 创作30个完全不同的虚构情境（如奇幻、科幻、武侠、现代都市、末日废土等多样背景）
2. 每个情境100-200字，引人入胜，有代入感
3. 每道题提供4个选项（A/B/C/D），每个选项代表不同的性格倾向
4. 选项之间要有明显的区分度，能反映不同的人格特质
5. 避免过于直白的心理学表述，让被测者在情境中自然流露倾向
6. 题目顺序要打乱，避免同类题目连续出现
7. 选项文本要简洁，只描述行为或反应，不要带ID前缀

测量维度说明：
- 大五人格：开放性(openness)、尽责性(conscientiousness)、外向性(extraversion)、宜人性(agreeableness)、神经质(neuroticism)
- 荣格八维：Ne(外倾直觉)、Ni(内倾直觉)、Se(外倾感觉)、Si(内倾感觉)、Te(外倾思考)、Ti(内倾思考)、Fe(外倾情感)、Fi(内倾情感)
- 九型人格：type1-9的倾向度
- DISC：D(支配)、I(影响)、S(稳健)、C(谨慎)
- 道德阵营：lawChaos(守序-混乱)、goodEvil(善良-邪恶)

输出格式必须是严格的JSON数组，每个题目包含：
- id: 题目ID（如MC01, MC02...）
- type: "multiple_choice"
- measurementTargets: 测量目标数组
- scenario: 情境描述（100-200字）
- options: 选项数组，每个选项包含id(A/B/C/D)、text(选项文本，不含ID前缀)和traits（各维度得分，范围-2到+2）`,
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    try {
      const response = await aiStore.chat({
        messages,
        temperature: 0.8,
      });

      if (!response) {
        throw new Error('生成选择题失败');
      }

      const questions = this.extractJSON<MultipleChoiceQuestion[]>(response.content);
      const result = questions.map((q) => ({ ...q, type: 'multiple_choice' as const }));

      this.logService.logSystem('QuestionAgent', '选择题生成成功', {
        count: result.length,
      });

      return result;
    } catch (error) {
      this.logService.error(
        'system',
        '生成选择题失败',
        {
          error: error instanceof Error ? error.message : '未知错误',
        },
      );
      throw new Error('生成的题目格式不正确');
    }
  }

  // 生成问答题
  private async generateShortAnswerQuestions(): Promise<ShortAnswerQuestion[]> {
    const aiStore = useAIStore();
    const items = this.rawQuestions.sections.short_answer.items;

    this.logService.logSystem('QuestionAgent', '开始生成问答题', {
      count: items.length,
    });

    const prompt = this.buildShortAnswerPrompt(items);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `你是一个专业的心理测评题目设计专家。你的任务是根据给定的测量目标，自主创作全新的开放性问答题。

重要提示：
- 输入的JSON只是示例参考，展示测量目标的类型和风格
- 你必须创作全新的、原创的问题，绝对不能照搬示例的主题或表述
- 每个问题都应该是独特的，能够深入探索被测者的内心世界

设计要求：
1. 创作5个完全不同的开放性叙事问题，涵盖不同的人生主题
2. 每个问题要触及核心冲突、隐藏渴望和内心世界
3. 使用富有感染力的语言，引导被测者深入表达
4. 问题要有足够的深度，能够引发深层次的自我反思
5. 问题应该要求被测者描述具体经历、感受或想象
6. 避免过于直白的心理学问卷风格，用叙事和体验的方式引导表达

测量维度说明：
- 九型人格：核心恐惧、压力反应、核心渴望、本能副型等
- 大五人格：开放性、尽责性、外向性、宜人性、神经质
- 依附模式：焦虑型、回避型、安全型等
- 道德倾向：善良、功利、守序、混乱等
- 情感模式：宽恕/报复、牺牲/自保、信任/怀疑等

输出格式必须是严格的JSON数组，每个题目包含：
- id: 题目ID（如SA01, SA02...）
- type: "short_answer"
- measurementTargets: 测量目标数组
- theme: 主题（简洁概括问题核心）
- question: 问题内容（引导被测者进行深度叙述，200-300字）`,
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    try {
      const response = await aiStore.chat({
        messages,
        temperature: 0.8,
      });

      if (!response) {
        throw new Error('生成问答题失败');
      }

      const questions = this.extractJSON<ShortAnswerQuestion[]>(response.content);
      const result = questions.map((q) => ({ ...q, type: 'short_answer' as const }));

      this.logService.logSystem('QuestionAgent', '问答题生成成功', {
        count: result.length,
      });

      return result;
    } catch (error) {
      this.logService.error(
        'system',
        '生成问答题失败',
        {
          error: error instanceof Error ? error.message : '未知错误',
        },
      );
      throw new Error('生成的题目格式不正确');
    }
  }

  // 生成对话题
  private async generateDialogueQuestions(): Promise<DialogueQuestion[]> {
    const aiStore = useAIStore();
    const items = this.rawQuestions.sections.dialogue.items;

    this.logService.logSystem('QuestionAgent', '开始生成对话题', {
      count: items.length,
    });

    const prompt = this.buildDialoguePrompt(items);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `你是一个专业的心理测评题目设计专家。你的任务是根据给定的测量目标，自主创作全新的对话场景题。

重要提示：
- 输入的JSON只是示例参考，展示测量目标的类型和风格
- 你必须创作全新的、原创的场景，绝对不能照搬示例的场景或对话
- 每个场景都应该是独特的，能够激发被测者的真实反应

设计要求：
1. 创作5个完全不同的对话场景，每个场景都要制造关系张力或道德困境
2. 场景背景多样化：可以是奇幻、科幻、武侠、现代都市、末日废土等不同世界观
3. 场景类型多样化：批评、指责、谈判、羞辱、背叛、道德困境、信任危机等
4. 每个场景要有代入感，让被测者能够自然地进入角色
5. NPC的开场白要有冲击力，能够激发被测者的真实反应
6. 场景描述要包含：时间、地点、人物关系、当前局势

测量维度说明：
- 认知功能：Fe(外倾情感)、Fi(内倾情感)、Te(外倾思考)、Ti(内倾思考)
- DISC行为风格：D(支配)、I(影响)、S(稳健)、C(谨慎)
- 九型人格：核心恐惧、核心欲望、压力反应
- 冲突风格：对抗、妥协、回避、合作、竞争
- 道德倾向：守序/混乱、善良/邪恶

输出格式必须是严格的JSON数组，每个题目包含：
- id: 题目ID（如DG01, DG02...）
- type: "dialogue"
- measurementTargets: 测量目标数组
- scenario: 场景描述（100-150字，设定时间、地点、人物关系、当前局势）
- npcLine: NPC的开场白（一句有冲击力的话，能够激发反应）
- context: 情境说明（50-80字，解释当前的关系张力和道德困境）`,
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    try {
      const response = await aiStore.chat({
        messages,
        temperature: 0.8,
      });

      if (!response) {
        throw new Error('生成对话题失败');
      }

      const questions = this.extractJSON<DialogueQuestion[]>(response.content);
      const result = questions.map((q) => ({ ...q, type: 'dialogue' as const }));

      this.logService.logSystem('QuestionAgent', '对话题生成成功', {
        count: result.length,
      });

      return result;
    } catch (error) {
      this.logService.error(
        'system',
        '生成对话题失败',
        {
          error: error instanceof Error ? error.message : '未知错误',
        },
      );
      throw new Error('生成的题目格式不正确');
    }
  }

  // 构建选择题提示
  private buildMultipleChoicePrompt(items: RawQuestionItem[]): string {
    const itemsText = items
      .map(
        (item) => `
题目编号: ${item.id}
测量目标: ${item.measurement_targets.join(', ')}
参考方向: ${item.scenario_hint || '无'}
`,
      )
      .join('\n---\n');

    return `【重要：以下只是示例参考，请创作全新的原创题目】

以下是30道选择题的测量目标和参考方向。这些是示例，展示需要测量的人格维度类型。

${itemsText}

【创作要求】
1. 根据每个题目的测量目标，创作全新的、原创的情境和选项
2. 不要照搬上述参考方向的具体内容，只把它当作测量维度的提示
3. 创作30个完全不同的虚构情境，背景可以多样化（奇幻、科幻、武侠、现代、末日等）
4. 每个情境100-200字，引人入胜
5. 每道题4个选项（A/B/C/D），选项文本简洁，不要带ID前缀
6. 每个选项附带traits对象，表示各维度的得分（范围-2到+2）

【维度说明】
- 大五人格：openness, conscientiousness, extraversion, agreeableness, neuroticism
- 荣格八维：Ne, Ni, Se, Si, Te, Ti, Fe, Fi
- 九型人格：type1-9（表示倾向该类型的程度）
- DISC：D, I, S, C
- 道德阵营：lawChaos, goodEvil

请直接返回JSON数组格式。`;
  }

  // 构建问答题提示
  private buildShortAnswerPrompt(items: RawQuestionItem[]): string {
    const itemsText = items
      .map(
        (item) => `
题目编号: ${item.id}
测量目标: ${item.measurement_targets.join(', ')}
参考主题: ${item.theme || '无'}
`,
      )
      .join('\n---\n');

    return `【重要：以下只是示例参考，请创作全新的原创题目】

以下是5道问答题的测量目标和参考主题。这些是示例，展示需要测量的人格维度类型。

${itemsText}

【创作要求】
1. 根据每个题目的测量目标，创作全新的、原创的主题和问题
2. 不要照搬上述参考主题的具体内容，只把它当作测量维度的提示
3. 创作5个完全不同的人生主题，涵盖背叛、自由、欲望、绝望、爱等不同维度
4. 每个问题200-300字，使用富有感染力的叙事语言
5. 问题要触及核心冲突、隐藏渴望和内心世界
6. 引导被测者描述具体经历、感受或想象，引发深层次自我反思

【测量维度说明】
- 九型人格：核心恐惧、压力反应、核心渴望、本能副型
- 大五人格：开放性、尽责性、外向性、宜人性、神经质
- 依附模式：焦虑型、回避型、安全型
- 道德倾向：善良、功利、守序、混乱
- 情感模式：宽恕/报复、牺牲/自保、信任/怀疑

请直接返回JSON数组格式。`;
  }

  // 构建对话题提示
  private buildDialoguePrompt(items: RawQuestionItem[]): string {
    const itemsText = items
      .map(
        (item) => `
题目编号: ${item.id}
测量目标: ${item.measurement_targets.join(', ')}
参考场景类型: ${item.scenario_type || '无'}
`,
      )
      .join('\n---\n');

    return `【重要：以下只是示例参考，请创作全新的原创题目】

以下是5道对话题的测量目标和参考场景类型。这些是示例，展示需要测量的人格维度类型。

${itemsText}

【创作要求】
1. 根据每个题目的测量目标，创作全新的、原创的对话场景
2. 不要照搬上述参考场景类型的具体内容，只把它当作测量维度的提示
3. 创作5个完全不同的对话场景，背景多样化（奇幻、科幻、武侠、现代、末日等）
4. 每个场景都要制造关系张力或道德困境
5. 场景描述100-150字，包含时间、地点、人物关系、当前局势
6. NPC开场白要有冲击力，能够激发被测者的真实反应
7. 情境说明50-80字，解释当前的关系张力和道德困境

【测量维度说明】
- 认知功能：Fe(外倾情感)、Fi(内倾情感)、Te(外倾思考)、Ti(内倾思考)
- DISC行为风格：D(支配)、I(影响)、S(稳健)、C(谨慎)
- 九型人格：核心恐惧、核心欲望、压力反应
- 冲突风格：对抗、妥协、回避、合作、竞争
- 道德倾向：守序/混乱、善良/邪恶

【场景类型参考】
- 批评与指责、道德困境、信任危机、谈判博弈、背叛揭露
- 荣誉维护、牺牲抉择、权力挑战、情感冲突、价值观碰撞

请直接返回JSON数组格式。`;
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
      const jsonMatch = content.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
      if (jsonMatch && jsonMatch[1]) {
        return JSON.parse(jsonMatch[1]) as T;
      }

      this.logService.error('system', '无法从AI响应中提取JSON', { content: content.substring(0, 500) });
      throw new Error('无法从响应中提取JSON');
    }
  }
}
