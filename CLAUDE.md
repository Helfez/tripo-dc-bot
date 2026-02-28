# Project Overview — Tripo DC Bot (TypeScript)

## 项目定位

双用途项目：**Discord Bot** + **Web 测试平台**，共享数据库和 AI Pipeline 逻辑。

- Discord Bot：面向用户的 AI 图像/3D 模型生成机器人，附带抽奖、赠品等社区运营功能
- 测试平台：面向内部 QA 的 Web 界面，用于批量测试 AI 生成工作流的质量，支持 AI 自动评分和人工 Review

## 技术栈

- **语言**: TypeScript
- **Discord**: discord.js v14
- **Web**: Express.js
- **ORM**: Prisma (本地 SQLite，生产可切 PostgreSQL)
- **AI API**: AIHubMix (aihubmix.com) — 调用 Gemini、Doubao、Qwen 等模型
- **3D API**: Tripo 3D (tripo3d.ai)
- **其他**: ioredis (限流)、node-cron (定时任务)、axios、multer

## 目录结构

```
src/
├── index.ts                    # Bot 入口，加载 .env，启动 MyBot
├── client/
│   └── MyBot.ts                # Discord 客户端，处理 slash commands、按钮、事件
├── slash/                      # Discord 斜杠命令 (12 个文件)
│   ├── createText.ts           # /create — 文字生成 3D
│   ├── createImage.ts          # /create-via-image — 图片生成 3D
│   ├── jujubotCreate.ts        # /jujubot-create — JuJuMon 专用创建
│   ├── jujumon.ts              # /jujumon
│   ├── jujuTournament.ts       # /jujutournament — 锦标赛工作流
│   ├── admin.ts                # 管理员命令
│   ├── me.ts                   # 用户资料
│   ├── giveaway.ts             # /giveaway — 创建赠品活动
│   └── giveaway-delete.ts      # /giveaway-delete
├── handler/                    # 按钮/交互处理器 (12 个文件)
│   ├── refineHandler.ts        # "Refine" 按钮 — 提升模型质量
│   ├── pickHandler.ts          # "Pick" 按钮 — 选择变体
│   ├── exportHandler.ts        # "Export" 按钮 — 导出模型格式
│   ├── stylizeHandler.ts       # "Stylize" 按钮 — 风格化
│   ├── skeletonHandler.ts      # 骨架到 3D
│   ├── luckyDrawHandler.ts     # 抽奖
│   ├── myWorksHandler.ts       # 查看作品
│   ├── myPrizesHandler.ts      # 查看奖品
│   ├── giveawayEnterHandler.ts # 参与赠品
│   └── copyCodeHandler.ts      # 复制优惠码
├── services/                   # 核心业务逻辑 (17 个文件)
│   ├── aiHub.ts                # AIHubMix API 封装 (Gemini/Doubao/Vision LLM)
│   ├── aiRouter.ts             # 图片分类 (creature/human/card)
│   ├── createPipeline.ts       # 6 种创建工作流 (TRPG/Chibi/手办等)
│   ├── jujumonPipeline.ts      # JuJuMon 智能分类 + 生成管线
│   ├── tournamentPipeline.ts   # 6 种锦标赛模板
│   ├── workflowConfig.ts       # 工作流风格配置
│   ├── tournamentConfig.ts     # 锦标赛模板配置
│   ├── urls.ts                 # 环境变量管理 (ENVS 对象)
│   ├── config.ts               # 通用配置
│   ├── task.ts                 # 3D 生成任务封装
│   ├── account.ts              # 账号管理
│   ├── twitterClient.ts        # Twitter API
│   ├── twitterScheduler.ts     # 定时推文
│   ├── giveawayScheduler.ts    # 赠品活动定时器
│   └── lottery/                # 抽奖系统 (9 个文件)
│       ├── drawService.ts      # 抽奖概率逻辑
│       ├── prizeService.ts     # 奖品分发
│       ├── poolService.ts      # 每日奖池
│       ├── userService.ts      # 用户抽奖统计
│       └── dailyCron.ts        # 每日重置
├── testplatform/               # Web 测试平台
│   ├── server.ts               # Express 服务 (端口 4000，含登录认证)
│   ├── db.ts                   # 测试平台数据库操作
│   ├── taskRunner.ts           # 任务执行引擎 (并发控制、批处理)
│   ├── pipelineAdapter.ts      # 工作流路由适配器
│   ├── aiScorer.ts             # AI 自动打分 (Qwen 模型评估图像质量)
│   ├── routes/
│   │   ├── cases.ts            # 测试用例 CRUD
│   │   ├── workflows.ts        # 列出可用工作流
│   │   ├── tasks.ts            # 任务创建/管理
│   │   └── results.ts          # 结果查询、人工 Review、AI 重评
│   └── public/
│       └── index.html          # 单页 Web UI
├── models/                     # TypeScript 类型定义
├── components/                 # Discord 组件 (按钮等)
├── redis/                      # Redis 客户端
├── libs/imgLib/                # 图片处理 (合并/网格)
└── utils/                      # 工具函数
    ├── logUtils.ts             # 日志 (tLog)
    ├── messages.ts             # 消息模板
    ├── imageUtils.ts           # 图片下载/处理
    ├── rateControl.ts          # 频率限制
    └── constants.ts            # 按钮格式、模型版本

prisma/
└── schema.prisma               # 数据库 Schema (11 个模型)

data/
├── jujumon.db                  # SQLite 数据库
└── testplatform/
    ├── uploads/                # 测试用例上传的图片
    └── results/                # 生成的结果图片
```

