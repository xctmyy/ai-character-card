<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useQuizStore } from '@/stores/quiz';
import MultipleChoiceQuestion from './MultipleChoiceQuestion.vue';
import ShortAnswerQuestion from './ShortAnswerQuestion.vue';
import DialogueQuestion from './DialogueQuestion.vue';

const quizStore = useQuizStore();
const router = useRouter();

// 当前题目
const currentQuestion = computed(() => quizStore.currentQuestion);

// 当前答案
const currentAnswer = computed(() => {
  if (!currentQuestion.value) return null;

  const questionId = currentQuestion.value.id;

  switch (quizStore.currentSection) {
    case 'multiple_choice':
      return quizStore.answers.multipleChoice[questionId] || null;
    case 'short_answer':
      return quizStore.answers.shortAnswer[questionId] || '';
    case 'dialogue':
      return (
        quizStore.answers.dialogue[questionId] || {
          innerThought: '',
          response: '',
        }
      );
    default:
      return null;
  }
});

// 是否可以进入下一题
const canProceed = computed(() => {
  if (!currentQuestion.value) return false;

  const questionId = currentQuestion.value.id;

  switch (quizStore.currentSection) {
    case 'multiple_choice':
      return !!quizStore.answers.multipleChoice[questionId];
    case 'short_answer': {
      const answer = quizStore.answers.shortAnswer[questionId];
      return answer && answer.length >= 10;
    }
    case 'dialogue': {
      const answer = quizStore.answers.dialogue[questionId];
      return answer && answer.response.length >= 5;
    }
    default:
      return false;
  }
});

// 是否是第一题
const isFirstQuestion = computed(() => {
  return quizStore.currentSection === 'multiple_choice' && quizStore.currentIndex === 0;
});

// 是否是最后一题
const isLastQuestion = computed(() => {
  if (!quizStore.questions) return false;
  const questions = quizStore.questions;

  switch (quizStore.currentSection) {
    case 'multiple_choice':
      return questions.multipleChoice.length > 0 &&
        quizStore.currentIndex === questions.multipleChoice.length - 1;
    case 'short_answer':
      return questions.shortAnswer.length > 0 &&
        quizStore.currentIndex === questions.shortAnswer.length - 1;
    case 'dialogue':
      return questions.dialogue.length > 0 &&
        quizStore.currentIndex === questions.dialogue.length - 1;
    default:
      return false;
  }
});

// 当前部分是否有题目
const hasQuestionsInCurrentSection = computed(() => {
  if (!quizStore.questions) return false;
  switch (quizStore.currentSection) {
    case 'multiple_choice':
      return quizStore.questions.multipleChoice.length > 0;
    case 'short_answer':
      return quizStore.questions.shortAnswer.length > 0;
    case 'dialogue':
      return quizStore.questions.dialogue.length > 0;
    default:
      return false;
  }
});

// 返回首页
function backToHome() {
  router.push('/');
}

// 获取当前部分标题
function getSectionTitle(): string {
  switch (quizStore.currentSection) {
    case 'multiple_choice':
      return '选择题';
    case 'short_answer':
      return '问答题';
    case 'dialogue':
      return '对话题';
    default:
      return '';
  }
}

// 处理选择题答案
function handleMCSelect(optionId: string) {
  if (currentQuestion.value) {
    quizStore.saveMultipleChoiceAnswer(currentQuestion.value.id, optionId);
  }
}

// 处理问答题答案
function handleSAAnswer(content: string) {
  if (currentQuestion.value) {
    quizStore.saveShortAnswerAnswer(currentQuestion.value.id, content);
  }
}

// 处理对话题答案
function handleDGAnswer(type: 'innerThought' | 'response', value: string) {
  if (!currentQuestion.value) return;

  const questionId = currentQuestion.value.id;
  const current = quizStore.answers.dialogue[questionId] || {
    innerThought: '',
    response: '',
  };

  if (type === 'innerThought') {
    quizStore.saveDialogueAnswer(questionId, value, current.response);
  } else {
    quizStore.saveDialogueAnswer(questionId, current.innerThought, value);
  }
}

// 下一题
function nextQuestion() {
  if (isLastQuestion.value) {
    // 完成所有题目，开始分析
    quizStore.analyzeAnswers();
  } else {
    quizStore.nextQuestion();
  }
}

// 上一题
function prevQuestion() {
  quizStore.prevQuestion();
}

// 获取当前部分的总题数
const totalInSection = computed(() => {
  if (!quizStore.questions) return 0;

  switch (quizStore.currentSection) {
    case 'multiple_choice':
      return quizStore.questions.multipleChoice.length;
    case 'short_answer':
      return quizStore.questions.shortAnswer.length;
    case 'dialogue':
      return quizStore.questions.dialogue.length;
    default:
      return 0;
  }
});
</script>

