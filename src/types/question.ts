// 题目类型定义

// 题目类型
export type QuestionType = 'multiple_choice' | 'short_answer' | 'dialogue'

// 测量目标
export interface MeasurementTarget {
  dimension: string
  aspect: string
}

// 基础题目
export interface BaseQuestion {
  id: string
  type: QuestionType
  measurementTargets: string[]
}

// 选择题选项
export interface ChoiceOption {
  id: string
  text: string
  traits: Record<string, number> // 各维度得分
}

// 选择题
export interface MultipleChoiceQuestion extends BaseQuestion {
  type: 'multiple_choice'
  scenario: string
  options: ChoiceOption[]
}

// 问答题
export interface ShortAnswerQuestion extends BaseQuestion {
  type: 'short_answer'
  theme: string
  question: string
}

// 对话题
export interface DialogueQuestion extends BaseQuestion {
  type: 'dialogue'
  scenario: string
  npcLine: string
  context: string
}

// 联合类型
export type Question = MultipleChoiceQuestion | ShortAnswerQuestion | DialogueQuestion

// 答案类型
export interface MultipleChoiceAnswer {
  questionId: string
  selectedOptionId: string
}

export interface ShortAnswerAnswer {
  questionId: string
  content: string
}

export interface DialogueAnswer {
  questionId: string
  innerThought: string
  response: string
}

export type Answer = MultipleChoiceAnswer | ShortAnswerAnswer | DialogueAnswer

// 答题进度
export interface QuizProgress {
  currentSection: QuestionType
  currentIndex: number
  completedSections: QuestionType[]
}

// 人物卡结果
export interface CharacterCard {
  // 大五人格
  bigFive: {
    openness: number
    conscientiousness: number
    extraversion: number
    agreeableness: number
    neuroticism: number
  }
  // 荣格八维
  cognitiveFunctions: {
    Ne: number
    Ni: number
    Se: number
    Si: number
    Te: number
    Ti: number
    Fe: number
    Fi: number
  }
  // 九型人格
  enneagram: {
    type: number
    wing: number
    instinctualVariant: string
  }
  // MBTI
  mbti: string
  // DISC
  disc: {
    D: number
    I: number
    S: number
    C: number
    primary: string
  }
  // 道德阵营
  moralAlignment: {
    lawChaos: number
    goodEvil: number
    label: string
  }
  // 性格描述
  description: string
  // 角色建议
  characterSuggestions: {
    archetype: string
    strengths: string[]
    weaknesses: string[]
    growthDirection: string
  }
}

// AI生成的题目
export interface AIGeneratedQuestions {
  multipleChoice: MultipleChoiceQuestion[]
  shortAnswer: ShortAnswerQuestion[]
  dialogue: DialogueQuestion[]
}

// 生成进度
export interface GenerationProgress {
  total: number
  completed: number
  currentStage: string
  percentage: number
}

// 答题状态
export interface QuizState {
  questions: AIGeneratedQuestions | null
  answers: {
    multipleChoice: Record<string, string> // questionId -> optionId
    shortAnswer: Record<string, string> // questionId -> content
    dialogue: Record<string, { innerThought: string; response: string }> // questionId -> answer
  }
  isGenerating: boolean
  isAnalyzing: boolean
  result: CharacterCard | null
  error: string | null
  generationProgress: GenerationProgress | null
}
