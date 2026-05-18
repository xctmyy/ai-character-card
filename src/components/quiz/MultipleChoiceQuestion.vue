<script setup lang="ts">
import { computed } from 'vue';
import type { MultipleChoiceQuestion as MCQuestion } from '@/types/question';

const props = defineProps<{
  question: MCQuestion;
  selectedOptionId: string | null;
  questionNumber: number;
  totalQuestions: number;
}>();

const emit = defineEmits<{
  (e: 'select', optionId: string): void;
}>();

const progressPercent = computed(() => {
  return Math.round((props.questionNumber / props.totalQuestions) * 100);
});

function selectOption(optionId: string) {
  emit('select', optionId);
}

// 清理选项文本，去掉ID前缀
function cleanOptionText(text: string): string {
  // 匹配类似 "MC02_A " 或 "A " 这样的前缀
  const match = text.match(/^\s*[A-Za-z0-9_]+\s+/);
  if (match) {
    return text.substring(match[0].length).trim();
  }
  return text;
}
</script>

<template>
  <div class="mc-question">
    <!-- 进度条 -->
    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: `${progressPercent}%` }"></div>
      <span class="progress-text">选择题 {{ questionNumber }} / {{ totalQuestions }}</span>
    </div>

    <!-- 题目内容 -->
    <div class="question-content">
      <div class="scenario">
        <p class="scenario-text">{{ question.scenario }}</p>
      </div>

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

    <!-- 选项列表 -->
    <div class="options-list">
      <button
        v-for="(option, index) in question.options"
        :key="option.id"
        class="option-btn"
        :class="{ selected: selectedOptionId === option.id }"
        @click="selectOption(option.id)"
      >
        <span class="option-letter">{{ String.fromCharCode(65 + index) }}</span>
        <span class="option-text">{{ cleanOptionText(option.text) }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.mc-question {
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
  background: linear-gradient(90deg, #4a90d9, #667eea);
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
  margin-bottom: 32px;
}

.scenario {
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
  padding: 24px;
  border-radius: 12px;
  margin-bottom: 16px;
  border-left: 4px solid #4a90d9;
}

.scenario-text {
  font-size: 16px;
  line-height: 1.8;
  color: #333;
  margin: 0;
  text-align: justify;
}

.measurement-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  padding: 4px 10px;
  background: #e3f2fd;
  color: #1976d2;
  font-size: 12px;
  border-radius: 12px;
  border: 1px solid #bbdefb;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.option-btn {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px 20px;
  background: #fff;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.option-btn:hover {
  border-color: #4a90d9;
  background: #f8fbff;
  transform: translateX(4px);
}

.option-btn.selected {
  border-color: #4a90d9;
  background: #e3f2fd;
  box-shadow: 0 2px 8px rgba(74, 144, 217, 0.2);
}

.option-letter {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  border-radius: 50%;
  font-weight: 600;
  color: #666;
  font-size: 14px;
}

.option-btn.selected .option-letter {
  background: #4a90d9;
  color: #fff;
}

.option-text {
  flex: 1;
  font-size: 15px;
  line-height: 1.6;
  color: #444;
}

.option-btn.selected .option-text {
  color: #1565c0;
  font-weight: 500;
}

@media (max-width: 640px) {
  .mc-question {
    padding: 16px;
  }

  .scenario {
    padding: 16px;
  }

  .scenario-text {
    font-size: 15px;
  }

  .option-btn {
    padding: 12px 16px;
  }

  .option-letter {
    width: 28px;
    height: 28px;
    font-size: 13px;
  }

  .option-text {
    font-size: 14px;
  }
}
</style>
