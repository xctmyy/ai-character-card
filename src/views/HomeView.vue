<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAIStore } from '@/stores/ai';
import { useQuizStore } from '@/stores/quiz';
import AISettings from '@/components/AISettings.vue';
import MultipleChoiceQuestion from '@/components/quiz/MultipleChoiceQuestion.vue';
import ShortAnswerQuestion from '@/components/quiz/ShortAnswerQuestion.vue';
import DialogueQuestion from '@/components/quiz/DialogueQuestion.vue';
import JSZip from 'jszip';

const aiStore = useAIStore();
const quizStore = useQuizStore();

// 页面状态
const currentView = ref<'home' | 'quiz'>('home');
const activeSection = ref<'multiple_choice' | 'short_answer' | 'dialogue'>('multiple_choice');
const currentIndex = ref(0);

// 角色卡弹窗
const showCharacterModal = ref(false);
const characterName = ref('');
const uploadedImage = ref<string | null>(null);
const generatedCard = ref<string | null>(null);
const isGeneratingCard = ref(false);

// 分析结果
const analysisResult = ref<{
  quantitative: Record<string, number>;
  description: string;
  brief: string;
  skillsGuide?: string;
} | null>(null);

// 检查是否已完成某类题目
const hasCompletedMC = computed(() => Object.keys(quizStore.answers.multipleChoice).length > 0);
const hasCompletedSA = computed(() => Object.keys(quizStore.answers.shortAnswer).length > 0);
const hasCompletedDG = computed(() => Object.keys(quizStore.answers.dialogue).length > 0);
const canGenerateResult = computed(() => hasCompletedMC.value || hasCompletedSA.value || hasCompletedDG.value);

// 获取某类题目的完成进度
const getProgress = (section: 'multiple_choice' | 'short_answer' | 'dialogue') => {
  if (!quizStore.questions) return { current: 0, total: 0 };

  switch (section) {
    case 'multiple_choice':
      return {
        current: Object.keys(quizStore.answers.multipleChoice).length,
        total: quizStore.questions.multipleChoice.length,
      };
    case 'short_answer':
      return {
        current: Object.keys(quizStore.answers.shortAnswer).length,
        total: quizStore.questions.shortAnswer.length,
      };
    case 'dialogue':
      return {
        current: Object.keys(quizStore.answers.dialogue).length,
        total: quizStore.questions.dialogue.length,
      };
  }
};

// 生成选择题
async function generateMultipleChoice() {
  if (!aiStore.hasConfig) {
    alert('请先配置AI服务');
    return;
  }
  const success = await quizStore.generateMultipleChoiceQuestions();
  if (success) {
    activeSection.value = 'multiple_choice';
    currentIndex.value = 0;
    currentView.value = 'quiz';
  }
}

// 生成问答题
async function generateShortAnswer() {
  if (!aiStore.hasConfig) {
    alert('请先配置AI服务');
    return;
  }
  const success = await quizStore.generateShortAnswerQuestions();
  if (success) {
    activeSection.value = 'short_answer';
    currentIndex.value = 0;
    currentView.value = 'quiz';
  }
}

// 生成对话题
async function generateDialogue() {
  if (!aiStore.hasConfig) {
    alert('请先配置AI服务');
    return;
  }
  const success = await quizStore.generateDialogueQuestions();
  if (success) {
    activeSection.value = 'dialogue';
    currentIndex.value = 0;
    currentView.value = 'quiz';
  }
}

// 返回首页
function backToHome() {
  currentView.value = 'home';
}

// 获取当前题目
const currentQuestion = computed(() => {
  if (!quizStore.questions) return null;

  switch (activeSection.value) {
    case 'multiple_choice':
      return quizStore.questions.multipleChoice[currentIndex.value] || null;
    case 'short_answer':
      return quizStore.questions.shortAnswer[currentIndex.value] || null;
    case 'dialogue':
      return quizStore.questions.dialogue[currentIndex.value] || null;
    default:
      return null;
  }
});

// 获取当前答案
const currentAnswer = computed(() => {
  if (!currentQuestion.value) return null;

  const questionId = currentQuestion.value.id;
  switch (activeSection.value) {
    case 'multiple_choice':
      return quizStore.answers.multipleChoice[questionId] || null;
    case 'short_answer':
      return quizStore.answers.shortAnswer[questionId] || '';
    case 'dialogue':
      return quizStore.answers.dialogue[questionId] || { innerThought: '', response: '' };
    default:
      return null;
  }
});

