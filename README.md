# AI Character Card Generator | AI人物卡生成器

<p align="center">
  <img src="https://img.shields.io/badge/Vue-3.5+-green.svg" alt="Vue 3.5+">
  <img src="https://img.shields.io/badge/TypeScript-5.6+-blue.svg" alt="TypeScript 5.6+">
  <img src="https://img.shields.io/badge/Vite-6.0+-purple.svg" alt="Vite 6.0+">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="MIT License">
</p>

<p align="center">
  <b>English</b> | <a href="#中文介绍">中文</a>
</p>

---

## Introduction

AI Character Card Generator is a web application that creates detailed character cards based on psychological assessments. Through a series of carefully designed questions, the system analyzes your personality traits and generates a unique character card compatible with AI roleplay platforms like SillyTavern.

### Key Features

- **AI-Powered Question Generation**: Uses AI to dynamically generate personalized psychological assessment questions
- **Multi-Dimensional Analysis**: Analyzes personality across multiple dimensions including Big Five, Jungian Cognitive Functions, Enneagram, DISC, and Moral Alignment
- **Character Card Export**: Generates standard-compliant character cards in JSON format
- **Visual Card Generation**: Creates beautiful character card images with embedded metadata
- **Multiple AI Support**: Compatible with OpenAI, Ollama, and other AI providers

### Assessment Dimensions

- **Big Five Personality Traits**: Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism
- **Jungian Cognitive Functions**: Ne, Ni, Se, Si, Te, Ti, Fe, Fi
- **Enneagram Types**: Type 1-9 with wing variations
- **DISC Behavioral Style**: Dominance, Influence, Steadiness, Conscientiousness
- **Moral Alignment**: Lawful-Chaotic, Good-Evil spectrum

### Question Types

1. **Multiple Choice (30 questions)**: Scenario-based questions with 4 options each
2. **Short Answer (5 questions)**: Open-ended narrative questions for deep reflection
3. **Dialogue (5 questions)**: Interactive scenarios testing reaction patterns

---

## 中文介绍

AI人物卡生成器是一个基于心理测评创建详细角色卡片的Web应用。通过一系列精心设计的问题，系统分析您的人格特质，并生成与AI角色扮演平台（如SillyTavern）兼容的独特角色卡。

### 核心功能

- **AI驱动的题目生成**：使用AI动态生成个性化的心理测评题目
- **多维度分析**：从多个维度分析人格，包括大五人格、荣格认知功能、九型人格、DISC和道德阵营
- **角色卡导出**：生成符合标准的JSON格式角色卡
- **可视化卡片生成**：创建带有嵌入元数据的精美角色卡图片
- **多AI支持**：兼容OpenAI、Ollama等多种AI提供商

### 测评维度

- **大五人格特质**：开放性、尽责性、外向性、宜人性、神经质
- **荣格认知功能**：Ne、Ni、Se、Si、Te、Ti、Fe、Fi
- **九型人格**：1-9号及其侧翼变体
- **DISC行为风格**：支配型、影响型、稳健型、谨慎型
- **道德阵营**：守序-混乱、善良-邪恶维度

### 题目类型

1. **选择题（30道）**：基于情境的选择题，每题4个选项
2. **问答题（5道）**：开放式叙述题，用于深度反思
3. **对话题（5道）**：互动情境，测试反应模式

---

## Tech Stack | 技术栈

- **Frontend**: Vue 3.5+ with Composition API
- **Language**: TypeScript 5.6+
- **Build Tool**: Vite 6.0+
- **State Management**: Pinia
- **Testing**: Vitest
- **Linting**: ESLint + Oxlint

---

## Project Setup | 项目设置

```sh
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test:unit

# Run linter
npm run lint
```

---

## Usage | 使用方法

1. Configure your AI provider in the settings (OpenAI API key or Ollama endpoint)
2. Click "Generate Questions" to create personalized assessment questions
3. Answer all 40 questions (30 multiple choice + 5 short answer + 5 dialogue)
4. Click "Generate Character Card" to analyze your responses
5. Upload a character image and download your character card

---

## License | 许可证

MIT License

---

<p align="center">
  Made with love for AI roleplay enthusiasts
</p>
