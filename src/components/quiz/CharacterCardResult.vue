<script setup lang="ts">
import { ref } from 'vue';
import type { CharacterCard } from '@/types/question';

const props = defineProps<{
  character: CharacterCard;
}>();

const avatarUrl = ref('');
const isUploading = ref(false);

// 处理头像上传
function handleAvatarUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (file) {
    isUploading.value = true;
    const reader = new FileReader();
    reader.onload = (e) => {
      avatarUrl.value = e.target?.result as string;
      isUploading.value = false;
    };
    reader.readAsDataURL(file);
  }
}

// 下载JSON数据
function downloadJSON() {
  const data = {
    ...props.character,
    generatedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `character-card-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 下载Markdown文档
function downloadMarkdown() {
  const md = generateMarkdown();
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `character-profile-${Date.now()}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 生成Markdown文档
function generateMarkdown(): string {
  const c = props.character;
  return `# 人物卡分析报告

生成时间：${new Date().toLocaleString('zh-CN')}

---

## 📊 性格量化数据

### 大五人格 (Big Five)
| 维度 | 得分 | 解读 |
|------|------|------|
| 开放性 (Openness) | ${c.bigFive.openness}% | ${getBigFiveInterpretation('openness', c.bigFive.openness)} |
| 尽责性 (Conscientiousness) | ${c.bigFive.conscientiousness}% | ${getBigFiveInterpretation('conscientiousness', c.bigFive.conscientiousness)} |
| 外向性 (Extraversion) | ${c.bigFive.extraversion}% | ${getBigFiveInterpretation('extraversion', c.bigFive.extraversion)} |
| 宜人性 (Agreeableness) | ${c.bigFive.agreeableness}% | ${getBigFiveInterpretation('agreeableness', c.bigFive.agreeableness)} |
| 神经质 (Neuroticism) | ${c.bigFive.neuroticism}% | ${getBigFiveInterpretation('neuroticism', c.bigFive.neuroticism)} |

### 荣格八维 (Cognitive Functions)
| 功能 | 得分 | 功能 | 得分 |
|------|------|------|------|
| Ne (外向直觉) | ${c.cognitiveFunctions.Ne}% | Ni (内向直觉) | ${c.cognitiveFunctions.Ni}% |
| Se (外向感觉) | ${c.cognitiveFunctions.Se}% | Si (内向感觉) | ${c.cognitiveFunctions.Si}% |
| Te (外向思考) | ${c.cognitiveFunctions.Te}% | Ti (内向思考) | ${c.cognitiveFunctions.Ti}% |
| Fe (外向情感) | ${c.cognitiveFunctions.Fe}% | Fi (内向情感) | ${c.cognitiveFunctions.Fi}% |

**主导功能**: ${getDominantFunction(c.cognitiveFunctions)}

### MBTI 类型
**${c.mbti}** - ${getMBTIDescription(c.mbti)}

### 九型人格
- **主型**: ${c.enneagram.type}号 - ${getEnneagramTypeName(c.enneagram.type)}
- **侧翼**: ${c.enneagram.wing}号
- **本能副型**: ${c.enneagram.instinctualVariant}

### DISC 行为风格
| 维度 | 得分 | 主导类型: **${c.disc.primary}** |
|------|------|--------------------------------|
| D (支配) | ${c.disc.D}% | 直接、果断、结果导向 |
| I (影响) | ${c.disc.I}% | 热情、社交、乐观 |
| S (稳定) | ${c.disc.S}% | 耐心、支持、忠诚 |
| C (谨慎) | ${c.disc.C}% | 精确、分析、系统化 |

### 道德阵营
**${c.moralAlignment.label}**

- 守序-混乱轴: ${c.moralAlignment.lawChaos > 0 ? '+' : ''}${c.moralAlignment.lawChaos}
- 善良-邪恶轴: ${c.moralAlignment.goodEvil > 0 ? '+' : ''}${c.moralAlignment.goodEvil}

---

## 🎭 性格描述

${c.description}

---

## 🌟 角色建议

### 角色原型
**${c.characterSuggestions.archetype}**

### 核心优势
${c.characterSuggestions.strengths.map(s => `- ${s}`).join('\n')}

### 潜在劣势
${c.characterSuggestions.weaknesses.map(w => `- ${w}`).join('\n')}

### 成长方向
${c.characterSuggestions.growthDirection}

---

*本报告由AI根据答题结果生成，仅供参考。*
`;
}

// 辅助函数
function getBigFiveInterpretation(dimension: string, score: number): string {
  const interpretations: Record<string, [string, string]> = {
    openness: ['传统务实', '好奇创新'],
    conscientiousness: ['随性灵活', '自律有条理'],
    extraversion: ['内向安静', '外向活跃'],
    agreeableness: ['理性直接', '友善合作'],
    neuroticism: ['情绪稳定', '敏感多虑'],
  };
  const pair = interpretations[dimension];
  if (!pair) return '';
  const [low, high] = pair;
  return score > 50 ? high : low;
}

function getDominantFunction(functions: Record<string, number>): string {
  const entries = Object.entries(functions);
  entries.sort((a, b) => b[1] - a[1]);
  const first = entries[0];
  if (!first) return '';
  const [name, score] = first;
  const descriptions: Record<string, string> = {
    Ne: '外向直觉 - 探索可能性',
    Ni: '内向直觉 - 洞察本质',
    Se: '外向感觉 - 活在当下',
    Si: '内向感觉 - 经验记忆',
    Te: '外向思考 - 效率组织',
    Ti: '内向思考 - ',
    Fe: '外向情感 - 和谐关系',
    Fi: '内向情感 - 内在价值',
  };
  return `${name} (${score}%) - ${descriptions[name] || ''}`;
}

function getMBTIDescription(type: string): string {
  const descriptions: Record<string, string> = {
    INTJ: '建筑师 - 战略思考者',
    INTP: '逻辑学家 - 创新思想家',
    ENTJ: '指挥官 - 天生领导者',
    ENTP: '辩论家 - 机智创新者',
    INFJ: '提倡者 - 理想主义者',
    INFP: '调停者 - 诗意利他者',
    ENFJ: '主人公 - 魅力教育者',
    ENFP: '竞选者 - 热情自由者',
    ISTJ: '物流师 - 可靠务实者',
    ISFJ: '守卫者 - 专注温暖者',
    ESTJ: '总经理 - 高效管理者',
    ESFJ: '执政官 - 热心合作者',
    ISTP: '鉴赏家 - 冷静实验者',
    ISFP: '探险家 - 灵活艺术家',
    ESTP: '企业家 - 活力实干者',
    ESFP: '表演者 - 自发表演者',
  };
  return descriptions[type] || '独特个性';
}

function getEnneagramTypeName(type: number): string {
  const names: Record<number, string> = {
    1: '完美主义者',
    2: '助人者',
    3: '成就者',
    4: '浪漫主义者',
    5: '观察者',
    6: '忠诚者',
    7: '热情者',
    8: '挑战者',
    9: '和平者',
  };
  return names[type] || '';
}
</script>

<template>
  <div class="character-result">
    <h2 class="title">🎭 你的专属人物卡</h2>

    <!-- 头像上传 -->
    <div class="avatar-section">
      <div class="avatar-container">
        <img v-if="avatarUrl" :src="avatarUrl" class="avatar-img" alt="角色头像" />
        <div v-else class="avatar-placeholder">
          <span class="avatar-icon">🎭</span>
          <span class="avatar-text">上传头像</span>
        </div>
        <input
          type="file"
          accept="image/*"
          class="avatar-input"
          @change="handleAvatarUpload"
        />
        <div v-if="isUploading" class="avatar-loading">上传中...</div>
      </div>
    </div>

    <!-- 核心信息卡片 -->
    <div class="core-info">
      <div class="info-card mbti">
        <span class="info-label">MBTI</span>
        <span class="info-value">{{ character.mbti }}</span>
      </div>
      <div class="info-card enneagram">
        <span class="info-label">九型人格</span>
        <span class="info-value">{{ character.enneagram.type }}w{{ character.enneagram.wing }}</span>
      </div>
      <div class="info-card disc">
        <span class="info-label">DISC</span>
        <span class="info-value">{{ character.disc.primary }}</span>
      </div>
      <div class="info-card alignment">
        <span class="info-label">道德阵营</span>
        <span class="info-value">{{ character.moralAlignment.label }}</span>
      </div>
    </div>

    <!-- 详细数据 -->
    <div class="details-section">
      <!-- 大五人格 -->
      <div class="detail-card">
        <h3 class="detail-title">📊 大五人格</h3>
        <div class="trait-bars">
          <div v-for="(value, key) in character.bigFive" :key="key" class="trait-bar">
            <span class="trait-name">{{ key }}</span>
            <div class="trait-progress">
              <div class="trait-fill" :style="{ width: `${value}%` }"></div>
            </div>
            <span class="trait-value">{{ value }}%</span>
          </div>
        </div>
      </div>

      <!-- 荣格八维 -->
      <div class="detail-card">
        <h3 class="detail-title">🧠 荣格八维</h3>
        <div class="cognitive-grid">
          <div
            v-for="(value, key) in character.cognitiveFunctions"
            :key="key"
            class="cognitive-item"
          >
            <span class="cognitive-name">{{ key }}</span>
            <div class="cognitive-bar">
              <div class="cognitive-fill" :style="{ width: `${value}%` }"></div>
            </div>
            <span class="cognitive-value">{{ value }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 性格描述 -->
    <div class="description-card">
      <h3 class="detail-title">📝 性格描述</h3>
      <p class="description-text">{{ character.description }}</p>
    </div>

    <!-- 角色建议 -->
    <div class="suggestions-card">
      <h3 class="detail-title">🌟 角色建议</h3>
      <div class="suggestion-section">
        <h4 class="suggestion-title">角色原型</h4>
        <p class="suggestion-content">{{ character.characterSuggestions.archetype }}</p>
      </div>
      <div class="suggestion-section">
        <h4 class="suggestion-title">核心优势</h4>
        <ul class="suggestion-list">
          <li v-for="(strength, i) in character.characterSuggestions.strengths" :key="i">
            {{ strength }}
          </li>
        </ul>
      </div>
      <div class="suggestion-section">
        <h4 class="suggestion-title">潜在劣势</h4>
        <ul class="suggestion-list">
          <li v-for="(weakness, i) in character.characterSuggestions.weaknesses" :key="i">
            {{ weakness }}
          </li>
        </ul>
      </div>
      <div class="suggestion-section">
        <h4 class="suggestion-title">成长方向</h4>
        <p class="suggestion-content">{{ character.characterSuggestions.growthDirection }}</p>
      </div>
    </div>

    <!-- 下载按钮 -->
    <div class="download-section">
      <h3 class="detail-title">💾 保存结果</h3>
      <div class="download-buttons">
        <button class="download-btn json" @click="downloadJSON">
          <span class="btn-icon">📊</span>
          <span class="btn-text">下载量化数据 (JSON)</span>
        </button>
        <button class="download-btn markdown" @click="downloadMarkdown">
          <span class="btn-icon">📄</span>
          <span class="btn-text">下载分析报告 (Markdown)</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.character-result {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px;
}

.title {
  text-align: center;
  font-size: 28px;
  font-weight: 700;
  color: #333;
  margin-bottom: 32px;
}

.avatar-section {
  display: flex;
  justify-content: center;
  margin-bottom: 32px;
}

.avatar-container {
  position: relative;
  width: 150px;
  height: 150px;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
  border: 4px solid #e0e0e0;
  transition: border-color 0.2s;
}

.avatar-container:hover {
  border-color: #4a90d9;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.avatar-icon {
  font-size: 48px;
  margin-bottom: 8px;
}

.avatar-text {
  font-size: 14px;
}

.avatar-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.avatar-loading {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 14px;
}

.core-info {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

.info-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 2px solid transparent;
  transition: transform 0.2s, box-shadow 0.2s;
}

.info-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.info-card.mbti {
  border-color: #4a90d9;
  background: linear-gradient(135deg, #e3f2fd 0%, #fff 100%);
}

.info-card.enneagram {
  border-color: #9c27b0;
  background: linear-gradient(135deg, #f3e5f5 0%, #fff 100%);
}

.info-card.disc {
  border-color: #ff9800;
  background: linear-gradient(135deg, #fff3e0 0%, #fff 100%);
}

.info-card.alignment {
  border-color: #4caf50;
  background: linear-gradient(135deg, #e8f5e9 0%, #fff 100%);
}

.info-label {
  display: block;
  font-size: 12px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.info-value {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: #333;
}

.details-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 24px;
}

.detail-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.detail-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin: 0 0 20px 0;
  padding-bottom: 12px;
  border-bottom: 2px solid #f0f0f0;
}

.trait-bars {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.trait-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.trait-name {
  width: 100px;
  font-size: 13px;
  color: #555;
  text-transform: capitalize;
}

.trait-progress {
  flex: 1;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.trait-fill {
  height: 100%;
  background: linear-gradient(90deg, #4a90d9, #667eea);
  border-radius: 4px;
  transition: width 0.5s ease;
}

.trait-value {
  width: 45px;
  font-size: 13px;
  color: #666;
  text-align: right;
}

.cognitive-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.cognitive-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cognitive-name {
  font-size: 14px;
  font-weight: 600;
  color: #444;
}

.cognitive-bar {
  height: 6px;
  background: #e0e0e0;
  border-radius: 3px;
  overflow: hidden;
}

.cognitive-fill {
  height: 100%;
  background: linear-gradient(90deg, #9c27b0, #e91e63);
  border-radius: 3px;
  transition: width 0.5s ease;
}

.cognitive-value {
  font-size: 12px;
  color: #888;
}

.description-card,
.suggestions-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  margin-bottom: 24px;
}

.description-text {
  font-size: 15px;
  line-height: 1.8;
  color: #555;
  margin: 0;
}

.suggestion-section {
  margin-bottom: 20px;
}

.suggestion-section:last-child {
  margin-bottom: 0;
}

.suggestion-title {
  font-size: 15px;
  font-weight: 600;
  color: #444;
  margin: 0 0 10px 0;
}

.suggestion-content {
  font-size: 14px;
  line-height: 1.7;
  color: #666;
  margin: 0;
}

.suggestion-list {
  margin: 0;
  padding-left: 20px;
}

.suggestion-list li {
  font-size: 14px;
  line-height: 1.7;
  color: #666;
  margin-bottom: 6px;
}

.download-section {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.download-buttons {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.download-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 24px;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.download-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.download-btn.json {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.download-btn.markdown {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: #fff;
}

.btn-icon {
  font-size: 20px;
}

@media (max-width: 768px) {
  .core-info {
    grid-template-columns: repeat(2, 1fr);
  }

  .details-section {
    grid-template-columns: 1fr;
  }

  .cognitive-grid {
    grid-template-columns: 1fr;
  }

  .download-buttons {
    flex-direction: column;
  }

  .download-btn {
    width: 100%;
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .core-info {
    grid-template-columns: 1fr;
  }
}
</style>
