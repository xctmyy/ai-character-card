<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { ShortAnswerQuestion as SAQuestion } from '@/types/question';

const props = defineProps<{
  question: SAQuestion;
  answer: string;
  questionNumber: number;
  totalQuestions: number;
}>();

const emit = defineEmits<{
  (e: 'update:answer', value: string): void;
}>();

const localAnswer = ref(props.answer);

// 同步外部answer变化
watch(() => props.answer, (newVal) => {
  localAnswer.value = newVal;
});

// 防抖更新
let timeout: ReturnType<typeof setTimeout>;
function onInput() {
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    emit('update:answer', localAnswer.value);
  }, 300);
}

const progressPercent = computed(() => {
  return Math.round((props.questionNumber / props.totalQuestions) * 100);
});
</script>

<template>
  <div class="sa-question">
    <!-- 进度条 -->
    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: `${progressPercent}%` }"></div>
      <span class="progress-text">问答题 {{ questionNumber }} / {{ totalQuestions }}</span>
    </div>

    <!-- 题目内容 -->
    <div class="question-content">
      <div class="theme-badge">
        <span class="theme-label">主题</span>
        <span class="theme-text">{{ question.theme }}</span>
      </div>

      <h3 class="question-title">{{ question.question }}</h3>

      <!-- 测量目标标签 -->
      <div class="measurement-tags">
        <span
          v-for="target in question.measurementTargets"
          :key="target"
          class="tag"
        >
          {{ target }}
        </span>
      </div>
    </div>

    <!-- 答题区域 -->
    <div class="answer-section">
      <label class="answer-label">你的回答</label>
      <textarea
        v-model="localAnswer"
        class="answer-textarea"
        rows="8"
        placeholder="请详细描述你的想法、经历或感受..."
        @input="onInput"
      ></textarea>
      <div class="word-count">
        {{ localAnswer.length }} 字
        <span v-if="localAnswer.length < 50" class="hint">（建议至少50字）</span>
      </div>
    </div>

    <!-- 提示 -->
    <div class="tips">
      <h4 class="tips-title">💡 写作提示</h4>
      <ul class="tips-list">
        <li>尽量具体描述情境和细节</li>
        <li>表达真实的情感和想法</li>
        <li>可以结合个人经历或想象</li>
        <li>不需要担心文采，真诚最重要</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.sa-question {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
}

.progress-bar {
  position: relative;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  margin-bottom: 24px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #9c27b0, #e91e63);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  position: absolute;
  right: 0;
  top: -20px;
  font-size: 12px;
  color: #666;
}

.question-content {
  margin-bottom: 24px;
}

.theme-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.theme-label {
  padding: 4px 10px;
  background: #e1bee7;
  color: #7b1fa2;
  font-size: 12px;
  border-radius: 12px;
  font-weight: 500;
}

.theme-text {
  font-size: 14px;
  color: #666;
}

.question-title {
  font-size: 20px;
  font-weight: 600;
  color: #333;
  line-height: 1.5;
  margin: 0 0 16px 0;
}

.measurement-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  padding: 4px 10px;
  background: #f3e5f5;
  color: #7b1fa2;
  font-size: 12px;
  border-radius: 12px;
  border: 1px solid #e1bee7;
}

.answer-section {
  margin-bottom: 24px;
}

.answer-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #444;
  margin-bottom: 8px;
}

.answer-textarea {
  width: 100%;
  padding: 16px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  font-size: 15px;
  line-height: 1.7;
  resize: vertical;
  transition: border-color 0.2s;
  font-family: inherit;
  box-sizing: border-box;
}

.answer-textarea:focus {
  outline: none;
  border-color: #9c27b0;
}

.answer-textarea::placeholder {
  color: #aaa;
}

.word-count {
  margin-top: 8px;
  font-size: 13px;
  color: #666;
  text-align: right;
}

.word-count .hint {
  color: #999;
  margin-left: 8px;
}

.tips {
  background: #fff8e1;
  border: 1px solid #ffe082;
  border-radius: 10px;
  padding: 16px 20px;
}

.tips-title {
  font-size: 14px;
  font-weight: 600;
  color: #f57c00;
  margin: 0 0 12px 0;
}

.tips-list {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: #666;
  line-height: 1.8;
}

.tips-list li {
  margin-bottom: 4px;
}

@media (max-width: 640px) {
  .sa-question {
    padding: 16px;
  }

  .question-title {
    font-size: 18px;
  }

  .answer-textarea {
    padding: 12px;
    font-size: 14px;
  }
}
</style>