// 是否可以进入下一题
const canProceed = computed(() => {
  if (!currentQuestion.value) return false;

  const questionId = currentQuestion.value.id;
  switch (activeSection.value) {
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

// 是否是最后一题
const isLastQuestion = computed(() => {
  if (!quizStore.questions) return false;

  switch (activeSection.value) {
    case 'multiple_choice':
      return currentIndex.value === quizStore.questions.multipleChoice.length - 1;
    case 'short_answer':
      return currentIndex.value === quizStore.questions.shortAnswer.length - 1;
    case 'dialogue':
      return currentIndex.value === quizStore.questions.dialogue.length - 1;
    default:
      return false;
  }
});

// 处理答案
function handleMCSelect(optionId: string) {
  if (currentQuestion.value) {
    quizStore.saveMultipleChoiceAnswer(currentQuestion.value.id, optionId);
  }
}

function handleSAAnswer(content: string) {
  if (currentQuestion.value) {
    quizStore.saveShortAnswerAnswer(currentQuestion.value.id, content);
  }
}

function handleDGAnswer(type: 'innerThought' | 'response', value: string) {
  if (!currentQuestion.value) return;

  const questionId = currentQuestion.value.id;
  const current = quizStore.answers.dialogue[questionId] || { innerThought: '', response: '' };

  if (type === 'innerThought') {
    quizStore.saveDialogueAnswer(questionId, value, current.response);
  } else {
    quizStore.saveDialogueAnswer(questionId, current.innerThought, value);
  }
}

// 下一题
function nextQuestion() {
  if (isLastQuestion.value) {
    // 完成当前类型，返回首页
    backToHome();
  } else {
    currentIndex.value++;
  }
}

// 上一题
function prevQuestion() {
  if (currentIndex.value > 0) {
    currentIndex.value--;
  }
}

// 获取当前部分的总题数
const totalInSection = computed(() => {
  if (!quizStore.questions) return 0;

  switch (activeSection.value) {
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

// 构造答题数据JSON
function constructAnswerJSON() {
  const data: {
    multipleChoice: Array<{ question: { id: string; scenario: string; measurementTargets: string[] }; selectedOption: { id: string; text: string } }>;
    shortAnswer: Array<{ question: { id: string; theme: string; question: string; measurementTargets: string[] }; answer: string }>;
    dialogue: Array<{ question: { id: string; scenario: string; npcLine: string; context: string; measurementTargets: string[] }; answer: { innerThought: string; response: string } }>;
  } = {
    multipleChoice: [],
    shortAnswer: [],
    dialogue: [],
  };

  if (quizStore.questions) {
    // 选择题 - 带选中选项的完整内容
    quizStore.questions.multipleChoice.forEach((q) => {
      const selectedOptionId = quizStore.answers.multipleChoice[q.id];
      if (selectedOptionId) {
        const selectedOption = q.options.find((opt) => opt.id === selectedOptionId);
        data.multipleChoice.push({
          question: {
            id: q.id,
            scenario: q.scenario,
            measurementTargets: q.measurementTargets,
          },
          selectedOption: {
            id: selectedOptionId,
            text: selectedOption?.text || '',
          },
        });
      }
    });

    // 问答题
    quizStore.questions.shortAnswer.forEach((q) => {
      const answer = quizStore.answers.shortAnswer[q.id];
      if (answer) {
        data.shortAnswer.push({
          question: {
            id: q.id,
            theme: q.theme,
            question: q.question,
            measurementTargets: q.measurementTargets,
          },
          answer: answer,
        });
      }
    });

    // 对话题
    quizStore.questions.dialogue.forEach((q) => {
      const answer = quizStore.answers.dialogue[q.id];
      if (answer) {
        data.dialogue.push({
          question: {
            id: q.id,
            scenario: q.scenario,
            npcLine: q.npcLine,
            context: q.context,
            measurementTargets: q.measurementTargets,
          },
          answer: answer,
        });
      }
    });
  }

  return data;
}

// 分析答案
async function analyzeAnswers() {
  if (!aiStore.hasConfig) {
    alert('请先配置AI服务');
    return;
  }
  if (!canGenerateResult.value) {
    alert('请至少完成一类题目后再生成画像');
    return;
  }

  quizStore.state.isAnalyzing = true;

  try {
    const answerData = constructAnswerJSON();

    const prompt = `基于以下答题数据，进行深度性格分析并生成角色画像：

${JSON.stringify(answerData, null, 2)}

请基于以上答题数据进行深度分析，生成以下内容（严格按JSON格式返回）：
{
  "quantitative": {
    "bigFive_openness": 0-100,
    "bigFive_conscientiousness": 0-100,
    "bigFive_extraversion": 0-100,
    "bigFive_agreeableness": 0-100,
    "bigFive_neuroticism": 0-100,
    "mbti_ei": 0-100,
    "mbti_sn": 0-100,
    "mbti_tf": 0-100,
    "mbti_jp": 0-100,
    "enneagram_type": 1-9,
    "enneagram_wing": 1-9,
    "disc_d": 0-100,
    "disc_i": 0-100,
    "disc_s": 0-100,
    "disc_c": 0-100,
    "cognitive_ne": 0-100,
    "cognitive_ni": 0-100,
    "cognitive_se": 0-100,
    "cognitive_si": 0-100,
    "cognitive_te": 0-100,
    "cognitive_ti": 0-100,
    "cognitive_fe": 0-100,
    "cognitive_fi": 0-100,
    "holland_r": 0-100,
    "holland_i": 0-100,
    "holland_a": 0-100,
    "holland_s": 0-100,
    "holland_e": 0-100,
    "holland_c": 0-100,
    "attachment_anxiety": 0-100,
    "attachment_avoidance": 0-100,
    "resilience": 0-100,
    "empathy": 0-100,
    "creativity": 0-100,
    "leadership": 0-100,
    "adaptability": 0-100
  },
  "description": "详细的性格描述，800-1000字，深入描述这个人的：1)核心性格特质 2)行为模式与决策风格 3)人际关系特点 4)内心世界与情感模式 5)优势与成长空间 6)适合的发展方向",
  "brief": "30字以内的简短简介，用于角色卡展示",
  "skillsGuide": "AI使用指南，描述如何根据此性格特点进行互动，包括：说话风格、思考方式、价值观、情感反应模式等，500-800字"
}`;

    const response = await aiStore.chat({
      messages: [
        { role: 'system', content: '你是一个专业的性格分析师，擅长根据答题数据分析人物性格并生成角色画像。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    });

    if (response) {
      const content = response.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult.value = JSON.parse(jsonMatch[0]);
        showCharacterModal.value = true;
      }
    }
  } catch (err) {
    console.error('分析失败:', err);
    alert('分析失败，请重试');
  } finally {
    quizStore.state.isAnalyzing = false;
  }
}

// 处理图片上传
function handleImageUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedImage.value = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
}

// 生成角色卡
async function generateCharacterCard() {
  if (!characterName.value || !uploadedImage.value || !analysisResult.value) return;

  isGeneratingCard.value = true;

  // 创建Canvas绘制角色卡
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 绘制RPG风格边框背景
  const gradient = ctx.createLinearGradient(0, 0, 600, 800);
  gradient.addColorStop(0, '#1a1a2e');
  gradient.addColorStop(0.5, '#16213e');
  gradient.addColorStop(1, '#0f3460');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 600, 800);

  // 绘制金色边框
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 8;
  ctx.strokeRect(20, 20, 560, 760);

  // 绘制内边框
  ctx.strokeStyle = '#c5a028';
  ctx.lineWidth = 4;
  ctx.strokeRect(35, 35, 530, 730);

  // 绘制角落装饰
  ctx.fillStyle = '#d4af37';
  const cornerSize = 30;
  // 左上
  ctx.fillRect(20, 20, cornerSize, 8);
  ctx.fillRect(20, 20, 8, cornerSize);
  // 右上
  ctx.fillRect(550, 20, cornerSize, 8);
  ctx.fillRect(572, 20, 8, cornerSize);
  // 左下
  ctx.fillRect(20, 772, cornerSize, 8);
  ctx.fillRect(20, 750, 8, cornerSize);
  // 右下
  ctx.fillRect(550, 772, cornerSize, 8);
  ctx.fillRect(572, 750, 8, cornerSize);

  // 绘制图片区域
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    if (!analysisResult.value) return;

    // 绘制图片边框
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 4;
    ctx.strokeRect(148, 98, 304, 304);

    // 绘制图片（圆形裁剪）
    ctx.save();
    ctx.beginPath();
    ctx.arc(300, 250, 140, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, 150, 100, 300, 300);
    ctx.restore();

    // 绘制名字（艺术字体）
    ctx.font = 'bold 42px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#d4af37';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    ctx.fillText(characterName.value || '', 300, 480);

    // 绘制简介
    ctx.font = '20px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#e0e0e0';
    ctx.shadowBlur = 0;

    const brief = analysisResult.value.brief || '';
    const maxWidth = 520;
    const words = brief.split('');
    let line = '';
    let y = 530;

    for (let i = 0; i < words.length; i++) {
      const char = words[i] || '';
      const testLine = line + char;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && i > 0) {
        ctx.fillText(line, 300, y);
        line = char;
        y += 28;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 300, y);

    // 绘制装饰线
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(100, 580);
    ctx.lineTo(500, 580);
    ctx.stroke();

    // 绘制量化数据
    ctx.font = '16px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#b0b0b0';
    ctx.textAlign = 'left';

    const quantitative = analysisResult.value.quantitative || {};
    let dataY = 620;
    Object.entries(quantitative).slice(0, 6).forEach(([key, value]) => {
      ctx.fillText(`${key}: ${value}`, 80, dataY);
      dataY += 24;
    });

    // 生成图片
    generatedCard.value = canvas.toDataURL('image/png');
    isGeneratingCard.value = false;
  };
  img.onerror = () => {
    isGeneratingCard.value = false;
    alert('图片加载失败');
  };
  img.src = uploadedImage.value || '';
}

// 生成name_skills.md内容
function generateSkillsMd(): string {
  const name = characterName.value || 'Character';
  const result = analysisResult.value;
  if (!result) return '';

  const q = result.quantitative;

  // 计算MBTI类型
  const mbtiType = `${(q.mbti_ei ?? 50) >= 50 ? 'E' : 'I'}${(q.mbti_sn ?? 50) >= 50 ? 'N' : 'S'}${(q.mbti_tf ?? 50) >= 50 ? 'F' : 'T'}${(q.mbti_jp ?? 50) >= 50 ? 'J' : 'P'}`;

  // 计算主导认知功能
  const cognitiveFunctions = [
    { name: 'Ne', value: q.cognitive_ne ?? 50 },
    { name: 'Ni', value: q.cognitive_ni ?? 50 },
    { name: 'Se', value: q.cognitive_se ?? 50 },
    { name: 'Si', value: q.cognitive_si ?? 50 },
    { name: 'Te', value: q.cognitive_te ?? 50 },
    { name: 'Ti', value: q.cognitive_ti ?? 50 },
    { name: 'Fe', value: q.cognitive_fe ?? 50 },
    { name: 'Fi', value: q.cognitive_fi ?? 50 },
  ].sort((a, b) => (b.value ?? 50) - (a.value ?? 50));

  const dominantFunction = cognitiveFunctions[0]?.name ?? 'Ne';
  const auxiliaryFunction = cognitiveFunctions[1]?.name ?? 'Ni';

  return `# ${name} - AI Personality Profile

## Basic Information

- **Name**: ${name}
- **MBTI Type**: ${mbtiType}
- **Enneagram**: Type ${q.enneagram_type ?? 1}w${q.enneagram_wing ?? 2}
- **Dominant Cognitive Function**: ${dominantFunction}
- **Auxiliary Cognitive Function**: ${auxiliaryFunction}

## Quantitative Data

### Big Five Personality
- Openness: ${q.bigFive_openness ?? 50}/100
- Conscientiousness: ${q.bigFive_conscientiousness ?? 50}/100
- Extraversion: ${q.bigFive_extraversion ?? 50}/100
- Agreeableness: ${q.bigFive_agreeableness ?? 50}/100
- Neuroticism: ${q.bigFive_neuroticism ?? 50}/100

### MBTI Dimensions
- Extraversion (E) vs Introversion (I): ${q.mbti_ei ?? 50}/100
- Sensing (S) vs Intuition (N): ${q.mbti_sn ?? 50}/100
- Thinking (T) vs Feeling (F): ${q.mbti_tf ?? 50}/100
- Judging (J) vs Perceiving (P): ${q.mbti_jp ?? 50}/100

### Cognitive Functions
- Extraverted Intuition (Ne): ${q.cognitive_ne ?? 50}/100
- Introverted Intuition (Ni): ${q.cognitive_ni ?? 50}/100
- Extraverted Sensing (Se): ${q.cognitive_se ?? 50}/100
- Introverted Sensing (Si): ${q.cognitive_si ?? 50}/100
- Extraverted Thinking (Te): ${q.cognitive_te ?? 50}/100
- Introverted Thinking (Ti): ${q.cognitive_ti ?? 50}/100
- Extraverted Feeling (Fe): ${q.cognitive_fe ?? 50}/100
- Introverted Feeling (Fi): ${q.cognitive_fi ?? 50}/100

### DISC Profile
- Dominance (D): ${q.disc_d ?? 50}/100
- Influence (I): ${q.disc_i ?? 50}/100
- Steadiness (S): ${q.disc_s ?? 50}/100
- Conscientiousness (C): ${q.disc_c ?? 50}/100

### Holland Code (RIASEC)
- Realistic (R): ${q.holland_r ?? 50}/100
- Investigative (I): ${q.holland_i ?? 50}/100
- Artistic (A): ${q.holland_a ?? 50}/100
- Social (S): ${q.holland_s ?? 50}/100
- Enterprising (E): ${q.holland_e ?? 50}/100
- Conventional (C): ${q.holland_c ?? 50}/100

### Additional Traits
- Attachment Anxiety: ${q.attachment_anxiety ?? 50}/100
- Attachment Avoidance: ${q.attachment_avoidance ?? 50}/100
- Resilience: ${q.resilience ?? 50}/100
- Empathy: ${q.empathy ?? 50}/100
- Creativity: ${q.creativity ?? 50}/100
- Leadership: ${q.leadership ?? 50}/100
- Adaptability: ${q.adaptability ?? 50}/100

## Personality Description

${result.description}

## Brief Summary

${result.brief}

## AI Interaction Guide

${result.skillsGuide || 'No specific interaction guide available.'}

## Usage Notes for AI

When roleplaying as ${name}:

1. **Communication Style**: Adapt your tone and vocabulary to match their personality type (${mbtiType}).
2. **Decision Making**: Consider their cognitive functions (${dominantFunction} and ${auxiliaryFunction}) when determining how they approach problems.
3. **Emotional Responses**: Factor in their Big Five traits, especially Neuroticism (${q.bigFive_neuroticism ?? 50}/100) when handling emotional situations.
4. **Social Interactions**: Use their Extraversion score (${q.bigFive_extraversion ?? 50}/100) to guide social behavior.
5. **Values and Priorities**: Reflect their DISC profile (D:${q.disc_d ?? 50} I:${q.disc_i ?? 50} S:${q.disc_s ?? 50} C:${q.disc_c ?? 50}) in their motivations.

---
*Generated by Character Card Generator*
`;
}

// 下载ZIP
async function downloadZip() {
  if (!analysisResult.value || !generatedCard.value) return;

  const zip = new JSZip();

  // 添加量化数据JSON
  zip.file('character-data.json', JSON.stringify(analysisResult.value.quantitative, null, 2));

  // 添加描述文件
  zip.file('character-description.txt', analysisResult.value.description);

  // 添加AI使用指南
  zip.file(`${characterName.value || 'character'}_skills.md`, generateSkillsMd());

  // 添加角色卡图片
  const imgData = generatedCard.value.split(',')[1];
  if (imgData) {
    zip.file('character-card.png', imgData, { base64: true });
  }

  // 生成并下载
  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${characterName.value || 'character'}-profile.zip`;
  link.click();
  URL.revokeObjectURL(url);
}

// 关闭弹窗并重置
function closeModal() {
  showCharacterModal.value = false;
  characterName.value = '';
  uploadedImage.value = null;
  generatedCard.value = null;
}
</script>

<template>
  <div class="home-view">
    <!-- 首页视图 -->
    <div v-if="currentView === 'home'" class="home-content">
      <!-- 头部 -->
      <header class="hero-section">
        <div class="hero-content">
          <h1 class="hero-title">多维人物卡生成器</h1>
          <p class="hero-subtitle">
            通过AI驱动的深度心理测评，探索你的性格维度<br />
            生成专属的人物卡，发现真实的自己
          </p>
        </div>
      </header>

      <!-- 主要内容 -->
      <main class="main-content">
        <!-- AI设置 -->
        <section class="settings-section">
          <h2 class="section-title">AI服务配置</h2>
          <AISettings />
        </section>

        <!-- 三类题目按钮 -->
        <section class="generate-section">
          <h2 class="section-title">选择题目类型</h2>
          <div class="generate-buttons">
            <button
              class="generate-btn"
              :class="{
                completed: hasCompletedMC
              }"
              :disabled="!aiStore.hasConfig || quizStore.isGenerating"
              @click="generateMultipleChoice"
            >
              <span class="btn-status" v-if="hasCompletedMC">已完成 {{ getProgress('multiple_choice').current }}/{{ getProgress('multiple_choice').total }}</span>
              <span class="btn-icon">选择题</span>
              <span class="btn-count">30道</span>
              <span class="btn-desc">情境化选择题，探索你的性格倾向</span>
            </button>

            <button
              class="generate-btn"
              :class="{
                completed: hasCompletedSA
              }"
              :disabled="!aiStore.hasConfig || quizStore.isGenerating"
              @click="generateShortAnswer"
            >
              <span class="btn-status" v-if="hasCompletedSA">已完成 {{ getProgress('short_answer').current }}/{{ getProgress('short_answer').total }}</span>
              <span class="btn-icon">问答题</span>
              <span class="btn-count">5道</span>
              <span class="btn-desc">开放性问题，深入内心世界</span>
            </button>

            <button
              class="generate-btn"
              :class="{
                completed: hasCompletedDG
              }"
              :disabled="!aiStore.hasConfig || quizStore.isGenerating"
              @click="generateDialogue"
            >
              <span class="btn-status" v-if="hasCompletedDG">已完成 {{ getProgress('dialogue').current }}/{{ getProgress('dialogue').total }}</span>
              <span class="btn-icon">对话题</span>
              <span class="btn-count">5道</span>
              <span class="btn-desc">对话场景，展现真实反应</span>
            </button>
          </div>
        </section>

        <!-- 生成进度 -->
        <section v-if="quizStore.isGenerating && quizStore.generationProgress" class="progress-section">
          <div class="progress-container">
            <div class="progress-info">
              <span class="progress-stage">{{ quizStore.generationProgress.currentStage }}</span>
              <span class="progress-percentage">{{ quizStore.generationProgress.percentage }}%</span>
            </div>
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: quizStore.generationProgress.percentage + '%' }"
              />
            </div>
          </div>
        </section>

        <!-- 生成人物画像按钮 -->
        <section class="result-section">
          <button
            class="result-btn"
            :disabled="!aiStore.hasConfig || !canGenerateResult || quizStore.isAnalyzing"
            @click="analyzeAnswers"
          >
            <span v-if="quizStore.isAnalyzing" class="btn-loading">
              <span class="loading-dot"></span>
              <span class="loading-dot"></span>
              <span class="loading-dot"></span>
            </span>
            <span v-else>生成人物画像</span>
          </button>
          <p v-if="!canGenerateResult" class="result-hint">
            请至少完成一类题目后生成画像
          </p>
        </section>
      </main>
    </div>

    <!-- 答题视图 -->
    <div v-else-if="currentView === 'quiz'" class="quiz-content">
      <!-- 顶部导航 -->
      <div class="quiz-header">
        <button class="home-btn" @click="backToHome">
          ← 返回首页
        </button>
        <span class="section-title">
          {{ activeSection === 'multiple_choice' ? '选择题' : activeSection === 'short_answer' ? '问答题' : '对话题' }}
        </span>
        <div class="placeholder"></div>
      </div>

      <!-- 题目区域 -->
      <div v-if="currentQuestion" class="question-area">
        <MultipleChoiceQuestion
          v-if="activeSection === 'multiple_choice' && currentQuestion.type === 'multiple_choice'"
          :question="currentQuestion"
          :selected-option-id="(currentAnswer as string | null)"
          :question-number="currentIndex + 1"
          :total-questions="totalInSection"
          @select="handleMCSelect"
        />

        <ShortAnswerQuestion
          v-else-if="activeSection === 'short_answer' && currentQuestion.type === 'short_answer'"
          :question="currentQuestion"
          :answer="(currentAnswer as string)"
          :question-number="currentIndex + 1"
          :total-questions="totalInSection"
          @update:answer="handleSAAnswer"
        />

        <DialogueQuestion
          v-else-if="activeSection === 'dialogue' && currentQuestion.type === 'dialogue'"
          :question="currentQuestion"
          :inner-thought="(currentAnswer as { innerThought: string; response: string }).innerThought"
          :response="(currentAnswer as { innerThought: string; response: string }).response"
          :question-number="currentIndex + 1"
          :total-questions="totalInSection"
          @update:inner-thought="(v) => handleDGAnswer('innerThought', v)"
          @update:response="(v) => handleDGAnswer('response', v)"
        />

        <!-- 导航按钮 -->
        <div class="quiz-navigation">
          <button
            class="nav-btn prev"
            :disabled="currentIndex === 0"
            @click="prevQuestion"
          >
            ← 上一题
          </button>

          <div class="progress-indicator">
            <span class="progress-current">{{ currentIndex + 1 }}</span>
            <span class="progress-separator">/</span>
            <span class="progress-total">{{ totalInSection }}</span>
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
      <div v-else class="empty-state">
        <p class="empty-title">该类型题目尚未生成</p>
        <button class="start-btn" @click="backToHome">返回首页</button>
      </div>
    </div>

    <!-- 角色卡生成弹窗 -->
    <div v-if="showCharacterModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">生成角色卡</h2>
          <button class="close-btn" @click="closeModal">×</button>
        </div>

        <div class="modal-body">
          <!-- 输入名字 -->
          <div class="form-group">
            <label class="form-label">角色名字</label>
            <input
              v-model="characterName"
              type="text"
              class="form-input"
              placeholder="请输入角色名字"
              maxlength="10"
            />
          </div>

          <!-- 上传图片 -->
          <div class="form-group">
            <label class="form-label">上传头像</label>
            <div class="upload-area">
              <input
                type="file"
                accept="image/*"
                class="file-input"
                @change="handleImageUpload"
              />
              <div v-if="!uploadedImage" class="upload-placeholder">
                <span class="upload-icon">+</span>
                <span class="upload-text">点击上传图片</span>
              </div>
              <img v-else :src="uploadedImage" class="upload-preview" />
            </div>
          </div>

          <!-- 生成的角色卡预览 -->
          <div v-if="generatedCard" class="card-preview">
            <h3 class="preview-title">角色卡预览</h3>
            <img :src="generatedCard" class="preview-image" />
          </div>
        </div>

        <div class="modal-footer">
          <button
            v-if="!generatedCard"
            class="generate-card-btn"
            :disabled="!characterName || !uploadedImage || isGeneratingCard"
            @click="generateCharacterCard"
          >
            <span v-if="isGeneratingCard">生成中...</span>
            <span v-else>生成角色卡</span>
          </button>
          <button
            v-else
            class="download-btn"
            @click="downloadZip"
          >
            下载角色档案(ZIP)
          </button>
        </div>
      </div>
    </div>

    <!-- 页脚 -->
    <footer class="footer">
      <p>Made by _tmyy with VibeCoding | AI驱动的心理测评与角色生成</p>
    </footer>
  </div>
</template>

<style scoped>
.home-view {
  min-height: 100vh;
  background: #1a1a2e;
}

.home-content {
  padding-bottom: 40px;
}

.hero-section {
  padding: 60px 20px;
  text-align: center;
  color: #fff;
}

.hero-content {
  max-width: 800px;
  margin: 0 auto;
}

.hero-title {
  font-size: 42px;
  font-weight: 700;
  margin: 0 0 20px 0;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

.hero-subtitle {
  font-size: 18px;
  line-height: 1.7;
  margin: 0;
  opacity: 0.95;
}

.main-content {
  max-width: 900px;
  margin: 0 auto;
  padding: 0 20px;
}

.settings-section {
  margin-bottom: 40px;
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  color: #fff;
  margin: 0 0 20px 0;
  text-align: center;
}

/* 生成按钮区域 */
.generate-section {
  margin-bottom: 40px;
}

.generate-buttons {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.generate-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 28px 20px;
  background: #fff;
  border: 2px solid transparent;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.generate-btn:hover:not(:disabled) {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  border-color: #4a90d9;
}

.generate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.generate-btn.completed {
  border-color: #4caf50;
  background: linear-gradient(135deg, #fff 0%, #f1f8f4 100%);
}

.generate-btn.active {
  border-color: #ff6b6b;
  box-shadow: 0 0 0 3px rgba(255, 107, 107, 0.2);
}

.btn-status {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 4px 12px;
  background: #4caf50;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  border-radius: 20px;
}

.btn-icon {
  font-size: 20px;
  font-weight: 700;
  color: #333;
}

.btn-count {
  font-size: 14px;
  color: #4a90d9;
  font-weight: 600;
}

.btn-desc {
  font-size: 13px;
  color: #888;
  text-align: center;
  line-height: 1.5;
}

/* 进度条 */
.progress-section {
  margin-bottom: 40px;
}

.progress-container {
  padding: 24px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.progress-stage {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.progress-percentage {
  font-size: 14px;
  font-weight: 600;
  color: #4a90d9;
}

.progress-bar {
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #4a90d9;
  border-radius: 4px;
  transition: width 0.3s ease;
}

/* 生成结果按钮 */
.result-section {
  text-align: center;
  padding-bottom: 40px;
}

.result-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px 48px;
  background: #4caf50;
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 16px rgba(76, 175, 80, 0.3);
}

.result-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(76, 175, 80, 0.4);
}

.result-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-loading {
  display: flex;
  gap: 6px;
}

.loading-dot {
  width: 8px;
  height: 8px;
  background: #fff;
  border-radius: 50%;
  animation: bounce 1.4s ease-in-out infinite both;
}

.loading-dot:nth-child(1) {
  animation-delay: -0.32s;
}

.loading-dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

.result-hint {
  margin: 16px 0 0 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
}

/* 答题区域 */
.quiz-content {
  min-height: 100vh;
  background: #f8f9fa;
}

.quiz-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
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

.question-area {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

.quiz-navigation {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  background: #fff;
  border-radius: 12px;
  margin-top: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
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
  background: #4a90d9;
  color: #fff;
}

.nav-btn.next:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(74, 144, 217, 0.4);
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.progress-indicator {
  font-size: 16px;
  color: #666;
}

.progress-current {
  font-weight: 600;
  color: #4a90d9;
}

.progress-separator {
  margin: 0 4px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
}

.empty-title {
  font-size: 20px;
  font-weight: 600;
  color: #333;
  margin: 0 0 16px 0;
}

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

.start-btn:hover {
  background: #357abd;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: #fff;
  border-radius: 16px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-title {
  font-size: 20px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.close-btn {
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  font-size: 24px;
  color: #999;
  cursor: pointer;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
}

.form-input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 15px;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: #4a90d9;
}

.upload-area {
  position: relative;
  width: 100%;
  height: 150px;
  border: 2px dashed #ddd;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.file-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  z-index: 10;
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #999;
}

.upload-icon {
  font-size: 32px;
}

.upload-text {
  font-size: 14px;
}

.upload-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-preview {
  margin-top: 20px;
  text-align: center;
}

.preview-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin: 0 0 12px 0;
}

.preview-image {
  max-width: 100%;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.modal-footer {
  padding: 20px 24px;
  border-top: 1px solid #e0e0e0;
}

.generate-card-btn,
.download-btn {
  width: 100%;
  padding: 14px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.generate-card-btn {
  background: #4a90d9;
  color: #fff;
}

.generate-card-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(74, 144, 217, 0.4);
}

.generate-card-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.download-btn {
  background: #4caf50;
  color: #fff;
}

.download-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.4);
}

/* 页脚 */
.footer {
  text-align: center;
  padding: 20px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
}

/* 响应式 */
@media (max-width: 768px) {
  .hero-title {
    font-size: 32px;
  }

  .generate-buttons {
    grid-template-columns: 1fr;
  }

  .modal-content {
    margin: 10px;
  }
}
</style>