## 数据库模型 (Prisma)

### 核心模型
- **User** — Discord 用户，含抽奖次数、购买状态
- **Work** — 用户生成的作品 (mode: jujumon | jujutrainers)
- **Prize** — 抽中的奖品 (优惠码、使用状态)
- **DailyPrizePool** — 每日奖池 (按奖品等级分配)
- **Referral** — 推荐关系
- **Config** — KV 配置存储

### 测试平台模型
- **TestCase** — 测试用例 (name, prompt, imagePath, remark)
- **TestTask** — 测试任务 (workflowId, status, progress)
- **TestResult** — 测试结果 (status, resultImagePath, review, aiReview, aiReason)
  - `review`: 人工评审 (none/pass/pending/reject/skip)
  - `aiReview`: AI 评审 (none/scoring/pass/pending/reject/error)
  - `aiReason`: AI 给出的理由

## AI Pipeline 架构

### 三大管线
1. **jujumonPipeline** — 智能分类后生成：先用 aiRouter 分类输入图 (creature/human/card)，再路由到对应子管线
2. **createPipeline** — 6 种风格化生成：board_game(TRPG桌游)、chibi(Q版)、scale_1_7(1:7手办)、jujumon_creature、jujumon_trainer、creative(自由风格)
3. **tournamentPipeline** — 6 种高级模板：liquid_dragon(树脂龙)、harry_sculpt(暗黑雕像)、foods_cc(迷你食物)、animal_ashley(拟人动物)、funko_pop(Funko公仔)、animal_beads(串珠手链)

### 关键服务
- **aiHub.ts** — AI 模型调用封装：
  - `generateWithGemini()` — 图像生成/img2img/风格迁移
  - `generateTextWithVision()` — 视觉 LLM 文本分析 (评分、分类、提示词扩展)
  - `generateWithDoubao()` — Doubao seedream 图像生成
- **aiRouter.ts** — 图片分类 (用 vision LLM 判断 creature/human/card)
- **pipelineAdapter.ts** — 测试平台与管线的适配层，共 13 个工作流

## 测试平台

