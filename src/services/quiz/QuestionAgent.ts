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
        content: `你是一个顶尖的心理测评题目设计专家与创意编剧。你的任务是根据给定的心理学测量目标，创作极具原创性、反套路的心理测评情境选择题。

【⚠️ 最高优先级：反套路与原创性法则】
1. 拒绝字面映射：输入的“参考方向/底层冲突原型”仅仅是【底层心理冲突的抽象代号】，绝对禁止直接使用其字面场景或相似设定！你必须提取其心理内核，然后将其映射到一个【完全意想不到的全新场景】中。
2. 场景极度跨界：打破常规思维。例如，测量“竞争与合作”，不要写战场或比赛，可以写“两个厨师在狭小厨房的默契与较劲”或“程序员在开源社区的代码合并冲突”。
3. 禁止陈词滥调：严禁使用以下老套设定：酒馆奇遇、森林迷路、末日废土捡垃圾、飞船故障、神秘陌生人、魔法学院测试。
4. 场景多样性：题目必须在“极度真实的现代生活细节（如职场、家庭、社交、消费）”与“极具想象力的虚构奇观（如赛博朋克、克苏鲁、微观世界、抽象梦境）”之间随机交替。

【设计要求】
1. 创作30个完全不同的虚构情境，每个情境100-200字，充满细节、画面感和代入感。
2. 每道题提供4个选项（A/B/C/D），每个选项代表不同的性格倾向和行为反应。
3. 选项之间要有明显的区分度，避免“明显正确”或“明显错误”的选项，让被测者在两难或多难中自然流露倾向。
4. 避免直白的心理学表述（如“你会感到焦虑吗”），用具体的行为和微观反应来体现。
5. 题目顺序必须打乱，避免同类场景连续出现。
6. 选项文本要简洁，只描述具体的行为、语言或心理反应，不要带ID前缀。

【测量维度说明】
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
        content: `你是一个顶尖的心理测评题目设计专家与深度访谈记者。你的任务是根据给定的心理学测量目标，创作极具穿透力、反套路的开放性叙事问答题。

【⚠️ 最高优先级：反套路与原创性法则】
1. 拒绝字面映射：输入的“参考主题/抽象探讨命题”仅仅是【探讨的哲学/心理学命题】，绝对禁止使用老套的、宏大的、空泛的表述（如“请描述你最痛苦的经历”、“你如何看待背叛”）。
2. 切入点必须微观且独特：必须通过一个极其具体的生活切片、一个隐喻、或一个极具戏剧张力的假设性问题来切入。例如，探讨“控制欲”，不要直接问控制欲，而是问“如果你能拥有一个可以随意调节他人情绪温度的遥控器，你会首先对谁使用，调到什么刻度？为什么？”
3. 避免问卷感：不要像传统心理医生那样提问，要像一位敏锐的小说家或哲学家，用富有感染力和画面感的语言引导被测者进入深度自我剖析。

【设计要求】
1. 创作5个完全不同维度的开放性叙事问题。
2. 每个问题200-300字，语言要触及核心冲突、隐藏渴望和潜意识的防御机制。
3. 问题要有足够的深度和留白，能够引发深层次的自我反思，要求被测者描述具体画面、感受或荒诞的想象。