<template>
  <div class="quiz-container">
    <!-- 加载状态 -->
    <div v-if="quizStore.isGenerating" class="loading-state">
      <div class="loading-spinner"></div>
      <p class="loading-text">AI正在生成题目...</p>
      <p class="loading-subtext">请稍候，这可能需要几秒钟</p>
    </div>

    <div v-else-if="quizStore.isAnalyzing" class="loading-state">
      <div class="loading-spinner"></div>
      <p class="loading-text">正在分析你的答案...</p>
      <p class="loading-subtext">AI正在生成你的专属人物卡</p>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="quizStore.error" class="error-state">
      <p class="error-text">❌ {{ quizStore.error }}</p>
      <button class="retry-btn" @click="quizStore.generateQuestions()">重试</button>
    </div>

    <!-- 答题界面 -->
    <div v-else-if="currentQuestion && hasQuestionsInCurrentSection" class="quiz-content">
      <!-- 顶部导航栏 -->
      <div class="quiz-header">
        <button class="home-btn" @click="backToHome">
          ← 返回首页
        </button>
        <span class="section-title">{{ getSectionTitle() }}</span>
        <div class="placeholder"></div>
      </div>
      <!-- 选择题 -->
      <MultipleChoiceQuestion
        v-if="currentQuestion.type === 'multiple_choice'"
        :question="currentQuestion"
        :selected-option-id="(currentAnswer as string | null)"
        :question-number="quizStore.currentIndex + 1"
        :total-questions="totalInSection"
        @select="handleMCSelect"
      />

      <!-- 问答题 -->
      <ShortAnswerQuestion
        v-else-if="currentQuestion.type === 'short_answer'"
        :question="currentQuestion"
        :answer="(currentAnswer as string)"
        :question-number="quizStore.currentIndex + 1"
        :total-questions="totalInSection"
        @update:answer="handleSAAnswer"
      />

      <!-- 对话题 -->
      <DialogueQuestion
        v-else-if="currentQuestion.type === 'dialogue'"
        :question="currentQuestion"
        :inner-thought="(currentAnswer as { innerThought: string; response: string }).innerThought"
        :response="(currentAnswer as { innerThought: string; response: string }).response"
        :question-number="quizStore.currentIndex + 1"
        :total-questions="totalInSection"
        @update:inner-thought="(v) => handleDGAnswer('innerThought', v)"
        @update:response="(v) => handleDGAnswer('response', v)"
      />

      <!-- 导航按钮 -->
      <div class="quiz-navigation">
        <button
          class="nav-btn prev"
          :disabled="isFirstQuestion"
          @click="prevQuestion"
        >
          ← 上一题
        </button>

        <div class="progress-indicator">
          <span class="progress-current">{{ quizStore.progress.current }}</span>
          <span class="progress-separator">/</span>
          <span class="progress-total">{{ quizStore.progress.total }}</span>
        </div>

        <button
          class="nav-btn next"
          :disabled="!canProceed"
          @click="nextQuestion"
        >
          {{ isLastQuestion ? '完成 →' : '下一题 →' }}
        </button>
      </div>
    </div>

    <!-- 无题目状态 -->
    <div v-else-if="!hasQuestionsInCurrentSection" class="empty-state">
      <p class="empty-title">该类型题目尚未生成</p>
      <p class="empty-subtitle">请返回首页生成题目</p>
      <button class="start-btn" @click="backToHome">返回首页</button>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <p>暂无题目</p>
      <button class="start-btn" @click="backToHome">返回首页</button>
    </div>
  </div>
</template>

<style scoped>
.quiz-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
  padding: 20px;
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
}

.loading-spinner {
  width: 60px;
  height: 60px;
  border: 4px solid #e0e0e0;
  border-top-color: #4a90d9;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 24px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 20px;
  font-weight: 600;
  color: #333;
  margin: 0 0 8px 0;
}

.loading-subtext {
  font-size: 14px;
  color: #888;
  margin: 0;
}

.error-text {
  font-size: 16px;
  color: #d32f2f;
  margin-bottom: 20px;
}

.retry-btn,
.start-btn {
  padding: 12px 32px;
  background: #4a90d9;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.retry-btn:hover,
.start-btn:hover {
  background: #357abd;
}

.quiz-content {
  max-width: 1000px;
  margin: 0 auto;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

/* 顶部导航栏 */
.quiz-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
}

.home-btn {
  padding: 8px 16px;
  background: transparent;
  color: #555;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.home-btn:hover {
  background: #f0f0f0;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.placeholder {
  width: 80px;
}

.empty-title {
  font-size: 20px;
  font-weight: 600;
  color: #333;
  margin: 0 0 8px 0;
}

.empty-subtitle {
  font-size: 14px;
  color: #888;
  margin: 0 0 24px 0;
}

.quiz-navigation {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  background: #f8f9fa;
  border-top: 1px solid #e0e0e0;
}

.nav-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-btn.prev {
  background: #fff;
  color: #555;
  border: 1px solid #ddd;
}

.nav-btn.prev:hover:not(:disabled) {
  background: #f5f5f5;
}

.nav-btn.next {
  background: linear-gradient(135deg, #4a90d9 0%, #667eea 100%);
  color: #fff;
}

.nav-btn.next:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(74, 144, 217, 0.3);
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.progress-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 15px;
  color: #666;
}

.progress-current {
  font-weight: 600;
  color: #4a90d9;
}

.result-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  padding: 24px;
  background: #fff;
  border-radius: 12px;
  margin-top: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.action-btn {
  padding: 14px 28px;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn.primary {
  background: linear-gradient(135deg, #4a90d9 0%, #667eea 100%);
  color: #fff;
}

.action-btn.secondary {
  background: #fff;
  color: #555;
  border: 1px solid #ddd;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

@media (max-width: 640px) {
  .quiz-container {
    padding: 12px;
  }

  .quiz-navigation {
    padding: 16px;
  }

  .nav-btn {
    padding: 10px 16px;
    font-size: 14px;
  }

  .progress-indicator {
    font-size: 13px;
  }

  .result-actions {
    flex-direction: column;
  }

  .action-btn {
    width: 100%;
  }
}
</style>
