import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  QuizState,
} from '@/types/question';
import { QuestionAgent, type ProgressCallback } from '@/services/quiz/QuestionAgent';
import { AnalysisAgent } from '@/services/quiz/AnalysisAgent';

// 原始题目数据（从question.json导入）
import questionData from '@/data/question.json';

// Quiz Store
export const useQuizStore = defineStore('quiz', () => {
  // ============ State ============
  const state = ref<QuizState>({
    questions: null,
    answers: {
      multipleChoice: {},
      shortAnswer: {},
      dialogue: {},
    },
    isGenerating: false,
    isAnalyzing: false,
    result: null,
    error: null,
    generationProgress: null,
  });

  const currentSection = ref<'multiple_choice' | 'short_answer' | 'dialogue' | 'result'>('multiple_choice');
  const currentIndex = ref(0);

  // ============ Getters ============
  const questions = computed(() => state.value.questions);
  const answers = computed(() => state.value.answers);
  const isGenerating = computed(() => state.value.isGenerating);
  const isAnalyzing = computed(() => state.value.isAnalyzing);
  const result = computed(() => state.value.result);
  const error = computed(() => state.value.error);

  // 当前题目
  const currentQuestion = computed(() => {
    if (!state.value.questions) return null;

    switch (currentSection.value) {
      case 'multiple_choice':
        return state.value.questions.multipleChoice[currentIndex.value] || null;
      case 'short_answer':
        return state.value.questions.shortAnswer[currentIndex.value] || null;
      case 'dialogue':
        return state.value.questions.dialogue[currentIndex.value] || null;
      default:
        return null;
    }
  });

  // 当前进度
  const progress = computed(() => {
    if (!state.value.questions) return { current: 0, total: 0, percentage: 0 };

    let current = 0;
    let total = 0;

    total += state.value.questions.multipleChoice.length;
    total += state.value.questions.shortAnswer.length;
    total += state.value.questions.dialogue.length;

    switch (currentSection.value) {
      case 'multiple_choice':
        current = currentIndex.value;
        break;
      case 'short_answer':
        current = state.value.questions.multipleChoice.length + currentIndex.value;
        break;
      case 'dialogue':
        current =
          state.value.questions.multipleChoice.length +
          state.value.questions.shortAnswer.length +
          currentIndex.value;
        break;
      case 'result':
        current = total;
        break;
    }

    return {
      current: current + 1,
      total,
      percentage: Math.round((current / total) * 100),
    };
  });

  // 是否已完成所有题目
  const isComplete = computed(() => {
    if (!state.value.questions) return false;

    const mcComplete =
      Object.keys(state.value.answers.multipleChoice).length ===
      state.value.questions.multipleChoice.length;
    const saComplete =
      Object.keys(state.value.answers.shortAnswer).length ===
      state.value.questions.shortAnswer.length;
    const dgComplete =
      Object.keys(state.value.answers.dialogue).length ===
      state.value.questions.dialogue.length;

    return mcComplete && saComplete && dgComplete;
  });

  // ============ Actions ============

  // 生成所有题目
  async function generateQuestions(onProgress?: ProgressCallback): Promise<boolean> {
    state.value.isGenerating = true;
    state.value.error = null;
    state.value.generationProgress = {
      total: 3,
      completed: 0,
      currentStage: '准备生成...',
      percentage: 0,
    };

    try {
      const agent = new QuestionAgent(questionData as never);

      // 包装进度回调
      const progressHandler: ProgressCallback = (stage, completed, total) => {
        state.value.generationProgress = {
          total,
          completed,
          currentStage: stage,
          percentage: Math.round((completed / total) * 100),
        };
        if (onProgress) {
          onProgress(stage, completed, total);
        }
      };

      const questions = await agent.generateAllQuestionsWithProgress(progressHandler);
      state.value.questions = questions;
      currentSection.value = 'multiple_choice';
      currentIndex.value = 0;
      return true;
    } catch (err) {
      state.value.error = err instanceof Error ? err.message : '生成题目失败';
      console.error('生成题目失败:', err);
      return false;
    } finally {
      state.value.isGenerating = false;
      state.value.generationProgress = null;
    }
  }

  // 仅生成选择题
  async function generateMultipleChoiceQuestions(): Promise<boolean> {
    state.value.isGenerating = true;
    state.value.error = null;
    state.value.generationProgress = {
      total: 1,
      completed: 0,
      currentStage: '正在生成选择题...',
      percentage: 0,
    };

    try {
      const agent = new QuestionAgent(questionData as never);
      const questions = await agent.generateOnlyMultipleChoiceQuestions();

      if (!state.value.questions) {
        state.value.questions = {
          multipleChoice: questions,
          shortAnswer: [],
          dialogue: [],
        };
      } else {
        state.value.questions.multipleChoice = questions;
      }

      // 清空之前的选择题答案
      state.value.answers.multipleChoice = {};
      currentIndex.value = 0;
      return true;
    } catch (err) {
      state.value.error = err instanceof Error ? err.message : '生成选择题失败';
      console.error('生成选择题失败:', err);
      return false;
    } finally {
      state.value.isGenerating = false;
      state.value.generationProgress = null;
    }
  }

  // 仅生成问答题
  async function generateShortAnswerQuestions(): Promise<boolean> {
    state.value.isGenerating = true;
    state.value.error = null;
    state.value.generationProgress = {
      total: 1,
      completed: 0,
      currentStage: '正在生成问答题...',
      percentage: 0,
    };

    try {
      const agent = new QuestionAgent(questionData as never);
      const questions = await agent.generateOnlyShortAnswerQuestions();

      if (!state.value.questions) {
        state.value.questions = {
          multipleChoice: [],
          shortAnswer: questions,
          dialogue: [],
        };
      } else {
        state.value.questions.shortAnswer = questions;
      }

      // 清空之前的问答题答案
      state.value.answers.shortAnswer = {};
      currentIndex.value = 0;
      return true;
    } catch (err) {
      state.value.error = err instanceof Error ? err.message : '生成问答题失败';
      console.error('生成问答题失败:', err);
      return false;
    } finally {
      state.value.isGenerating = false;
      state.value.generationProgress = null;
    }
  }

  // 仅生成对话题
  async function generateDialogueQuestions(): Promise<boolean> {
    state.value.isGenerating = true;
    state.value.error = null;
    state.value.generationProgress = {
      total: 1,
      completed: 0,
      currentStage: '正在生成对话题...',
      percentage: 0,
    };

    try {
      const agent = new QuestionAgent(questionData as never);
      const questions = await agent.generateOnlyDialogueQuestions();

      if (!state.value.questions) {
        state.value.questions = {
          multipleChoice: [],
          shortAnswer: [],
          dialogue: questions,
        };
      } else {
        state.value.questions.dialogue = questions;
      }

      // 清空之前的对话题答案
      state.value.answers.dialogue = {};
      currentIndex.value = 0;
      return true;
    } catch (err) {
      state.value.error = err instanceof Error ? err.message : '生成对话题失败';
      console.error('生成对话题失败:', err);
      return false;
    } finally {
      state.value.isGenerating = false;
      state.value.generationProgress = null;
    }
  }

  // 保存选择题答案
  function saveMultipleChoiceAnswer(questionId: string, optionId: string): void {
    state.value.answers.multipleChoice[questionId] = optionId;
  }

  // 保存问答题答案
  function saveShortAnswerAnswer(questionId: string, content: string): void {
    state.value.answers.shortAnswer[questionId] = content;
  }

  // 保存对话题答案
  function saveDialogueAnswer(
    questionId: string,
    innerThought: string,
    response: string,
  ): void {
    state.value.answers.dialogue[questionId] = { innerThought, response };
  }

  // 下一题
  function nextQuestion(): void {
    if (!state.value.questions) return;

    switch (currentSection.value) {
      case 'multiple_choice':
        if (currentIndex.value < state.value.questions.multipleChoice.length - 1) {
          currentIndex.value++;
        } else {
          currentSection.value = 'short_answer';
          currentIndex.value = 0;
        }
        break;
      case 'short_answer':
        if (currentIndex.value < state.value.questions.shortAnswer.length - 1) {
          currentIndex.value++;
        } else {
          currentSection.value = 'dialogue';
          currentIndex.value = 0;
        }
        break;
      case 'dialogue':
        if (currentIndex.value < state.value.questions.dialogue.length - 1) {
          currentIndex.value++;
        } else {
          currentSection.value = 'result';
        }
        break;
    }
  }

  // 上一题
  function prevQuestion(): void {
    if (!state.value.questions) return;

    switch (currentSection.value) {
      case 'multiple_choice':
        if (currentIndex.value > 0) {
          currentIndex.value--;
        }
        break;
      case 'short_answer':
        if (currentIndex.value > 0) {
          currentIndex.value--;
        } else {
          currentSection.value = 'multiple_choice';
          currentIndex.value = state.value.questions.multipleChoice.length - 1;
        }
        break;
      case 'dialogue':
        if (currentIndex.value > 0) {
          currentIndex.value--;
        } else {
          currentSection.value = 'short_answer';
          currentIndex.value = state.value.questions.shortAnswer.length - 1;
        }
        break;
      case 'result':
        currentSection.value = 'dialogue';
        currentIndex.value = state.value.questions.dialogue.length - 1;
        break;
    }
  }

  // 跳转到指定题目
  function goToQuestion(
    section: 'multiple_choice' | 'short_answer' | 'dialogue',
    index: number,
  ): void {
    currentSection.value = section;
    currentIndex.value = index;
  }

  // 分析答案并生成人物卡
  async function analyzeAnswers(): Promise<void> {
    if (!state.value.questions) {
      state.value.error = '没有可分析的答题数据';
      return;
    }

    state.value.isAnalyzing = true;
    state.value.error = null;

    try {
      const agent = new AnalysisAgent();
      const characterCard = await agent.analyzeAnswers(
        state.value.questions,
        state.value.answers,
      );
      state.value.result = characterCard;
      currentSection.value = 'result';
    } catch (err) {
      state.value.error = err instanceof Error ? err.message : '分析答案失败';
      console.error('分析答案失败:', err);
    } finally {
      state.value.isAnalyzing = false;
    }
  }

  // 重置答题状态
  function reset(): void {
    state.value = {
      questions: null,
      answers: {
        multipleChoice: {},
        shortAnswer: {},
        dialogue: {},
      },
      isGenerating: false,
      isAnalyzing: false,
      result: null,
      error: null,
      generationProgress: null,
    };
    currentSection.value = 'multiple_choice';
    currentIndex.value = 0;
  }

  // 重新开始（保留题目，清空答案）
  function restart(): void {
    state.value.answers = {
      multipleChoice: {},
      shortAnswer: {},
      dialogue: {},
    };
    state.value.result = null;
    state.value.error = null;
    currentSection.value = 'multiple_choice';
    currentIndex.value = 0;
  }

  // 生成进度
  const generationProgress = computed(() => state.value.generationProgress);

  return {
    // State
    state,
    currentSection,
    currentIndex,

    // Getters
    questions,
    answers,
    isGenerating,
    isAnalyzing,
    result,
    error,
    currentQuestion,
    progress,
    isComplete,
    generationProgress,

    // Actions
    generateQuestions,
    generateMultipleChoiceQuestions,
    generateShortAnswerQuestions,
    generateDialogueQuestions,
    saveMultipleChoiceAnswer,
    saveShortAnswerAnswer,
    saveDialogueAnswer,
    nextQuestion,
    prevQuestion,
    goToQuestion,
    analyzeAnswers,
    reset,
    restart,
  };
});