### 启动
```bash
yarn test-platform    # 或 npx ts-node src/testplatform/server.ts
```
运行在 `http://localhost:4000`，需要登录。

### API 路由
- `POST /api/login` — 登录
- `GET/POST /api/cases` — 测试用例管理
- `DELETE /api/cases/:id` — 删除用例
- `GET /api/workflows` — 列出 13 个可用工作流
- `GET/POST /api/tasks` — 任务列表/创建任务
- `GET /api/tasks/:id` — 任务详情 (含所有结果)
- `GET /api/results/:taskId` — 任务结果列表
- `PATCH /api/results/:resultId/review` — 人工评审
- `POST /api/results/:resultId/ai-rescore` — 手动触发 AI 重评

### 任务执行 (taskRunner.ts)
- 最大并发任务数: 2 (`MAX_CONCURRENT_TASKS`)
- 每批处理用例数: 5 (`BATCH_SIZE`)
- FIFO 队列等待机制
- 每个用例成功后异步触发 AI 打分 (fire-and-forget)

### AI 打分 (aiScorer.ts)
- 模型: `qwen3.5-35b-a3b` (通过 aihubmix.com)
- Temperature: 0.3
- 评判维度: 图像质量、风格符合度、缺陷/伪影、构图合理性、原图保留度
- 输出: `{ verdict: "pass|pending|reject", reason: "理由" }`
- 失败不影响任务完成

## 环境变量 (.env)

```env
# Discord
DISCORD_BOT_TOKEN=
IS_TEST=                        # 设置后进入测试模式

# Tripo 3D API
TRIPO_URL=https://www.tripo3d.ai
TRIPO_API_URL=https://api.tripo3d.ai
TRIPO_API_KEY=
TRIPO_SHARE_URL=https://www.tripo3d.ai/preview?share=

# AIHubMix (图像生成 + Vision LLM)
AIHUBMIX_API_KEY=

# Redis (可选，用于限流)
REDIS_ADDR=

# Twitter
TWITTER_BEARER_TOKEN=
TWITTER_APP_KEY=
TWITTER_APP_SECRET=
TWITTER_ACCESS_TOKEN=
TWITTER_ACCESS_SECRET=

# 抽奖系统
DATABASE_URL=file:./data/jujumon.db
CHANNEL_LUCKY_DRAW=             # 抽奖公告频道 ID
CHANNEL_USER_CENTER=            # 用户中心频道 ID
WIN_PROBABILITY=0.01            # 中奖概率 1%
MAX_DAILY_DRAWS=50
DAILY_PRIZE_COUNT=34
WEB_DOMAIN=https://yourdomain.com
ADMIN_IDS=                      # 管理员 Discord ID，逗号分隔

# 测试平台认证
TP_USERNAME=
TP_PASSWORD=
```

## 部署

### Docker
```bash
docker build -t tripo-bot .
docker run --env-file .env tripo-bot
```
`entrypoint.sh` 会同时启动 Bot 和测试平台。

### AWS EC2
详见 `DEPLOY_AWS.md`。

## 常用命令

```bash
yarn start              # 启动 Discord Bot
yarn test-platform      # 启动测试平台 (端口 4000)
npx tsc --noEmit        # TypeScript 类型检查
npx prisma db push      # 同步数据库 Schema
npx prisma studio       # 可视化数据库管理
```

## 注意事项

- `ENVS` 对象在 `src/services/urls.ts` 中定义和初始化 (`envInit()`)，Bot 启动时调用
- 测试平台独立启动时会自动连接数据库，不依赖 Bot
- AI API Key 统一用 `ENVS.aiHubApiKey`，来源于 `AIHUBMIX_API_KEY` 环境变量
- 日志统一用 `tLog` (`src/utils/logUtils.ts`)，支持 `log/logError/logSuccess`
- 图片处理: 文件路径 ↔ base64 data URL 转换在 `pipelineAdapter.ts` 的 `imagePathToDataUrl()`