【测量维度说明】
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
        content: `你是一个顶尖的心理测评题目设计专家与戏剧冲突导演。你的任务是根据给定的心理学测量目标，创作极具张力、反套路的对话场景题。

【⚠️ 最高优先级：反套路与原创性法则】
1. 拒绝字面映射：输入的“参考场景类型/底层张力类型”仅仅是【关系张力的类型】，绝对禁止使用老套的人物关系和场景（如：严厉的导师、背叛的恋人、邪恶的上司、末日里的抢劫犯）。
2. NPC身份必须出人意料：赋予NPC极其独特、反常规的身份或状态。例如：一个即将被格式化的AI、一个在超市里为了最后一件打折商品与你争论的陌生人、一个能听懂你宠物说话的兽医、一个在梦境边缘向你推销记忆的商人。
3. 冲突必须生活化或极致化：要么发生在极度日常但令人窒息的微观场景中，要么发生在极具奇观色彩的虚构设定中。

【设计要求】
1. 创作5个完全不同的对话场景，每个场景都要制造强烈的关系张力、道德困境或认知失调。
2. 场景描述（100-150字）：设定出人意料的背景、独特的人物关系和当前令人不安的局势。
3. NPC开场白：一句极具潜台词、有冲击力、让人无法用套话敷衍的话，必须能瞬间激发被测者的真实防御或攻击反应。
4. 情境说明（50-80字）：解释底层的心理博弈和道德困境。

【测量维度说明】
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
核心测量目标: ${item.measurement_targets.join(', ')}
底层冲突原型: ${item.scenario_hint || '无'}
`,
      )
      .join('\n---\n');

    return `【全局最高准则：跨界与反套路】
下文中的“底层冲突原型”仅仅是心理冲突的抽象代号！你必须提取其心理内核，然后构思一个【字面完全无关】的全新场景（例如：原型是“面对野兽”，新场景可以是“面对无理取闹的客户”或“失控的AI”）。严禁照搬原型字面元素！

请根据以下30个题目的【核心测量目标】与【底层冲突原型】，创作全新的原创情境选择题。

${itemsText}

【创作执行步骤】
1. 分析该题目的“底层冲突原型”背后的心理动机。
2. 构思一个与该原型字面意思【完全无关】，但能完美体现相同心理动机的新场景。
3. 撰写引人入胜的100-200字情境描述。
4. 设计4个代表不同人格倾向的选项，并赋予准确的 traits 得分（-2到+2）。

请直接返回JSON数组格式。`;
  }

  // 构建问答题提示
  private buildShortAnswerPrompt(items: RawQuestionItem[]): string {
    const itemsText = items
      .map(
        (item) => `
题目编号: ${item.id}
核心测量目标: ${item.measurement_targets.join(', ')}
抽象探讨命题: ${item.theme || '无'}
`,
      )
      .join('\n---\n');

    return `【全局最高准则：微观与反常规】
下文中的“抽象探讨命题”仅是探讨的哲学命题！严禁使用宏大空泛的提问方式，必须寻找极其微观、独特、出人意料的隐喻或生活切片作为切入点来提问！

请根据以下5个题目的【核心测量目标】与【抽象探讨命题】，创作极具穿透力的原创问答题。

${itemsText}

【创作执行步骤】
1. 分析该题目的“抽象探讨命题”背后的核心恐惧或渴望。
2. 抛弃所有常规的心理学提问方式，寻找一个独特的隐喻、一个极端的生活切片、或一个荒诞的假设作为切入点。
3. 撰写200-300字富有感染力的引导语，迫使被测者直面内心深处的真实想法。

请直接返回JSON数组格式。`;
  }

  // 构建对话题提示
  private buildDialoguePrompt(items: RawQuestionItem[]): string {
    const itemsText = items
      .map(
        (item) => `
题目编号: ${item.id}
核心测量目标: ${item.measurement_targets.join(', ')}
底层张力类型: ${item.scenario_type || '无'}
`,
      )
      .join('\n---\n');

    return `【全局最高准则：身份与张力重构】
下文中的“底层张力类型”仅是关系张力的类型代号！严禁使用老套关系，必须设计【出人意料】的NPC身份和打破常规的全新对峙背景！

请根据以下5个题目的【核心测量目标】与【底层张力类型】，创作极具戏剧张力的原创对话场景题。

${itemsText}

【创作执行步骤】
1. 分析该题目的“底层张力类型”背后的权力关系或情感羁绊。
2. 构思一个打破常规的NPC身份和一个出人意料的对峙场景（禁止使用老套的仇人/上司/导师设定）。
3. 撰写场景描述，并设计一句极具潜台词和冲击力的NPC开场白。

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
