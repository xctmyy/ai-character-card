<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { DialogueQuestion as DGQuestion } from '@/types/question';

const props = defineProps<{
  question: DGQuestion;
  innerThought: string;
  response: string;
  questionNumber: number;
  totalQuestions: number;
}>();

const emit = defineEmits<{
  (e: 'update:innerThought', value: string): void;
  (e: 'update:response', value: string): void;
}>();

const localInnerThought = ref(props.innerThought);
const localResponse = ref(props.response);

// 同步外部变化
watch(() => props.innerThought, (newVal) => {
  localInnerThought.value = newVal;
});

watch(() => props.response, (newVal) => {
  localResponse.value = newVal;
});

// 防抖更新
let timeout1: ReturnType<typeof setTimeout>;
let timeout2: ReturnType<typeof setTimeout>;

function onInnerThoughtInput() {
  clearTimeout(timeout1);
  timeout1 = setTimeout(() => {
    emit('update:innerThought', localInnerThought.value);
  }, 300);
}

function onResponseInput() {
  clearTimeout(timeout2);
  timeout2 = setTimeout(() => {
    emit('update:response', localResponse.value);
  }, 300);
}

const progressPercent = computed(() => {
  return Math.round((props.questionNumber / props.totalQuestions) * 100);
});
</script>

<template>
  <div class="dg-question">
    <!-- 进度条 -->
    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: `${progressPercent}%` }"></div>
      <span class="progress-text">对话题 {{ questionNumber }} / {{ totalQuestions }}</span>
    </div>

    <!-- 场景设定 -->
    <div class="scene-setting">
      <h4 class="scene-title">📍 场景设定</h4>
      <p class="scene-text">{{ question.scenario }}</p>
    </div>

    <!-- NPC对话 -->
    <div class="npc-dialogue">
      <div class="npc-avatar">🎭</div>
      <div class="npc-bubble">
        <p class="npc-text">{{ question.npcLine }}</p>
      </div>
    </div>

    <!-- 情境说明 -->
    <div class="context-box">
      <span class="context-label">情境</span>
      <p class="context-text">{{ question.context }}</p>
    </div>

    <!-- 测量目标 -->
    <div class="measurement-tags">
      <span
        v-for="target in question.measurementTargets"
        :key="target"
        class="tag"
      >
        {{ target }}
      </span>
    </div>

    <!-- 回答区域 -->
    <div class="response-section">
      <!-- 内心活动 -->
      <div class="input-group">
        <label class="input-label">
          <span class="label-icon">💭</span>
          内心活动
          <span class="label-hint">（角色此刻的想法、感受）</span>
        </label>
        <textarea
          v-model="localInnerThought"
          class="input-textarea inner-thought"
          rows="4"
          placeholder="描述角色听到这句话时的内心反应..."
          @input="onInnerThoughtInput"
        ></textarea>
      </div>

      <!-- 实际回应 -->
      <div class="input-group">
        <label class="input-label">
          <span class="label-icon">💬</span>
          实际回应
          <span class="label-hint">（角色说出口的话）</span>
        </label>
        <textarea
          v-model="localResponse"
          class="input-textarea response"
          rows="4"
          placeholder="写出角色的实际回答..."
          @input="onResponseInput"
        ></textarea>
      </div>
    </div>

    <!-- 提示 -->
    <div class="tips">
      <h4 class="tips-title">🎬 角色扮演提示</h4>
      <ul class="tips-list">
        <li>尝试代入角色的视角和情感</li>
        <li>内心活动可以展现真实的想法，不必与外在表现一致</li>
        <li>回应要符合场景的氛围和关系张力</li>
        <li>可以展现角色的矛盾、挣扎或决断</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.dg-question {
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
  background: linear-gradient(90deg, #ff6b6b, #feca57);
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

.scene-setting {
  background: linear-gradient(135deg, #2d3436 0%, #636e72 100%);
  color: #fff;
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 20px;
}

.scene-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 10px 0;
  opacity: 0.9;
}

.scene-text {
  font-size: 15px;
  line-height: 1.6;
  margin: 0;
  opacity: 0.95;
}

.npc-dialogue {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.npc-avatar {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}

.npc-bubble {
  flex: 1;
  background: #f8f9fa;
  border: 2px solid #e9ecef;
  border-radius: 16px;
  border-top-left-radius: 4px;
  padding: 16px 20px;
  position: relative;
}

.npc-text {
  font-size: 16px;
  line-height: 1.6;
  color: #333;
  margin: 0;
  font-style: italic;
}

.context-box {
  background: #fff3e0;
  border-left: 4px solid #ff9800;
  padding: 12px 16px;
  border-radius: 0 8px 8px 0;
  margin-bottom: 16px;
}

.context-label {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  color: #e65100;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.context-text {
  font-size: 14px;
  color: #5d4037;
  margin: 0;
  line-height: 1.5;
}

.measurement-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 24px;
}

.tag {
  padding: 4px 10px;
  background: #ffebee;
  color: #c62828;
  font-size: 12px;
  border-radius: 12px;
  border: 1px solid #ffcdd2;
}

.response-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 24px;
}

.input-group {
  display: flex;
  flex-direction: column;
}

.input-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #444;
  margin-bottom: 10px;
}

.label-icon {
  font-size: 18px;
}

.label-hint {
  font-size: 12px;
  color: #888;
  font-weight: 400;
}

.input-textarea {
  width: 100%;
  padding: 14px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  font-size: 15px;
  line-height: 1.6;
  resize: vertical;
  transition: border-color 0.2s;
  font-family: inherit;
  box-sizing: border-box;
}

.input-textarea:focus {
  outline: none;
}

.input-textarea.inner-thought:focus {
  border-color: #9c27b0;
}

.input-textarea.response:focus {
  border-color: #2196f3;
}

.input-textarea.inner-thought {
  background: #faf5ff;
}

.input-textarea.response {
  background: #f3f8ff;
}

.tips {
  background: #e8f5e9;
  border: 1px solid #a5d6a7;
  border-radius: 10px;
  padding: 16px 20px;
}

.tips-title {
  font-size: 14px;
  font-weight: 600;
  color: #2e7d32;
  margin: 0 0 12px 0;
}

.tips-list {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: #555;
  line-height: 1.8;
}

.tips-list li {
  margin-bottom: 4px;
}

@media (max-width: 640px) {
  .dg-question {
    padding: 16px;
  }

  .npc-avatar {
    width: 40px;
    height: 40px;
    font-size: 20px;
  }

  .npc-text {
    font-size: 15px;
  }

  .input-textarea {
    padding: 12px;
    font-size: 14px;
  }
}
</style>
