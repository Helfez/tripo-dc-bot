# /jujutournament 命令架构指南

本文档描述 `/jujutournament` 命令的完整架构，供后续开发或 AI 阅读理解。

---

## 一、概述

`/jujutournament` 是一个 Discord Slash Command，用户选择一个**风格模板**，提供**文字描述**和/或**参考图片**，系统通过多步 AI 生成流程输出一张风格化图片。

## 二、涉及文件

| 文件 | 职责 |
|------|------|
| `src/slash/jujuTournament.ts` | 命令定义与执行逻辑（主流程） |
| `src/services/tournamentConfig.ts` | 模板配置（模型、提示词、流程参数） |
| `src/services/aiHub.ts` | AI 调用封装（AIHubMix API） |

## 三、用户输入

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `template` | string (choice) | 是 | 选择风格模板，值来自 `TOURNAMENT_CHOICES` |
| `prompt` | string | 否 | 文字描述 |
| `image` | attachment | 否 | 参考图片 |

**约束**：`prompt` 和 `image` 至少提供一个。

## 四、执行流程

```
用户输入 (prompt / image / 两者)
        │
        ▼
┌─ 前置校验 ─────────────────────┐
│ 1. 至少有 prompt 或 image       │
│ 2. 内容审核 (checkViolationByRegexp) │
│ 3. 频率限制 (Redis, 可选)       │
│ 4. AIHUBMIX_API_KEY 是否配置    │
└────────────────────────────────┘
        │
        ▼
┌─ Step 1: 语义分析 / 提示词扩展 ──────────────────────────┐
│ 函数: generateTextWithVision()                           │
│ 输入: systemPrompt + 用户prompt + 用户image              │
│ 模型: config.visionModel (文本/视觉 LLM)                │
│ 输出: generatedPrompt (扩展后的详细生成提示词)            │
│                                                          │
│ 作用: 将用户的简短输入扩展为符合模板风格的详细 prompt     │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌─ Step 2: 图片生成 ──────────────────────────────────────┐
│ 函数: generateWithGemini()                               │
│ 输入:                                                    │
│   prompt = (config.imagePromptPrefix || '') + generatedPrompt │
│   image  = 用户原始图片 (如有)                           │
│ 模型: config.imageModel                                  │
│ 输出: 生成的图片 URL 或 base64                           │
│                                                          │
│ imagePromptPrefix 是可选前缀，会拼接在 generatedPrompt 前 │
│ 大多数模板不需要，值为 undefined                          │
└──────────────────────────────────────────────────────────┘
        │
        ▼ (仅当 config.refinement 存在时)
┌─ Step 3: 精修生成 (可选) ───────────────────────────────┐
│ 函数: generateWithGemini()                               │
│ 输入:                                                    │
│   prompt = generatedPrompt (不含 prefix)                 │
│   image  = Step 2 生成的图片                             │
│ 模型: config.refinement.model                            │
│ 输出: 最终精修图片                                       │
│                                                          │
│ 作用: 以 Step 2 的图作为参考，用更强模型精修出最终商品图  │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌─ 结果返回 ─────────────────────┐
│ 将最终图片作为 Discord Embed    │
│ 附带 Checkout 按钮组件          │
└────────────────────────────────┘
```

## 五、模板配置结构 (TournamentEntry)

```typescript
interface TournamentEntry {
  systemPrompt: string;        // Step 1 的系统提示词，定义风格和生成规则
  visionModel: string;         // Step 1 使用的 LLM 模型
  imageModel: string;          // Step 2 使用的图片生成模型
  imagePromptPrefix?: string;  // Step 2 prompt 前缀 (可选)
  refinement?: {               // Step 3 精修配置 (可选)
    model: string;             // Step 3 使用的图片生成模型
  };
}
```

### 字段说明

- **systemPrompt**: 核心配置。定义了该模板的风格特征、输入处理逻辑、输出格式。Step 1 中作为 system message 发给 visionModel，指导它将用户输入扩展为详细的生成提示词。
- **visionModel**: 负责"理解"输入并生成提示词的模型。支持文本和图片输入。
- **imageModel**: 负责实际生图的模型。接收 generatedPrompt 和可选的参考图片。
- **imagePromptPrefix**: 拼接在 generatedPrompt 之前，用于在图片生成步骤中添加额外指令（如"先提取动物头像再生成"）。不影响 Step 3 的 prompt。
- **refinement**: 如果配置了此字段，Step 2 的输出图片会作为输入再进行一次生成，产出更高质量的最终图。

## 六、现有模板一览

| 模板名 | 值 | 流程 | 说明 |
|--------|------|------|------|
| Liquid Dragon | `liquid_dragon` | 2 步 | 半透明树脂龙摆件 |
| Head Sculpt Harry | `harry_sculpt` | 2 步 | 暗黑风格头雕半身像 |
| Foods CC | `foods_cc` | 2 步 | 微缩写实食物模型 |
| Animal Ashley | `animal_ashley` | 2 步 | 动物拟人潮玩手办 |
| Funko Pop | `funko_pop` | 2 步 | Funko Pop 风格公仔 |
| Animal Beads | `animal_beads` | 3 步 | 动物头部手工手串 |

### 2 步模板流程
```
用户输入 → [Step 1 提示词扩展] → [Step 2 图片生成] → 最终图片
```

### 3 步模板流程 (Animal Beads)
```
用户输入 → [Step 1 提示词扩展] → [Step 2 初步生成 + prefix] → [Step 3 精修] → 最终图片
```

## 七、AI 调用函数

### generateTextWithVision (Step 1)

```typescript
generateTextWithVision(apiKey, systemPrompt, userPrompt, imageUrl?, model?)
```
- 调用 AIHubMix 的 chat/completions 接口
- 发送 system message (systemPrompt) + user message (文字 + 图片)
- 返回纯文本（扩展后的 prompt）

### generateWithGemini (Step 2 / Step 3)

```typescript
generateWithGemini(apiKey, prompt, primaryImageUrl?, styleImageUrl?, model?)
```
- 调用 AIHubMix 的 chat/completions 接口，启用 `modalities: ["text", "image"]`
- 发送 prompt 文本 + 可选的参考图片
- 返回图片 URL 或 base64 data URL

## 八、如何添加新模板

### 1. 编辑 `src/services/tournamentConfig.ts`

**a. 添加类型**
```typescript
export type TournamentTemplate = '...' | 'your_new_template';
```

**b. 添加配置**
```typescript
'your_new_template': {
  visionModel: 'gemini-3-flash-preview',    // 推荐: flash 快, pro 质量高
  imageModel: 'gemini-2.5-flash-image',      // 推荐: 2.5-flash 快速生图
  // imagePromptPrefix: '可选前缀',          // 仅当需要在生图 prompt 前加指令时
  // refinement: { model: 'gemini-3-pro-image-preview' },  // 仅当需要精修时
  systemPrompt: `你的系统提示词...`,
},
```

**c. 添加选项**
```typescript
export const TOURNAMENT_CHOICES = [
  // ...existing
  { name: 'Your Template Name', value: 'your_new_template' },
] as const;
```

### 2. systemPrompt 编写规范

systemPrompt 需要覆盖以下 3 种输入场景：
1. **文字 + 图片都有**: 结合两者生成 prompt
2. **只有文字**: 仅基于文字描述生成 prompt
3. **只有图片**: 分析图片内容生成 prompt

输出必须是最终可直接用于图片生成的 prompt，不要输出其他解释性文字。

### 3. 从 Dify DSL 转换为模板

如果来源是 Dify 工作流 DSL：
1. 找到"提示词生成"节点的 `user_prompt` 或 `system_prompt`，这就是 `systemPrompt`
2. 找到各图片生成节点使用的 `model`，映射为 `imageModel`（第一个生图步骤）和 `refinement.model`（精修步骤，如有）
3. 如果生图步骤的 prompt 有额外前缀（非来自提示词生成节点），提取为 `imagePromptPrefix`
4. DSL 中的 Dify 变量引用（如 `{{#nodeId.field#}}`）不需要保留，systemPrompt 中用自然语言描述输入场景即可

### 4. 不需要修改的文件

- `src/slash/jujuTournament.ts` — 执行逻辑是通用的，通过配置驱动，无需改动
- `src/services/aiHub.ts` — AI 调用封装，无需改动
