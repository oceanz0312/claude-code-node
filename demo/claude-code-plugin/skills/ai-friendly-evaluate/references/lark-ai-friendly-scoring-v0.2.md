# Source URL

https://bytedance.larkoffice.com/wiki/NEAswxL2pilnZfk8s78cP3qQnVc

---

# AI 友好度评价体系规范 v0.2

> **版本**: 0.2
> **发布日期**: 2026-03-09
> **适用范围**: 前端 / 全栈 Web 项目

---

## 一、体系概述

### 1.1 设计目标

建立一套**模型无关**的项目 AI 友好度评价标准，使得：

- 不同 AI 模型对同一项目的评估结果具有**可比性**
- 评估过程具有**可复现性**（基于明确检查项，而非主观感受）
- 评估结果具有**可操作性**（每个检查项附带 Good / Bad Case，指导改进方向）

本体系采用**双轨评估**设计：

| 评估方式                   | 内容                                                  | 适用场景                         |
| -------------------------- | ----------------------------------------------------- | -------------------------------- |
| <strong>静态评估</strong>  | 基于项目静态特征的检查项评分                          | 常规评估、横向对比、持续追踪     |
| <strong>Benchmark</strong> | 用真实业务场景的标准化任务集实际驱动 AI，度量产出质量 | 校准静态分数、深度诊断、改进验证 |

静态评估回答"项目是否具备 AI Friendly 的特征"，Benchmark 回答"AI 在项目中的实际表现如何"。两者互补：静态评估用于日常追踪和横向对比，Benchmark 用于校准静态分数的有效性并发现静态检查项未覆盖的盲区。

### 1.2 核心理念

本体系围绕 AI 编码助手与项目交互的六个核心问题展开：

| <strong></strong> | 核心问题                              | 对应维度                    |
| ----------------- | ------------------------------------- | --------------------------- |
| 1                 | AI 能否快速获取项目上下文？           | D1 文档体系                 |
| 2                 | 项目是否为 AI 提供了明确的行为指引？  | D2 AI 行为指引与上下文管控  |
| 3                 | AI 能否高效定位并安全修改代码？       | D3 结构、D4 类型、D5 可读性 |
| 4                 | AI 能否验证自己的输出？               | D6 测试与可验证性           |
| 5                 | AI 的上下文窗口是否干净有效？         | D7 构建体验、D8 信噪比      |
| 6                 | AI 能否在跨包依赖图中安全高效地工作？ | D9 Workspace 依赖可导航性   |

---

## 二、评价维度定义

### 总览

| 维度                       | 权重                 | 核心问题                              | 类型                  |
| -------------------------- | -------------------- | ------------------------------------- | --------------------- |
| D1 文档体系                | <strong>20%</strong> | AI 能否快速获取项目上下文？           | 基础                  |
| D2 AI 行为指引与上下文管控 | <strong>15%</strong> | 项目是否为 AI 提供了明确的行为指引？  | 基础                  |
| D3 代码可发现性与结构      | <strong>15%</strong> | AI 能否高效定位目标代码？             | 基础                  |
| D4 类型安全与约束一致性    | <strong>15%</strong> | AI 能否依靠类型系统安全地修改代码？   | 基础                  |
| D5 代码可读性与注释        | <strong>10%</strong> | AI 能否准确理解代码意图？             | 基础                  |
| D6 测试与可验证性          | <strong>15%</strong> | AI 能否验证自己的输出是否正确？       | 基础                  |
| D7 构建与开发体验          | <strong>5%</strong>  | AI 能否顺畅执行构建、lint、测试命令？ | 基础                  |
| D8 代码信噪比              | <strong>5%</strong>  | AI 的上下文窗口是否被无关内容污染？   | 基础                  |
| D9 Workspace 依赖可导航性  | <strong>10%</strong> | AI 能否在跨包依赖图中安全高效地工作？ | <strong>条件</strong> |

> **权重设计原则**：D1（文档）、D4（类型）、D6（测试）为 AI 辅助开发的三大核心支柱，合计占 50%。D2（行为指引）是区分"AI 可用"与"AI 友好"的关键差异项，评估内容的质量而非特定工具的使用。D7/D8 对代码生成质量的直接影响相对间接，权重较低。
> **条件维度**：D9 仅在满足激活条件时参与评分（见 D9 章节）。激活时 D1-D8 权重等比缩放至 90%，D9 占 10%；未激活时 D1-D8 保持原权重，总分仍为百分制，确保跨项目可比性。

---

### D1 文档体系（20%）

**核心问题**：AI 能否在较少的检索轮次内获取足够的项目上下文来完成任务？

#### 检查项与案例

---

**1.1 项目 README**

| 评分 | 标准                                                                                          |
| ---- | --------------------------------------------------------------------------------------------- |
| 0 分 | 无 README 或 README 为模版初始 README                                                         |
| 1 分 | 仓库/项目有整体的 README，包含开发环境搭建说明                                                |
| 2 分 | 各个子项目/模块都有 README，README 信息包含含模块结构、入口文件、关键命令、项目架构等有效内容 |

Bad Case:

```markdown
# my-project

A web project.
```

Good Case:

```markdown
# @company/portal-platform

TikTok Web Arch 应用托管平台前端。

## 架构概览

src/
├── api/ # API 层（BAM 生成 + 手动封装）
├── common/ # 公共 hooks、constants、store
├── components/ # 公共组件
├── modules/ # 业务模块（ProjectDetail, Workbench, SpaceDetail...）
├── layout/ # 布局与路由
└── utils/ # 工具函数

## 关键入口

- 路由定义: `src/layout/routes/index.tsx`
- 全局 Store: `src/common/store/`
- API 封装: `src/api/portal-server.ts`

## 快速开始

​`bash
rushx setup     # 一键安装依赖 + 构建前置项目
rushx dev       # 启动开发服务器
rushx idl       # 从 BAM 拉取最新 API 类型
​`
```

---

**1.2 架构文档**

<table style="width: 100%; border-collapse: collapse;">
<tr>
<th style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">评分</th>
<th style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">标准</th>
</tr>
<tr>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">0 分</td>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">无</td>
</tr>
<tr>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">1 分</td>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">项目 README 中包含基本的架构说明</td>
</tr>
<tr>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">2 分</td>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">有系统性架构文档（含模块图、数据流、技术栈）并形成了知识库<br />有定期的知识库更新维护机制，能随着项目的增量迭代和变更而沉淀更新</td>
</tr>
</table>

Bad Case:

```markdown
# 架构

我们用 React + Node.js
```

Good Case:

```markdown
# 系统架构

## 模块总览

                ┌──────────────┐
                │   platform   │ ← 前端 SPA (TTAstra + Arco Design)
                └──────┬───────┘
                       │ API (BAM SDK)
                ┌──────┴───────┐
                │    server    │ ← 后端 (Gulux + MongoDB)
                └──────────────┘

## 数据流

1. 用户操作 → React 组件 → useRequest / React Query
2. API 调用 → BAM SDK (自动鉴权) → server 层
3. server → MongoDB / Redis → 返回序列化数据

## 技术栈约束

- 前端框架: TTAstra (CSR)
- UI 组件: Arco Design
- 状态管理: Jotai (全局) + hox (模块级)
- 构建工具: rspack
```

---

**1.3 \*\***业务领域\***\*概念文档**

| 评分 | 标准                                                                                          |
| ---- | --------------------------------------------------------------------------------------------- |
| 0 分 | 无                                                                                            |
| 1 分 | 主要业务模块的入口函数有基本的关于业务实体的注释                                              |
| 2 分 | 所有业务概念都有注释/文档做合理解释，并且有自动化机制对新功能开发引入的新增业务概念做迭代补充 |

Bad Case — 业务术语仅出现在代码变量名中，无任何解释：

```typescript
const flow = await getFlow(flowId);
const stages = flow.nonStages.filter((s) => s.type === 'hook');
```

Good Case — 独立文档定义核心概念：

```markdown
# 关键概念

## 项目 (Project)

一个可独立部署的前端应用，包含代码仓库、部署配置、资源绑定等。

## 部署流程 (Flow)

由多个 Stage 组成的自动化部署管道。分为：

- **Stage**: 有序执行的部署阶段（如 Build → Deploy → Verify）
- **NonStage**: 辅助触发器（如 CronTrigger, HookTrigger）

## 工单 (InfraTicket)

基础设施资源申请的工作流实例，包含审批、执行、回滚等生命周期。
```

---

**1.4 开发流程文档**

| 评分 | 标准                                                                                                                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 0 分 | 无                                                                                                                                    |
| 1 分 | README 中简要提及开发流程，AI 经过能够完成基本配置                                                                                    |
| 2 分 | 有标准化开发流程文档（含全栈各环节步骤），并且所有开发命令都面向 AI 做了适配。AI 能够参考文档和提供的命令完成大型功能的本地开发的工作 |

Bad Case:

```markdown
开发时跑 `npm run dev`，改完提 PR。
```

Good Case:

```markdown
# 全栈功能开发流程

## 1. 定义 IDL

修改 `server/idl/*.thrift`，定义接口和数据结构。

## 2. 生成类型

​`bash
cd server && rushx idl       # 后端类型生成
cd platform && rushx idl     # 前端 SDK 更新
​`

## 3. 实现后端服务

在 `server/service/` 新增 handler，在 `server/controller/` 注册路由。

## 4. 实现前端调用

在 `platform/src/modules/{Module}/api/` 封装 API，在组件中调用。

## 5. 验证

​`bash
rushx lint && rushx test && rushx build
​`
```

---

**1.5 文档可发现性**

<table style="width: 100%; border-collapse: collapse;">
<tr>
<th style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">评分</th>
<th style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">标准</th>
</tr>
<tr>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">0 分</td>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">文档散落各处</td>
</tr>
<tr>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">1 分</td>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">有统一目录但无导航</td>
</tr>
<tr>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">2 分</td>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">有索引文件 + 场景化导航<br />或者提供了专用的文档检索工具（RAG/Agent 等）</td>
</tr>
</table>

Bad Case — 文档散落在 wiki、README、代码注释中，无统一入口。

Good Case:

```markdown
# 文档索引

## 按角色导航

### 我是新成员

1. [开发宪章](./CONSTITUTION) — 必读
2. [快速开始](./QUICK_START) — 搭建环境
3. [架构文档](./ARCHITECTURE) — 理解系统

### 我要新增功能

1. [开发流程](./DEVELOPMENT) — 标准步骤
2. [模块说明](./MODULES) — 定位模块
3. [依赖关系](./DEPENDENCIES) — 检查依赖
```

---

**1.6 模块级文档**

| 评分 | 标准                    |
| ---- | ----------------------- |
| 0 分 | 无                      |
| 1 分 | &lt; 20% 模块有 README  |
| 2 分 | = 50% 核心模块有 README |

Bad Case — `src/modules/` 下 12 个模块无一有 README。

Good Case — 核心模块有自描述文档：

```markdown
# Health 模块

## 职责

项目健康度监控，包含异常检测、告警管理、性能分析。

## 目录结构

├── components/ # UI 组件
├── hooks/ # 数据 hooks
├── api/ # API 封装
├── store/ # 模块状态
└── constants.ts # 枚举与常量

## 入口

- 路由入口: `index.tsx`
- 主 Store: `store/useHealthStore.ts`
```

---

**1.7 文档时效性**

| 评分 | 标准                                   |
| ---- | -------------------------------------- |
| 0 分 | 没有文档，或者上次更新时间 &gt; 6 个月 |
| 1 分 | 最后更新时间 6 个月以内                |
| 2 分 | 最后更新 &lt; 1 月，并且有自动更新机制 |

Bad Case — 文档底部标注"最后更新: 2024-03-15"，实际架构已大幅变动。

Good Case — 文档底部标注"最后更新: 2026-02-10"，与代码变更同步维护，并有维护责任人。

**计算方式**: D1 得分 = (各项得分之和 / 14) × 100

---

### D2 AI 行为指引与上下文管控（15%）

**核心问题**：项目是否为 AI 编码助手提供了显式的行为指引和上下文过滤？

> **工具中立性说明**：本维度评估的是项目是否以结构化方式为 AI 提供了行为指引，**不限定具体工具**。评分标准关注**内容的质量和覆盖度**，而非特定配置文件格式。当前主流 AI 编码工具的配置方式对照：

<table style="width: 100%; border-collapse: collapse;">
<tr>
<th style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">能力</th>
<th style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">Cursor</th>
<th style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">Claude Code</th>
<th style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">OpenAI Codex</th>
<th style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">通用</th>
</tr>
<tr>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">行为指引</td>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;"><code>.cursor/rules/*.mdc</code></td>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;"><code>CLAUDE.md</code></td>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;"><code>.codex/config.toml</code><br /><code>./codex/rules/</code></td>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;"><code>AGENTS.md</code></td>
</tr>
<tr>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">上下文过滤</td>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;"><code>.cursorignore</code></td>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;"><code>.claudeignore</code></td>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;"><code>./codex/rules/</code></td>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;"><code>.gitignore</code></td>
</tr>
<tr>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">知识库</td>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;"><code>.cursor/skills/</code><br /><code>.agents/skills</code></td>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;"><code>.claude/skills</code></td>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;"><code>.agents/skills</code></td>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;"><code>docs/knowledge/</code></td>
</tr>
</table>

> 评估时，只要项目通过**任一方式**满足了检查项的意图，即可计分。
> **Monorepo 生效配置原则**：在 monorepo 中，D2 评估的是对该子项目**实际生效的完整配置**，而非子项目目录中是否本地存在配置文件。生效配置 = **根级继承配置** + **子项目增量配置**：

| 配置层级                    | 来源                                              | 示例                                                                                  | 评估时是否计入                                             |
| --------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| <strong>根级继承</strong>   | monorepo 根目录的全局规则，通过 glob 覆盖到子项目 | <code>.cursor/rules/common.mdc</code>（glob: \*_/_）中的 Rush 规范、通用编码约定      | <strong>是</strong> — 只要 glob 能匹配到该子项目的文件路径 |
| <strong>子项目增量</strong> | 子项目自身的项目特异性规则                        | <code>libs/fe-shared/.cursor/rules/fe-shared.mdc</code> 中的 "此包禁止依赖 React DOM" | <strong>是</strong> — 这是对根级规则的补充                 |

> 如果根级配置已经提供了高质量的架构文档、统一的编码约定和开发流程指引，子项目不需要重复这些内容。子项目的 D2 增量配置仅需覆盖**项目特异性**的指引（如修改边界、特殊约束、领域知识）。一个没有任何本地 D2 配置但被高质量根级配置充分覆盖的子项目，D2 分数可以很高。
> **跨包可发现性**：在 monorepo 中，AI 经常从项目 A（如 `desktop-client`）跟随代码引用**跨入**项目 B（如 `fe-shared`）进行修改。此时需确保项目 B 的规则对 AI 可见：
>
> - Cursor：规则的 `glob` 必须使用**workspace 根的绝对路径**（如 `glob: libs/webapp-fe-shared/src/**`），而非相对于子项目的路径（如 `glob: src/**`，这会匹配到错误的目录）
> - Claude Code：`CLAUDE.md` 的层级嵌套机制在 AI **编辑**该目录下的文件时才会生效，仅"读取"不一定触发
> - 通用做法：在根级规则中统一声明跨包约束，子项目仅补充增量

#### 检查项与案例

---

**2.1 AI 行为指引文件**

| 评分 | 标准                                                                 |
| ---- | -------------------------------------------------------------------- |
| 0 分 | 无任何面向 AI 的行为指引                                             |
| 1 分 | 有但仅包含通用指令（如 "Write clean code"）                          |
| 2 分 | 有项目特定的规范（代码风格、架构约定、禁止事项），内容具有项目特异性 |

Bad Case:

```markdown
# 行为指引（无论位于 .cursorrules / CLAUDE.md / AGENTS.md）

You are a helpful coding assistant. Write clean code.
```

Good Case:

```markdown
# 项目行为指引

# 可配置于: .cursor/rules/\*.mdc, CLAUDE.md, AGENTS.md,

# .github/copilot-instructions.md 等

## 代码组织

- 前端组件: `platform/src/modules/` 或 `common/src/`
- 后端服务: `server/service/`
- 公共工具: `common-lib/src/`

## IDL 开发流程

1. 修改 IDL: `server/idl/*.thrift`
2. 后端生成: `cd server && rushx idl`
3. 前端拉取: `cd platform && rushx idl`

## 禁止事项

- 禁止直接修改 `src/api/bam/` 下的生成代码
- 禁止使用 `any` 类型
- 禁止绕过 Rush 使用 npm/yarn 安装依赖
```

---

**2.2 指引层级与组织**

| 评分 | 标准                                                      |
| ---- | --------------------------------------------------------- |
| 0 分 | 无                                                        |
| 1 分 | 仅一层扁平配置，所有规则混在一起                          |
| 2 分 | 多层级组织（全局 → 框架 → 项目 → 模块），知识按关注点分离 |

Bad Case — 所有规则混在单一文件中（300+ 行），全局规范和模块细节不分层。

Good Case — 分层配置，逐级细化。具体形式因工具而异：

```plaintext
# 形式一：Cursor 分层 Rules
.cursor/rules/
├── common.mdc          # 全局：Rush 规范、组合优先、简洁性
├── ttastra.mdc         # 框架级：CSR 框架开发规范
├── arco-design.mdc     # 组件库级：Arco Design 使用约定
└── portal.mdc          # 项目级：Portal 全栈开发流程

# 形式二：通用 Markdown 分层文档（适用于任何 AI 工具）
docs/
├── CONSTITUTION.md     # 全局不可协商原则
├── ARCHITECTURE.md     # 架构与技术栈
├── CONVENTIONS.md      # 编码约定
└── modules/
    └── ProjectDetail/
        └── README.md   # 模块级说明

```

---

**2.3 AI 导航文档**

| 评分 | 标准                                 |
| ---- | ------------------------------------ |
| 0 分 | 无                                   |
| 1 分 | 有但内容泛化                         |
| 2 分 | 有项目特定的入口、禁区、任务路径说明 |

Bad Case:

```markdown
# AGENTS.md

This is a web project. Please help with coding tasks.
```

Good Case — 提供结构化的项目导航（可位于 `AGENTS.md`、`CLAUDE.md`、`.cursor/rules/` 或其他位置）：

```markdown
# AI 导航文档

## 项目入口

- 路由总表: `src/layout/routes/index.tsx`
- API 服务封装: `src/api/portal-server.ts`
- 全局状态: `src/common/store/`

## 禁止修改区域

- `src/api/bam/**` — 自动生成代码，执行 `rushx idl` 更新
- `node_modules/`, `dist/`, `output/`

## 常见任务路径

| 任务             | 修改位置                                                 |
| ---------------- | -------------------------------------------------------- |
| 新增项目设置 Tab | `src/modules/ProjectDetail/tabs/settings/`               |
| 新增 API 调用    | `src/modules/{Module}/api/` + `src/api/portal-server.ts` |
| 新增公共组件     | `src/components/{ComponentName}/`                        |

## 修改后验证命令

rushx lint && rushx build
```

---

**2.4 AI 上下文过滤**

| 评分 | 标准                                                       |
| ---- | ---------------------------------------------------------- |
| 0 分 | 无任何 AI 上下文过滤配置                                   |
| 1 分 | 仅依赖 .gitignore                                          |
| 2 分 | 有专门的 AI 上下文过滤配置，排除生成代码 / 日志 / 构建产物 |

Bad Case — 无专门配置，AI 索引到 `log/`（1500+ 文件）和 `dist/` 中的压缩代码。

Good Case — 通过工具对应的忽略机制过滤噪声：

```plaintext
# .cursorignore / .copilotignore / .claudeignore 等
dist/
output*/
log/
rush-logs/
node_modules/
src/api/bam/
*.min.js
*.map
starling/

```

---

**2.5 可按需加载的领域知识**

| 评分 | 标准                                               |
| ---- | -------------------------------------------------- |
| 0 分 | 无                                                 |
| 1 分 | 有通用知识文档但无结构化组织                       |
| 2 分 | 有项目特定的知识文档，按领域组织，支持 AI 按需检索 |

Bad Case — 无任何结构化的领域知识文档。

Good Case — 提供结构化的领域知识，供 AI 按需加载：

```plaintext
# 形式一：Cursor Skills
.cursor/skills/
├── platform-knowledge/SKILL.md   # 平台业务概念和模块关系
├── ui-library-guide/SKILL.md     # UI 组件库使用指南
└── backend-framework/SKILL.md    # 后端框架使用指南

# 形式二：通用 Markdown 知识库（任何 AI 工具均可使用）
docs/knowledge/
├── domain-concepts.md            # 业务领域概念
├── ui-component-guide.md         # UI 组件使用指南
└── api-patterns.md               # API 封装模式

# 形式三：MCP 资源（高级，工具需支持 MCP 协议）
通过 MCP Server 提供项目文档的结构化检索能力

```

---

**2.\*\***6 \***\*多工具配置一致性**

| 评分 | 标准                                                        |
| ---- | ----------------------------------------------------------- |
| 0 分 | 仅适配一种工具，且规则硬编码在工具特定文件中                |
| 1 分 | 核心规则在共享文档中，至少适配了一种 AI 工具                |
| 2 分 | 共享知识层 + 多工具薄适配层 + 有一致性保障机制（脚本 / CI） |

Bad Case — 所有规则仅在 `.cursorrules` 中，团队成员若使用其他 AI 工具则无法获得任何指引。

Good Case — 采用"共享知识层 + 薄适配层"架构：

```plaintext
docs/                              ← Single Source of Truth（人写、人维护）
├── CONSTITUTION.md
├── ARCHITECTURE.md
├── CONVENTIONS.md
└── DEVELOPMENT.md

.cursor/rules/bridge.mdc           ← Cursor 薄适配层（引用 docs/ + Cursor 特有指令）
CLAUDE.md                           ← Claude Code 薄适配层
AGENTS.md                           ← 通用 AI Agent 适配层
.github/copilot-instructions.md     ← GitHub Copilot 薄适配层

```

各适配层为薄封装，核心内容指向共享文档。可通过 CI 脚本检测配置间的语义漂移。

**计算方式**: D2 得分 = (各项得分之和 / 12) × 100

> **Monorepo 评估提示**：评分时，应先盘点对该子项目**实际生效的全部配置**（根级 + 增量），然后基于生效配置的总体质量打分。切勿因子项目本地没有配置文件就给 0 分——如果根级配置已充分覆盖，该子项目的 D2 分数应反映根级配置的质量。同时注意检查 glob 路径是否正确匹配到该子项目（见上方"跨包可发现性"说明）。

---

### D3 代码可发现性与结构（15%）

**核心问题**：AI 能否在一次搜索 / 导航中找到需要修改的代码位置？

#### 检查项与案例

---

**3.1 目录分层**

| 评分 | 标准                                                                                 |
| ---- | ------------------------------------------------------------------------------------ |
| 0 分 | 结构扁平，没有明确分类                                                               |
| 1 分 | 有基本分层架构设计，但存在超大文件的情况（&gt;=1000 行，超大 Component，超大函数等） |
| 2 分 | 清晰的职责分层（api / components / modules / utils 等），文件大小合理                |

Bad Case:

```plaintext
src/
├── App.tsx
├── api.ts            # 所有 API 混在一个文件
├── helpers.ts        # 所有工具函数混在一起
├── ProjectList.tsx
├── ProjectDetail.tsx
├── UserCard.tsx
└── constants.ts

```

Good Case:

```plaintext
src/
├── api/              # API 层
│   ├── interceptors/ # 请求拦截器
│   └── portal-server.ts
├── common/           # 公共代码
│   ├── constants/
│   ├── hooks/
│   └── store/
├── components/       # 公共组件
├── modules/          # 业务模块
│   ├── ProjectDetail/
│   ├── Workbench/
│   └── SpaceDetail/
├── layout/           # 布局与路由
├── types/            # 全局类型
└── utils/            # 工具函数

```

---

**3.2 模块自治性**

| 评分 | 标准                                                                                                                 |
| ---- | -------------------------------------------------------------------------------------------------------------------- |
| 0 分 | 模块间高度耦合，一个功能的业务逻辑散落在仓库各处，需要查找 10+ 个文件才能理解一端业务逻辑                            |
| 1 分 | 部分模块相对较为独立，复杂功能存在一定的耦合情况，一个业务逻辑的实现能够控制在 10 个文件内                           |
| 2 分 | 各模块有独立的 components / hooks / api / types，功能实现较为内聚，一个完整的业务逻辑能够在 5 个文件检索以内完成理解 |

Bad Case — 模块直接引用其他模块的内部文件：

```typescript
// ProjectList 直接引用 ProjectDetail 的内部组件
import { DeployCard } from '../ProjectDetail/tabs/overview/components/DeployCard';
```

Good Case — 模块自治，共享部分抽取到公共层：

```plaintext
modules/ProjectDetail/
├── components/       # 模块私有组件
├── hooks/            # 模块私有 hooks
├── api/              # 模块私有 API
├── types.ts          # 模块类型
└── index.tsx         # 模块入口（唯一导出）

```

跨模块共享组件提升到 `src/components/`。

---

**3.3 命名\*\***清晰\*\*

AI 依靠名称理解代码意图。名称越精确，AI 的推理越准确，越不需要额外上下文。

| 评分 | 标准                                                                                       |
| ---- | ------------------------------------------------------------------------------------------ |
| 0 分 | 命名混乱，同一个实体和功能在不同地方叫不同的名字。命名不遵循语义化规范，或者命名和实现不符 |
| 1 分 | 大部分命名逻辑清晰，比较语义化。少量历史遗留问题导致命名不清，但是通过文档补充解释到位     |
| 2 分 | 目录 / 文件 / 函数 / 变量命名统一，语义化程度高，能很容易用同一个关键词检索出所有相关代码  |

Bad Case — 同级目录混用多种命名风格，且语义混乱：

```plaintext
src/modules/
├── ProjectDetail/       # PascalCase
└── space-list/          # kebab-case

// 语义模糊
ConfigManager.processOptions

```

Good Case — 统一约定：

```plaintext
src/modules/             # 模块：PascalCase
├── ProjectDetail/
└── SpaceList/

src/utils/               # 工具：camelCase
├── formatDate.ts
├── parseQuery.ts
└── index.ts

// 语义清晰，函数名和函数行为一致
ConfigManager.setDefaultOptions
```

---

~~**3.4 **~~~~**Barrel 文件**~~~~** / 入口聚合**~~

**3.\*\***5\***\* 路径别名**

| 评分 | 标准                                                           |
| ---- | -------------------------------------------------------------- |
| 0 分 | 存在路径别名，但没有文档化。                                   |
| 1 分 | 不存在路径别名，或者有路径别名的 README/AGENTS.md 的全局声明。 |
| 2 分 | 有路径别名，但是配置完善，可以使用 LSP 直接追踪引用和声明      |

Bad Case — 存在路径别名，但没有文档化：

```typescript
// @ 是在哪里？只能读 webpack config。LSP 无法正常运行，导致无法 Command + B 跳到实现。
import { formatDate } from '@/utils/formatDate';
```

Good Case — 路径别名 + 文档化 + LSP：

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@api/*": ["./src/api/*"],
      "@utils/*": ["./src/utils/*"]
    }
  }
}
// lsp.json, reference https://code.claude.com/docs/en/discover-plugins#code-intelligence:~:text=Code-,intelligence,-Code%20intelligence%20plugins
{
    "typescript": {
        "command": "typescript-language-server",
        "args": [
            "--stdio"
        ],
        "transport": "stdio",
        "initializationOptions": {},
        "settings": {},
        "maxRestarts": 3
    }
}
```

```typescript
import { formatDate } from '@utils/formatDate';
```

---

**3.\*\***6\***\* 代码单元复杂度**

> **评估两个维度**：文件体积（行数）和函数圈复杂度（Cyclomatic Complexity, CC）。
>
> - **文件体积**：超长文件迫使 AI 消耗大量上下文窗口，降低推理精度。
> - **函数 CC**：CC 衡量函数内独立执行路径数量，CC 越高 AI 越难完整推理所有分支。CC 是**函数级**指标，工具可能报告文件级聚合值，但评估应关注函数级别。
>   **度量方法**：
> - 文件行数：抽样核心模块统计
> - 圈复杂度：检查 ESLint `complexity` 规则是否启用。若已启用，以 lint 报告中的违规数为准；若未启用，可用 `eslint --rule '{"complexity": ["warn", 20]}'` 临时扫描
>   **CC 豁免：扁平分发模式**
>   CC 度量的是路径数量而非理解难度。以下模式虽可能触发较高 CC，但**不应视为复杂度问题**——强行拆分反而会增加 AI 的上下文跳转成本，降低信息局部性：

| 豁免条件（须同时满足） | 说明                                                                  |
| ---------------------- | --------------------------------------------------------------------- |
| 单层非嵌套             | <code>switch/case</code> 或 <code>if-else</code> 链，各分支之间无嵌套 |
| 分支互相独立           | 各分支无共享可变状态、无 fall-through 依赖                            |
| 单个分支 ≤ 10 行       | 若某个分支内部逻辑超过 10 行，该分支应单独提取                        |

> **判断口诀**：CC 超标时，先看嵌套深度——如果函数缩进从未超过 2 层（函数体 + 一层 switch/if），大概率属于扁平分发，可豁免。真正需要治理的是**嵌套型复杂度**（多层条件组合、隐式状态依赖）。

| 评分 | 标准                                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------ |
| 0 分 | 普遍 &gt; 500 行，或存在 CC &gt; 30 的函数且无 ESLint <code>complexity</code> 规则                           |
| 1 分 | 多数文件 &lt; 500 行，无 CC &gt; 30 的函数；或已启用 <code>complexity</code> 规则但阈值过高（&gt; 25）       |
| 2 分 | 多数文件 &lt; 300 行且复杂逻辑有拆分；ESLint <code>complexity</code> 规则已启用（阈值 ≤ 20）且核心模块无违规 |

Bad Case — 单文件 800 行，且包含 CC=45 的超复杂函数：

```typescript
// ProjectDetail.tsx (800 lines)
export const ProjectDetail = () => {
  // 100 行 state 和 hooks
  // 200 行 API 调用和数据处理（单个函数内 15 层条件嵌套，CC=45）
  // 500 行 JSX 渲染
};
```

Good Case — 关注点分离 + 低 CC：

```typescript
// hooks/useProjectDetail.ts (~80 lines, 每个函数 CC < 10) — 数据逻辑
// components/ProjectHeader.tsx (~60 lines) — 头部 UI
// components/ProjectTabs.tsx (~50 lines) — Tab 容器
// index.tsx (~40 lines) — 组合入口

// .eslintrc.js
// rules: { complexity: ['error', { max: 15 }] }
```

**计算方式**: D3 得分 = (各项得分之和 / 10) × 100

---

### D4 类型安全与约束一致性（15%）

**核心问题**：AI 能否依赖类型系统推断正确的修改方式，而非靠猜测？

#### 检查项与案例

---

**4.1 TypeScript \*\***LSP 配置\*\*

| 评分 | 标准                                                            |
| ---- | --------------------------------------------------------------- |
| 0 分 | 未启用或 JS 项目，或者存在大量 TS 错误（&gt;10）                |
| 1 分 | TypeScript LSP 已正确配置，但是存在少量存量 TS 错误（&lt;10）   |
| 2 分 | <code>strict: true</code> 完全启用，TypeScript LSP 没有任何错误 |

---

**4.2 any 使用频率**

| 评分 | 标准                                 |
| ---- | ------------------------------------ |
| 0 分 | 广泛使用 any（&gt;50）               |
| 1 分 | 偶尔使用，集中在特定区域（&lt;= 50） |
| 2 分 | 禁止 any 或仅在生成代码中出现        |

Bad Case:

```typescript
function processData(data: any): any {
  return data.items.map((item: any) => item.value);
}
```

Good Case:

```typescript
interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

function processData(data: ApiResponse<ProjectItem[]>): string[] {
  return data.data.map((item) => item.value);
}
```

---

**4.3 API 类型覆盖**

| 评分 | 标准                                           |
| ---- | ---------------------------------------------- |
| 0 分 | API 返回 any / unknown，或者大部分接口没有类型 |
| 1 分 | 部分接口有类型（&gt;50%）                      |
| 2 分 | 所有 API 有完整的请求 / 响应类型定义           |

Bad Case:

```typescript
export async function getProject(id: string) {
  const res = await axios.get(`/api/project/${id}`);
  return res.data; // 返回 any
}
```

Good Case:

```typescript
import { portalService } from '@api/portal-server';

// BAM 生成的类型自动覆盖请求和响应
const project = await portalService.project.GetProjectDetail({
  params: { project_id: id },
}); // 返回类型: GetProjectDetailResponse
```

---

**4.4 组件 Props 类型**

| 评分 | 标准                                     |
| ---- | ---------------------------------------- |
| 0 分 | Props 无类型或使用 any                   |
| 1 分 | 多数有类型但部分宽松                     |
| 2 分 | 所有组件 Props 有明确的 interface / type |

Bad Case:

```typescript
const UserCard = (props) => {
  return <div>{props.name}</div>;
};
```

Good Case:

```typescript
interface UserCardProps {
  userId: string;
  name: string;
  avatar?: string;
  onClick?: (userId: string) => void;
}

const UserCard: React.FC<UserCardProps> = ({ userId, name, avatar, onClick }) => {
  return <div onClick={() => onClick?.(userId)}>{name}</div>;
};
```

---

**4.5 Lint 规则强度**

| 评分 | 标准                                  |
| ---- | ------------------------------------- |
| 0 分 | 无 lint 或规则宽松，存量错误很多      |
| 1 分 | 有 lint 但忽略项多，存量错误较少      |
| 2 分 | 严格 lint + CI 强制执行，没有存量错误 |

Bad Case:

```javascript
// .eslintrc — 大量规则被关闭
rules: {
  '@typescript-eslint/no-explicit-any': 'off',
  '@typescript-eslint/no-unused-vars': 'off',
  'no-console': 'off',
}

```

Good Case:

```javascript
// .eslintrc.cjs
rules: {
  'no-console': ['warn', { allow: ['warn', 'error'] }],
  'unused-imports/no-unused-imports': 'error',
  'unused-imports/no-unused-vars': 'warn',
}
// + CI 中 `eslint . --quiet` 必须通过

```

---

**4.6 技术栈约束文档**

| 评分 | 标准                                                                |
| ---- | ------------------------------------------------------------------- |
| 0 分 | 无，或者有声明但是不符合实际情况（声明了 Semi 但是混用 Ant Design） |
| 1 分 | 在 README.md/AGENTS.md 中有基本声明                                 |
| 2 分 | 有详尽的书面技术栈约束，以及决策逻辑（如 CONSTITUTION.md）          |

Bad Case — 团队口头约定"用 Arco Design"，但代码中混用 Ant Design、Material UI。

Good Case:

```markdown
# CONSTITUTION.md — 不可协商原则

## 技术栈约束

- UI 组件库: **Arco Design** — 禁止引入其他 UI 库
- 状态管理: **Jotai** — 新功能禁止使用 Redux/MobX
- CSS 方案: **Tailwind CSS + emotion** — 禁止 CSS Modules
- 国际化: **Starling** — 所有用户可见文案必须走 i18n
```

---

**4.7 环境变量类型**

| 评分 | 标准                         |
| ---- | ---------------------------- |
| 0 分 | 无类型声明                   |
| 1 分 | 部分声明，存在一定的缺失     |
| 2 分 | 完整详细的 env.d.ts 类型声明 |

Bad Case:

```typescript
// 直接使用 process.env，无类型提示
const apiUrl = process.env.API_URL; // string | undefined，无提示
```

Good Case:

```typescript
// src/env.d.ts
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production';
    API_URL: string;
    DEBUG_LOCAL?: string;
    ENABLE_WEBPACK_PROXY?: string;
    DISABLE_SYSTEM_PROXY?: string;
  }
}
```

**计算方式**: D4 得分 = (各项得分之和 / 14) × 100

---

### D5 代码可读性与注释（10%）

**核心问题**：AI 能否从代码本身（不依赖外部文档）理解函数 / 组件的意图？

#### 检查项与案例

---

**5.1 函数可理解性**

> **核心原则**：函数应通过自身结构实现自文档化（低圈复杂度 + 强类型 + 语义化命名）。JSDoc 仅作为结构表达力不足时的**补偿手段**，而非硬性要求。
> **评估范围**：所有通过 `export` 导出的公共函数和自定义 Hooks（排除 React 组件函数——其 Props 接口已承担文档职责；排除自动生成代码）。
> **\"自文档化\"判定条件**（同时满足）：
>
> 1. 函数圈复杂度 CC ≤ 15
> 1. 参数与返回值有明确的 TypeScript 类型（非 `any`）
> 1. 函数名 + 参数名具备语义化命名（能从命名推断意图）
>    **度量方法**：随机抽样项目中 3-5 个核心模块目录，评估公共函数的可理解性：自文档化函数无需 JSDoc 即视为达标；未满足自文档化条件的函数需检查是否有补偿性 JSDoc。

| 评分 | 标准                                                                                            |
| ---- | ----------------------------------------------------------------------------------------------- |
| 0 分 | 大量公共函数既不满足自文档化条件（高 CC / 弱类型 / 命名模糊），也无 JSDoc 补偿                  |
| 1 分 | 部分函数不满足自文档化条件且缺乏 JSDoc；或存在 JSDoc 但多为复述代码的\"复读机\"式内容           |
| 2 分 | 公共函数普遍满足自文档化条件；少数未满足的有针对性 JSDoc 补偿（说明业务意图、副作用或使用方式） |

Bad Case — 高复杂度 + 弱类型 + 无文档，AI 无法理解函数意图：

```typescript
export function fn(a: string, b: number, c: boolean) {
  // 50 行复杂实现，CC=25...
}
```

Good Case — 路径 A（自文档化，无需 JSDoc）：

```typescript
export function isResourceBound(resourceType: ResourceType, formValues: FormValues): boolean {
  const bindingKey = RESOURCE_BINDING_KEYS[resourceType];
  return formValues[bindingKey] != null;
}
```

Good Case — 路径 B（无法自文档化时，JSDoc 补偿业务意图）：

```typescript
/**
 * 获取项目的 issue 列表，支持分页和状态过滤。
 * 内部会根据用户权限自动过滤不可见的 issue。
 *
 * @example
 * const { data, loading } = useGetIssueList({ projectId: '123', status: 'open' });
 */
export function useGetIssueList(options: UseGetIssueListOptions): UseRequestResult<IssueList> {
  // ...
}
```

> **改进建议优先级**：
>
> 1. **首选**（根治）：降低函数复杂度 + 加强类型约束 + 改善命名
> 1. **次选**（止血）：对短期无法重构的复杂函数补充 JSDoc
> 1. **不推荐**：对已经自文档化的函数批量补写 JSDoc（纯噪音，降低信噪比）

---

**5.2 复杂业务逻辑注释**

> **\"复杂逻辑\"定义**：满足以下**任一**条件的代码段即视为\"复杂\"，应有解释性注释：

| 复杂性指标      | 阈值                                                               | 示例                                                  |
| --------------- | ------------------------------------------------------------------ | ----------------------------------------------------- | --- | ---------------------------------------------- |
| 条件分支深度    | 单个 <code>if/switch</code> 包含 &gt;= 3 个条件（&amp;&amp; /      |                                                       | )   | <code>if (a &amp;&amp; b &amp;&amp; !c)</code> |
| 业务魔法值      | 使用了非自解释的字面量（数字、字符串）作为判断条件                 | <code>status === 3</code>、<code>type !== 'T2'</code> |
| 状态流转        | 涉及状态机、有序步骤、或多阶段流程                                 | 工单审批流、支付状态机                                |
| 算法 / 数据变换 | 非平凡的数据处理逻辑（排序策略、聚合规则、权限计算）               | 自定义排序比较函数                                    |
| 正则表达式      | 任何非平凡的正则（超出简单 <code>\d+</code>、<code>\s+</code> 的） | <code>/^(?:https?:\/\/)?[\w.-]+(?:\.[\w.-]+)+/</code> |
| 外部契约依赖    | 代码行为依赖于外部 API 的隐式约定、后端返回值的特定结构            | <code>data.list[0]?.extra?.config</code>              |

> **度量方法**：随机抽样 3-5 个包含业务逻辑的模块，统计 `已注释的复杂逻辑段数 / 符合上述条件的复杂逻辑总段数`。

| 评分 | 标准                                                                                                                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 0 分 | 抽样模块中 &gt; 70% 的复杂逻辑段无注释，且存在魔法值未语义化                                                                          |
| 1 分 | 魔法值已语义化使代码基本自解释，但缺少业务原因说明；或有注释但多为复述代码的\"复读机\"式注释                                          |
| 2 分 | 魔法值已语义化 + &gt; 70% 的复杂逻辑段有解释<strong>业务原因、设计决策或非显而易见副作用</strong>的注释（复述代码的注释不计入覆盖率） |

Bad Case — 魔法值 + 无注释，AI 完全无法理解条件的业务含义：

```typescript
if (ticket.status === 3 && ticket.type !== 2 && !ticket.rollback) {
  await submitTicket(ticket.id);
}
```

Mediocre Case — 语义化命名已使代码自解释，注释只是复述代码（\"复读机\"），无额外信息量：

```typescript
// 工单提交前置条件:
// - status === APPROVED: 已通过审批
// - type !== ROLLBACK: 非回滚工单
// - !rollback: 未曾触发过回滚
if (ticket.status === TicketStatus.APPROVED && ticket.type !== TicketType.ROLLBACK && !ticket.rollback) {
  await submitTicket(ticket.id);
}
```

Good Case — 语义化命名让\"做什么\"自解释，注释只解释代码无法表达的\"为什么\"：

```typescript
// 回滚工单走独立的 rollback pipeline（见 docs/rollback-flow），
// 且已触发过回滚的工单不允许再次提交以避免审批状态与实际部署状态不一致
if (ticket.status === TicketStatus.APPROVED && ticket.type !== TicketType.ROLLBACK && !ticket.rollback) {
  await submitTicket(ticket.id);
}
```

> **原则**：语义化命名（枚举、常量）是消除\"做什么\"歧义的首选手段。当命名已充分自解释时，注释应聚焦于**业务原因、设计决策、或非显而易见的副作用**，而非重复描述代码已表达的内容。\"复读机\"式注释不计入 5.2 的覆盖率。

---

**5.3 常量语义化**

| 评分 | 标准                               |
| ---- | ---------------------------------- |
| 0 分 | 魔法数字 / 字符串                  |
| 1 分 | 部分提取为常量                     |
| 2 分 | 所有业务常量有语义化命名并集中管理 |

Bad Case:

```typescript
if (status === 1 || status === 2 || status === 5) {
  fetchData(10, 30000);
}
```

Good Case:

```typescript
// common/constants/issue.ts
export const ACTIVE_ISSUE_STATUSES = [IssueStatus.Open, IssueStatus.InProgress, IssueStatus.Reviewing];
export const DEFAULT_PAGE_SIZE = 10;
export const POLLING_INTERVAL_MS = 30_000;

// 使用
if (ACTIVE_ISSUE_STATUSES.includes(status)) {
  fetchData(DEFAULT_PAGE_SIZE, POLLING_INTERVAL_MS);
}
```

---

**5.4 注释一致性**

| 评分 | 标准                                                                               |
| ---- | ---------------------------------------------------------------------------------- |
| 0 分 | 注释和代码不一致存在冲突，且注释是对函数行为的直接描述，不包含代码之外的 context。 |
| 1 分 | 注释略微落后于代码，并且注释能够解释代码实现的决策和思考                           |
| 2 分 | 注释和代码非常统一，注释能良好地解释设计的原则和关注点                             |

Bad Case — 直接描述函数行为，并且和代码实现有冲突：

```typescript
// 获取用户信息
const user = getUser();
// NOTE: 检查是否是 operator
if (user.isAdmin) {
}
```

Good Case — 描述函数设计背后的思考和 context：

```typescript
const user = getUser();
// 对于 Admin，为实现临时特殊需求 ABC-123， 需要跳转到 dashboard
if (user.isAdmin) {
  navigate('/admin/dashboard');
}
```

**计算方式**: D5 得分 = (各项得分之和 / 8) × 100

---

### D6 测试与可验证性（15% / 8%，按项目角色）

**核心问题**：AI 修改代码后，能否通过自动化手段验证正确性？

#### 项目角色适配

D6 的评分标准和权重根据**项目角色**差异化适配。评估开始前须先判定项目角色：

<table style="width: 100%; border-collapse: collapse;">
<tr>
<th style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">项目角色</th>
<th style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">判定条件</th>
<th style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">D6 权重</th>
<th style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">重点</th>
</tr>
<tr>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;"><strong>基建型</strong> (Infrastructure)</td>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">框架、共享库、构建工具、被 &gt;= 3 个项目依赖的包</td>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;"><strong>15%</strong></td>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">高覆盖率的自动化测试：单测 + 集成测试</td>
</tr>
<tr>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;"><strong>业务型</strong> (Business)</td>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">面向用户的应用、业务功能模块、由 QA 团队保障功能验证</td>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;"><strong>8%</strong></td>
<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">静态检查优先：lint + typecheck<br />测试环境配置为主：Agent 能够运行本地开发环境和部署测试环境，具备打通验证闭环的基本能力</td>
</tr>
</table>

> **设计意图**：基建型代码改动影响范围大（如 `@tiktok/launcher` 影响 12+ 个下游应用），必须依赖高覆盖率的自动化测试来约束 AI 产出；业务型代码追求迭代效率，功能验证由 QA 团队保障，AI 只需确保产出通过静态检查和维持可测性设置即可。
> **权重调整**：当 D6 从 15% 降至 8% 时，空出的 7% 需重新分配到其他维度以保持总和 100%。推荐分配：D3 +2%（17%）、D5 +2%（12%）、D7 +3%（8%），具体可按项目情况调整（见\"六、权重调整指南\"）。

下表列出各检查项在两种角色下的**评分标准差异**。未标注差异的检查项两种角色标准相同。

| 检查项       | 基建型标准                           | 业务型标准                                                                            |
| ------------ | ------------------------------------ | ------------------------------------------------------------------------------------- |
| 6.1 测试覆盖 | 覆盖率 &gt;= 30%，核心模块 &gt;= 60% | 有关键路径测试（如核心 hooks / utils），且为 AI 提供测试环境即可（browser-skills 等） |
| 6.2 测试框架 | 已配置且有实际执行的测试             | 已配置（passWithNoTests 可接受，前提是 lint + typecheck 严格）                        |
| 6.3 测试模式 | 有统一模式，AI 可参照                | 有至少 1 个示例可参照                                                                 |
| 6.5 E2E 测试 | 有且持续运行                         | 可选（QA 团队覆盖功能验证）                                                           |

#### 检查项与案例

---

**6.1 测试文件存在性**

| 评分 | 基建型标准                            | 业务型标准                                                                              |
| ---- | ------------------------------------- | --------------------------------------------------------------------------------------- |
| 0 分 | 无测试文件                            | 无测试文件，无测试环境配置                                                              |
| 1 分 | 有但覆盖率 &lt; 30%                   | 有测试环境配置，但关键路径覆盖率不高（核心 hooks / utils / 业务逻辑），应用有一定可测性 |
| 2 分 | 覆盖率 &gt;= 30% 且核心模块 &gt;= 60% | 关键路径有测试覆盖，应用分层实现合理可测性高                                            |

Bad Case（两种角色通用）— `src/` 下 1281 个源文件，0 个 `*.test.*` 文件。

Good Case — 基建型：

```plaintext
src/common/hooks/__tests__/
├── useDebounce.test.ts        # 覆盖边界条件
├── usePagination.test.ts      # 覆盖分页逻辑
└── useProjectPermission.test.ts

src/utils/__tests__/
├── formatDate.test.ts
├── parseQuery.test.ts
└── getErrorMessage.test.ts

```

Good Case — 业务型（关键路径覆盖即可）：

```plaintext
src/modules/ProjectDetail/hooks/__tests__/
└── useProjectDetail.test.ts   # 核心数据 hook 有测试

src/utils/__tests__/
└── formatDate.test.ts         # 高频工具函数有测试

# 提供 AI 启动本地测试验证变更的能力
.claude/skills/playwright-skill
```

---

**6.2 测试框架配置**

| 评分 | 基建型标准               | 业务型标准                                                     |
| ---- | ------------------------ | -------------------------------------------------------------- |
| 0 分 | 未配置                   | 未配置                                                         |
| 1 分 | 已配置但 passWithNoTests | 已配置但无 lint / typecheck 脚本                               |
| 2 分 | 已配置且有实际执行的测试 | 已配置，且 lint + typecheck 严格执行（测试可 passWithNoTests） |

Bad Case:

```json
// jest.config.json
{ "passWithNoTests": true }
// 且项目中无任何测试文件 — 框架空转
```

Good Case — 基建型：

```json
// jest.config.json
{
  "passWithNoTests": false,
  "collectCoverageFrom": ["src/**/*.{ts,tsx}", "!src/api/bam/**"],
  "coverageThreshold": { "global": { "branches": 30, "functions": 40, "lines": 40 } }
}
```

Good Case — 业务型：

```json
// jest.config.json — 测试可选
{ "passWithNoTests": true }

// 但 package.json 中有严格的静态检查
{
  "scripts": {
    "lint": "oxlint --quiet",
    "type-check": "tsc --noEmit",
    "_phase:lint": "rushx lint",
    "_phase:type-check": "rushx type-check"
  }
}
// CI 流程中 lint + type-check 必须通过

```

---

**6.3 测试模式可参考性**

| 评分 | 基建型标准                                        | 业务型标准                                                                                     |
| ---- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 0 分 | 无                                                | 无                                                                                             |
| 1 分 | 有少量示例但风格不一                              | 有至少 1 个测试文件可参照，有基本的测试数据可供使用                                            |
| 2 分 | 有统一的测试模式（mock、fixture、assertion 风格） | 有关键路径的测试示例，风格基本一致。测试场景化数据丰富，具备数据构造能力（如接入业务后台能力） |

Bad Case — 少量测试各自使用不同的 mock 风格，无统一约定。

Good Case — 基建型（统一模式）：

```typescript
// __tests__/useDebounce.test.ts
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 300));
    expect(result.current).toBe('hello');
  });

  it('should debounce value changes', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'hello' },
    });
    rerender({ value: 'world' });
    expect(result.current).toBe('hello');
    act(() => jest.advanceTimersByTime(300));
    expect(result.current).toBe('world');
  });
});
```

Good Case — 业务型（至少有 1 个可参照示例）：

```typescript
// src/modules/ProjectDetail/hooks/__tests__/useProjectDetail.test.ts
// 有 1 个核心 hook 的测试作为 AI 编写新测试的参照
```

---

**6.4 类型检查集成**

| 评分 | 标准（两种角色相同）                   |
| ---- | -------------------------------------- |
| 0 分 | 无 tsc 检查                            |
| 1 分 | 有但未纳入 CI                          |
| 2 分 | <code>tsc --noEmit</code> 纳入 CI 流程 |

> **注意**：类型检查对两种角色同等重要。对于业务型项目，typecheck 是替代高覆盖率测试的核心验证手段。

Bad Case — `package.json` 中无 `type-check` 脚本，CI 仅运行 `build`。

Good Case:

```json
// package.json
{
  "scripts": {
    "type-check": "tsc --noEmit",
    "_phase:type-check": "rushx type-check"
  }
}
// CI 流程: lint → type-check → test → build
```

---

**6.5 E2E / 集成测试**

| 评分 | 基建型标准   | 业务型标准                                                             |
| ---- | ------------ | ---------------------------------------------------------------------- |
| 0 分 | 无           | 无静态检查 + 无任何自动化验证                                          |
| 1 分 | 有但未维护   | lint + typecheck 通过但无 E2E（QA 手动覆盖）                           |
| 2 分 | 有且持续运行 | lint + typecheck 通过 + QA 流程覆盖关键路径 <strong>或</strong> 有 E2E |

> **业务型项目说明**：6.5 对业务型项目不强制要求 E2E 测试。QA 团队的手动测试流程可等效替代，但前提是 lint + typecheck 必须严格通过。

Bad Case — 无任何 E2E 测试配置，且无 QA 流程。

Good Case — 基建型：

```typescript
// e2e/project-create.spec.ts
import { test, expect } from '@playwright/test';

test('should create a new project', async ({ page }) => {
  await page.goto('/projects/create');
  await page.fill('[data-testid="project-name"]', 'test-project');
  await page.click('[data-testid="submit-btn"]');
  await expect(page.locator('.success-toast')).toBeVisible();
});
```

Good Case — 业务型：

```markdown
# 验证策略

- 自动化: lint (oxlint) + typecheck (tsc --noEmit) → CI 强制通过
- 人工: QA 团队按 Test Plan 覆盖功能验证
- AI 修改后: 确保 `rushx lint && rushx type-check` 通过即可提交 review
```

---

**6.6 Lint 在 CI 中执行**

| 评分 | 标准（两种角色相同） |
| ---- | -------------------- |
| 0 分 | 无                   |
| 1 分 | 有但可跳过           |
| 2 分 | 严格执行，阻断合并   |

> **注意**：Lint 对两种角色同等重要。对业务型项目而言，lint 是最核心的自动化质量保障。

Bad Case — CI 中 lint 步骤标记为 `allow_failure: true`。

Good Case — CI pipeline 中 lint 失败直接阻断 PR 合并：

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: rushx lint:ci # 失败即阻断
```

**计算方式**: D6 得分 = (各项得分之和 / 12) × 100（评分时使用与项目角色对应的标准列）

---

### D7 构建与开发体验（5%）

**核心问题**：AI 能否通过标准命令完成构建、启动、检查等操作？

#### 检查项与案例

---

**7.1 一键搭建**

| 评分 | 标准                                                     |
| ---- | -------------------------------------------------------- |
| 0 分 | 需多步手动操作                                           |
| 1 分 | 有文档但需手动执行多条命令，或者需要手工介入             |
| 2 分 | 全自动完成依赖安装 + 构建，并且有详细的 Skill 和排障指引 |

Bad Case:

```bash
npm install
cd ../common-lib && npm run build
cd ../common && npm run build
cd ../platform && npm run build
# 还需要手动配置 .env 文件

```

Good Case:

```bash
rushx setup  # 等价于 rush install --subspace portal && rush build --to-except .

```

---

**7.2 脚本完整性**

| 评分 | 标准                                               |
| ---- | -------------------------------------------------- |
| 0 分 | 仅有 build                                         |
| 1 分 | 有 build / dev / lint                              |
| 2 分 | 有 build / dev / lint / test / format / type-check |

Bad Case:

```json
{ "scripts": { "build": "webpack" } }
```

Good Case:

```json
{
  "scripts": {
    "build": "ttastra build",
    "dev": "ttastra dev",
    "lint": "oxlint --quiet",
    "lint:fix": "oxlint --fix",
    "test": "jest --config jest.config.json",
    "type-check": "tsc --noEmit",
    "format": "prettier --write 'src/**/*.{ts,tsx}'"
  }
}
```

---

**7.3 脚本命名规范**

| 评分 | 标准                                      |
| ---- | ----------------------------------------- |
| 0 分 | 命名不可预测                              |
| 1 分 | 基本可预测                                |
| 2 分 | 遵循社区惯例（dev / build / test / lint） |

Bad Case:

```json
{ "scripts": { "compile": "...", "serve-dev": "...", "check-code": "...", "verify": "..." } }
```

Good Case:

```json
{ "scripts": { "build": "...", "dev": "...", "lint": "...", "test": "...", "format": "..." } }
```

---

**7.4 构建速度**

| 评分 | 标准                 |
| ---- | -------------------- |
| 0 分 | 60s                  |
| 1 分 | 10-60s               |
| 2 分 | &lt; 10s（含热更新） |

Bad Case — Webpack 冷启动 90 秒，热更新 8 秒。

Good Case — rspack / Vite 冷启动 < 5 秒，热更新 < 500ms。

**计算方式**: D7 得分 = (各项得分之和 / 8) × 100

---

### D8 代码信噪比（5%）

**核心问题**：AI 的上下文窗口中，有效代码占比是否足够高？

#### 检查项与案例

---

**8.1 生成代码隔离**

| 评分 | 标准                              |
| ---- | --------------------------------- |
| 0 分 | 生成代码与业务代码混合            |
| 1 分 | 生成代码在独立目录但无标识        |
| 2 分 | 独立目录 + 文件头标识 + lint 忽略 |

Bad Case — 生成的 API 文件与手写的 API 文件在同一目录，无标识：

```plaintext
src/api/
├── getProject.ts        # 手写
├── getProject.gen.ts    # 生成，但无标识头
├── updateProject.ts     # 手写
└── updateProject.gen.ts # 生成

```

Good Case:

```plaintext
src/api/
├── bam/                 # 生成代码独立目录
│   └── portal_server/
│       └── index.ts     # 文件头: "// THIS IS AN AUTOGENERATED FILE. DO NOT EDIT."
├── portal-server.ts     # 手写封装
└── interceptors/        # 手写拦截器

```

ESLint 配置忽略生成目录：`ignorePatterns: ['src/api/bam/**']`

---

**8.2 无用代码清理**

> **\"死代码\"定义与度量**：以下三类均计为死代码：

| 类别                                        | 识别方式                                                                                    | 工具辅助                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| <strong>未使用的导入 / 变量 / 函数</strong> | ESLint 规则 <code>no-unused-vars</code>、<code>unused-imports/no-unused-imports</code> 报告 | 运行 <code>eslint --format json</code> 统计 warning/error 数                       |
| <strong>被注释掉的代码块</strong>           | 连续 &gt;= 3 行的注释代码（非文档注释）                                                     | 可通过正则 <code>^(\s*//.*){3,}</code> 粗略扫描                                    |
| <strong>不可达代码</strong>                 | <code>return</code>/<code>throw</code> 后的语句、永假条件分支、已下线的实验代码             | TypeScript 编译器 <code>--noUnusedLocals</code>、<code>--noUnusedParameters</code> |

> **度量方法**：在项目 src 目录下运行 lint 检查，统计上述三类的告警总数，除以项目总文件数得到**文件均告警数**。

| 评分 | 标准                                                                                                                                                      |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 分 | 文件均死代码告警 &gt;= 3 条，或存在 &gt;= 5 处超过 10 行的注释代码块                                                                                      |
| 1 分 | 文件均死代码告警 1-3 条，且无大段注释代码块；或已配置 lint 规则但未设为 <code>error</code> 级别                                                           |
| 2 分 | 文件均死代码告警 &lt; 1 条，lint 规则 <code>unused-imports/no-unused-imports</code> 和 <code>no-unused-vars</code> 设为 <code>error</code>，CI 中强制执行 |

Bad Case:

```typescript
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'; // 仅用了 useState
import { Button, Modal, Table, Form, Input, Select } from '@arco-design/web-react'; // 仅用了 Button

// const oldHandler = () => { ... }; // 注释掉但未删除的代码块，长达 50 行
```

Good Case:

```typescript
import { useState } from 'react';
import { Button } from '@arco-design/web-react';
```

配合 lint 规则 `unused-imports/no-unused-imports: 'error'` 自动清理。

---

**8.3 构建产物隔离**

| 评分 | 标准                                |
| ---- | ----------------------------------- |
| 0 分 | dist/ 被 AI 索引                    |
| 1 分 | .gitignore 排除                     |
| 2 分 | .gitignore + .cursorignore 双重排除 |

Bad Case — `.gitignore` 排除了 `dist/`，但无 `.cursorignore`，AI 仍可能索引到本地构建产物。

Good Case:

```plaintext
# .gitignore
dist/
output*/

# .cursorignore
dist/
output*/

```

---

**8.4 依赖功能重叠**

| 评分 | 标准             |
| ---- | ---------------- |
| 0 分 | 多个库做同一件事 |
| 1 分 | 少量重叠         |
| 2 分 | 无功能重叠的依赖 |

Bad Case — 同时安装三个 HTTP 客户端：

```json
{
  "dependencies": {
    "axios": "~1.4.0",
    "node-fetch": "~3.3.0",
    "got": "~13.0.0"
  }
}
```

Good Case — 统一使用一个 HTTP 客户端，在技术栈约束文档中明确：

```json
{
  "dependencies": {
    "axios": "~1.4.0"
  }
}
```

---

**8.5 日志 / 临时文件**

| 评分 | 标准                             |
| ---- | -------------------------------- |
| 0 分 | 日志文件在项目目录中且被 AI 索引 |
| 1 分 | .gitignore 排除                  |
| 2 分 | .gitignore + .cursorignore 排除  |

Bad Case — `log/` 目录含 1500+ 文件，未被 `.cursorignore` 排除。

Good Case:

```plaintext
# .cursorignore
log/
rush-logs/
*.log
.eslintcache
tsconfig.tsbuildinfo

```

---

**8.6 代码重复率**

> **为什么影响 AI 友好度**：重复代码直接浪费 AI 的上下文窗口，且当 AI 需要修改某个逻辑时，它无法确定是否所有副本都需要同步修改——这是 AI 辅助开发中"修了一处漏了三处"的常见根因。
> **度量方法**：使用 `jscpd`（或等效工具）扫描 `src/` 目录，关注以下指标：
>
> - **整体重复率**（Duplicated Lines %）：重复行数 / 总行数
> - **重复块数量**（Clone Count）：独立的重复代码块数
>   推荐配置：`jscpd --min-lines 10 --min-tokens 50 --reporters json`（最小 10 行 / 50 token，过滤琐碎匹配）。
>   **排除项**：自动生成代码目录（已在 8.1 中隔离）、测试文件中的 fixture/mock 重复。

| 评分 | 标准                                                            |
| ---- | --------------------------------------------------------------- |
| 0 分 | 整体重复率 &gt; 10%，或存在超过 50 行的重复代码块               |
| 1 分 | 整体重复率 5%-10%，无超过 50 行的重复块；或已知重复但有计划治理 |
| 2 分 | 整体重复率 &lt; 5%，公共逻辑已抽取为共享模块                    |

Bad Case — 同一段请求拦截逻辑在 4 个模块中各复制一份（每处约 30 行），AI 修改时只改了一处：

```typescript
// modules/video/api/interceptor.ts
export function setupInterceptor(client: AxiosInstance) {
  client.interceptors.response.use((res) => {
    /* 30 行错误处理和重试逻辑 */
  });
}

// modules/user/api/interceptor.ts — 几乎相同的 30 行
// modules/comment/api/interceptor.ts — 几乎相同的 30 行
// modules/creator/api/interceptor.ts — 几乎相同的 30 行
```

Good Case — 公共逻辑抽取到共享模块，各处引用：

```typescript
// shared/api/interceptor.ts
export function createStandardInterceptor(options: InterceptorOptions) {
  return (client: AxiosInstance) => {
    client.interceptors.response.use((res) => {
      /* 统一的错误处理和重试逻辑 */
    });
  };
}

// modules/video/api/client.ts
import { createStandardInterceptor } from '@shared/api/interceptor';
setupClient(createStandardInterceptor({ module: 'video' }));
```

**计算方式**: D8 得分 = (各项得分之和 / 12) × 100

---

### D9 Workspace 依赖可导航性（10%，条件维度）

**核心问题**：在跨包源码依赖的场景下，AI 能否理解依赖边界、安全地定位和修改代码？

#### 激活条件

D9 为**条件维度**，仅当被评估项目满足以下任一条件时激活：

| 条件                              | 说明                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 直接 workspace 依赖 &gt;= 10 个   | <code>package.json</code> 中 <code>workspace:</code> 协议的依赖（含 devDependencies）总数 &gt;= 10    |
| 总 workspace 依赖扇出 &gt;= 20 个 | 直接 + 传递 workspace 依赖总数 &gt;= 20                                                               |
| 入口应用源码打包                  | 项目为 monorepo 中的叶子应用（leaf app），通过构建工具打包了 workspace 包的源码（而非消费预编译产物） |

当 D9 **未激活**时：D1-D8 权重保持不变，D9 不计入总分，总分公式与单项目场景一致。当 D9 **激活**时：D1-D8 各项权重等比缩放至原来的 90%，D9 占 10%，详见"三、评分方法"。

> **设计意图**：在超大型 monorepo 中，一个入口应用可能通过源码引用 50-70+ 个 workspace 包。此时 AI 的工作范围远超单项目边界——它需要跨越包边界追踪类型链、理解别名映射、判断修改权限。这些问题在单项目仓库中不存在，因此作为条件维度，仅在需要时激活，避免对单项目评估产生噪声。

#### 检查项与案例

---

**9.1 依赖图可发现性**

| 评分 | 标准                                        |
| ---- | ------------------------------------------- |
| 0 分 | 除 package.json 外无任何依赖关系文档        |
| 1 分 | package.json 列出依赖，但无可视化或关系说明 |
| 2 分 | 有依赖图文档 / 可视化工具 / 影响分析报告    |

Bad Case — 50 个 workspace 依赖仅体现在 package.json 的长列表中，AI 无法快速理解依赖拓扑。

Good Case:

```markdown
# 依赖关系文档 (docs/architecture/project-relations/)

## 直接依赖分层

┌─────────────────────────────────┐
│ @webapp-desktop/app-client │ ← 入口应用
├─────────────────────────────────┤
│ 核心框架层 │
│ @tiktok/launcher │
│ @tiktok/routes │
│ @tiktok-fe/webapp-query │
├─────────────────────────────────┤
│ 业务共享层 │
│ @tiktok/webapp-common │
│ @tiktok/webapp-atoms │
│ @tiktok-fe/webapp-fetch │
├─────────────────────────────────┤
│ UI 组件层 │
│ @byted-tiktok/tux-pc │
│ @tiktok/ui │
└─────────────────────────────────┘

## 影响分析

修改 @tiktok/launcher 将影响: 12 个下游应用
修改 @tiktok/webapp-atoms 将影响: 8 个下游应用
```

配合 `PROJECT_RELATIONS.csv` 或 `PROJECT_IMPACT_ANALYSIS.md` 等机器可读的关系数据。

---

**9.2 包边界与公共 API 清晰度**

| 评分 | 标准                                                                                                  |
| ---- | ----------------------------------------------------------------------------------------------------- |
| 0 分 | 包无明确导出边界，消费方直接深层引用内部文件                                                          |
| 1 分 | 部分包有 index.ts 导出，但深层引用仍普遍存在                                                          |
| 2 分 | 所有被消费的 workspace 包有明确的 barrel 导出，package.json <code>exports</code> 字段限制了可引用路径 |

Bad Case — 消费方直接引用依赖的内部实现：

```typescript
// webapp-desktop-client 中
import { useInternalState } from '@tiktok/launcher/src/internal/hooks/useInternalState';
import { PRIVATE_CONFIG } from '@tiktok/routes/src/config/private';
```

Good Case — 通过公共 API 消费，边界清晰：

```typescript
// 被依赖包 @tiktok/launcher/package.json
{
  "exports": {
    ".": "./src/index.ts",
    "./ssr": "./src/ssr/index.ts"
  }
}

// webapp-desktop-client 中
import { createApp, useAppContext } from '@tiktok/launcher';
import { SSRRenderer } from '@tiktok/launcher/ssr';

```

---

**9.3 模块别名可追溯性**

| 评分 | 标准                                                     |
| ---- | -------------------------------------------------------- |
| 0 分 | 多层别名链无文档，AI 无法从 import 路径推断实际文件      |
| 1 分 | 别名存在于构建配置中，可通过代码阅读追溯                 |
| 2 分 | 别名有文档化清单，或别名层数 &lt;= 1（包名直接映射源码） |

Bad Case — 4 层别名叠加，AI 无法追踪实际路径：

```typescript
// 代码中
import { Player } from '@tiktok-arch/multimedia-playback';

// 实际解析链:
// @tiktok-arch/multimedia-playback
// → alias → node_modules/@tiktok-arch/multimedia-playback
// → internal re-export → @byted/multimedia-playback
// → alias → node_modules/@byted/multimedia-playback/src/Player
// AI 无法自主完成这个追踪
```

Good Case — 别名清单文档化：

```markdown
# 构建别名说明 (docs/BUILD_ALIASES)

| Import 路径                            | 实际解析目标                 | 用途               |
| -------------------------------------- | ---------------------------- | ------------------ |
| `@tiktok-arch/multimedia-playback`     | `@byted/multimedia-playback` | 多媒体播放器兼容层 |
| `@tiktok-arch/react-router-dom-compat` | `react-router-dom-v5`        | 路由兼容层         |
| `@tiktok-arch/solution-slardar`        | `runtime/slardar-adapter`    | 监控 SDK 适配      |
```

或更优：减少别名层数，让 AI 能通过包名直接定位源码。

---

**9.4 依赖方向与修改边界**

| 评分 | 标准                                                                      |
| ---- | ------------------------------------------------------------------------- |
| 0 分 | AI 无法判断哪些包可修改、哪些是外部依赖                                   |
| 1 分 | 有 CODEOWNERS 或 OWNERS 或 README 标注维护者                              |
| 2 分 | AI 行为指引中明确标注了修改边界（可修改区域 / 只读依赖 / 需协调修改的包） |

Bad Case — AI 发现 bug 根源在 `@tiktok/launcher` 中，直接修改了该包代码。但该包由框架团队维护，修改未经审批就被提交。

Good Case — 行为指引中明确边界：

```markdown
# AI 修改边界

## 可自由修改（本团队维护）

- `apps/webapp-desktop-client/**`
- `libs/desktop-shared/**`

## 只读依赖（消费但不修改，如需变更请提 Issue）

- `@tiktok/launcher` — 框架团队
- `@tiktok/routes` — 框架团队
- `@byted-tiktok/tux-pc` — TUX 团队

## 可提 PR 但需 Review（共享代码）

- `@tiktok/webapp-common` — 多团队共维护
- `@tiktok/webapp-atoms` — 多团队共维护
```

---

**9.5 跨包模式一致性**

| 评分 | 标准                                                                       |
| ---- | -------------------------------------------------------------------------- |
| 0 分 | 被依赖的 workspace 包之间模式严重分歧（不同状态管理、API 风格、错误处理）  |
| 1 分 | 核心包模式一致，少数历史包有偏差                                           |
| 2 分 | 所有高频消费的 workspace 包遵循统一模式（有共享 lint 配置 / 架构约定执行） |

Bad Case — 同一应用消费的 workspace 包模式混乱：

```typescript
// @tiktok/webapp-common — 使用 sigi（RxJS 风格状态管理）
import { useAppModuleState } from '@tiktok/webapp-common';

// @tiktok/webapp-atoms — 使用 jotai（原子化状态）
import { userAtom } from '@tiktok/webapp-atoms';

// @tiktok/login — 使用 hox（hooks 风格共享状态）
import { useLoginState } from '@tiktok/login';

// AI 在新增功能时不知道该用哪种模式
```

Good Case — 技术栈约束文档明确指引：

```markdown
# 状态管理统一规范

## 现状与迁移计划

- **新功能**: 统一使用 jotai (@tiktok/webapp-atoms)
- **历史包**: @tiktok/webapp-common 仍使用 sigi（仅维护，不新增）
- **禁止**: 新代码中不得引入 hox、Redux、MobX

## AI 编码指引

新增状态时，参照 @tiktok/webapp-atoms 的 atom 模式，
不要参照 @tiktok/webapp-common 的 sigi module 模式。
```

---

**9.6 依赖扇出与耦合度**

> **评估两个维度**：
>
> - **扇出（Fan-out）**：被评估包直接依赖的 workspace 包数量——扇出越大，AI 需要加载的上下文越多。
> - **耦合度（Coupling）**：关键依赖包的入度（被依赖次数）× 出度（依赖他人次数）反映其在依赖图中的"枢纽"程度——高耦合枢纽包的任何改动都可能产生连锁影响，AI 难以准确评估变更范围。
>   **度量方法**：
> - 扇出：直接统计 `package.json` 中 `workspace:` 协议依赖数
> - 耦合度：通过依赖分析脚本（如 Rush 的 `rush list --to` / 自定义脚本）计算关键包的入度和出度。耦合指数 = in-degree × out-degree，>100 视为高耦合枢纽包

| 评分 | 标准                                                                                                 |
| ---- | ---------------------------------------------------------------------------------------------------- |
| 0 分 | 直接 workspace 依赖 &gt; 50 个且无分层文档；或依赖链中存在耦合指数 &gt; 200 的枢纽包且无 AI 引导     |
| 1 分 | 直接 workspace 依赖 10-50 个；高耦合枢纽包已识别但缺乏 AI 导航（如修改影响范围提示）                 |
| 2 分 | 直接 workspace 依赖 &lt; 10 个或有清晰分层文档；高耦合枢纽包在 AI 指引中标注了修改注意事项和影响范围 |

Bad Case — 50 个直接 workspace 依赖平铺在 package.json 中，且核心依赖包 `@tiktok/fe-shared`（入度 45、出度 12、耦合指数 540）无任何 AI 引导：

```json
{
  "dependencies": {
    /* 17 个 workspace:* */
  },
  "devDependencies": {
    /* 33 个 workspace:* */
  }
}
// @tiktok/fe-shared: 被 45 个包依赖、自身依赖 12 个包
// AI 不知道改动此包会影响哪些下游，也不知道哪些依赖是核心
```

Good Case — 分层文档 + 高耦合包标注：

```markdown
# 依赖分层指南

修改不同功能时，你只需关注对应层级的依赖：

## 核心层（几乎每次都涉及）

@tiktok/launcher, @tiktok/routes, @tiktok/webapp-atoms

## 业务层（按功能域查阅）

- 视频播放: @tiktok/webapp-playback, @tiktok-arch/multimedia-playback
- 用户系统: @tiktok/login, @tiktok-fe/webapp-fetch
- 数据上报: @tiktok/tea, @tiktok/tea-events

## ⚠️ 高耦合枢纽包（修改需谨慎）

- **@tiktok/fe-shared**（耦合指数 540）：被 45 个包依赖。
  修改其公共 API 前，必须评估下游影响。
  优先通过新增接口而非修改已有接口来满足需求。

## 基础设施层（通常不需关注）

@tiktok/fixtures, @tiktok/testing-tools, webapp-vendors
```

**计算方式**: D9 得分 = (各项得分之和 / 12) × 100

---

## 三、交互验证方法论（补充评估）

### 3.1 定位与关系

D1-D9 的静态评估回答的是"**项目是否具备 AI 友好的特征**"——文档有没有、类型严不严格、测试覆不覆盖。但一个静态评分高的项目，AI 的实际产出质量不一定高（可能存在静态检查项未覆盖的隐性障碍）；反之，一个静态评分中等的项目，如果核心路径设计合理，AI 可能表现超出预期。

交互验证通过**实际驱动 AI 执行标准化任务**，度量 AI 的产出质量，回答"**AI 在项目中的实际表现如何**"。

```plaintext
┌─────────────────────┐         ┌─────────────────────┐
│   静态评估 (D1-D9)    │         │   交互验证 (本章)      │
│                     │         │                     │
│  评估项目特征         │◄─校准──►│  度量 AI 实际产出      │
│  成本低、可复现       │         │  成本中高、需执行任务   │
│  用于: 日常追踪       │         │  用于: 深度诊断        │
│       横向对比        │         │       改进验证         │
│       持续 CI        │         │       校准静态分数      │
└─────────────────────┘         └─────────────────────┘

```

> **使用建议**：静态评估（D1-D9）为必选，交互验证为可选。建议在以下时机执行交互验证：
>
> - 首次评估项目时（建立 baseline）
> - 完成一轮 AI 友好度改进后（验证改进效果）
> - 静态评分与团队主观感受差异较大时（诊断偏差原因）

### 3.2 基准任务集

每个项目应定义 **3-5 个基准任务**，覆盖 AI 辅助开发的核心场景。任务应从项目的真实历史需求中提取，并保证可重复执行。

#### 任务类别

| 类别                                          | 说明                                   | 难度参考 | 示例                                                |
| --------------------------------------------- | -------------------------------------- | -------- | --------------------------------------------------- |
| <strong>T1 代码导航</strong>                  | 要求 AI 解释特定代码流程或定位特定功能 | 低       | "请解释用户登录后 token 刷新的完整流程"             |
| <strong>T2 Bug 修复</strong>                  | 给定 bug 描述，要求 AI 定位根因并修复  | 中       | "用户头像在 SSR 模式下闪烁，请排查并修复"           |
| <strong>T3 功能新增</strong>                  | 给定需求规格，要求 AI 实现一个小型功能 | 中-高    | "在项目详情页新增一个'部署历史'Tab"                 |
| <strong>T4 重构优化</strong>                  | 要求 AI 重构指定代码段以提升质量       | 中       | "将 ProjectDetail.tsx（800 行）拆分为合理的子模块\" |
| <strong>T5 补充</strong><strong>测试</strong> | 要求 AI 为指定模块编写测试             | 中       | "为 useProjectPermission hook 编写单元测试"         |

#### 任务定义模板

```markdown
## 基准任务 #{编号}

**类别**: T2 Bug 修复
**描述**: {一段模拟用户会向 AI 发出的任务指令}
**预期修改范围**: {预期需要修改的文件列表}
**验证方式**: {如何判定任务完成——lint 通过 / 测试通过 / 人工 review}
**参考实现**: {可选——来自 git history 的真实修复作为标准答案}
**预期交互轮数**: {经验值，如 1-3 轮}
```

#### 任务选取原则

1. **真实性**：任务应来源于项目的真实 git history（如已合并的 PR），而非虚构场景
2. **可重复性**：任务应可在确定的 git commit 上重复执行，得到可比较的结果
3. **覆盖性**：3-5 个任务应覆盖至少 3 个不同类别
4. **难度梯度**：应包含至少 1 个低难度任务（T1）和 1 个中高难度任务（T3/T4）
5. **时效性**：T2/T3 任务应优先选取**最近 2-4 周**内的 commit，以减小代码状态与当前 HEAD 的差距

### 3.3 度量指标

| 指标                                    | 定义                                                              | 计算方式                                                           |
| --------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| <strong>首次通过率</strong> (FPR)       | AI 首次产出即通过自动化检查（lint + type-check + test）的任务占比 | 首次通过的任务数 / 总任务数                                        |
| <strong>最终完成率</strong> (TCR)       | 经过多轮交互后最终完成的任务占比                                  | 最终完成的任务数 / 总任务数                                        |
| <strong>平均交互轮数</strong> (AIR)     | 从任务发出到完成所需的平均人机交互轮次                            | Σ(各任务交互轮数) / 完成的任务数                                   |
| <strong>自动化验证通过率</strong> (AVR) | AI 产出代码通过项目自动化检查流水线的比率                         | 通过 <code>lint + type-check + test</code> 的产出次数 / 总产出次数 |
| <strong>人工采纳率</strong> (HAR)       | AI 产出代码被人工 review 后直接采纳（无需实质性修改）的比率       | 直接采纳次数 / 总 review 次数                                      |

> **关键指标**：**首次通过率 (FPR)** 和 **人工采纳率 (HAR)** 是最能反映项目 AI 友好度的交互指标。FPR 高说明项目的类型系统、lint 规则、测试覆盖足以约束 AI 产出；HAR 高说明 AI 对项目上下文的理解足够准确。

### 3.4 执行协议

#### 执行环境策略

不同任务类型使用不同的执行环境：

| 任务类型                     | 执行环境               | 原因                                               | 主要观测维度 |
| ---------------------------- | ---------------------- | -------------------------------------------------- | ------------ |
| <strong>T1 代码导航</strong> | 当前 HEAD              | 不改代码，直接在当前状态下评估 AI 对项目的理解能力 | D1-D5 综合   |
| <strong>T4 重构优化</strong> | 当前 HEAD              | 待重构的代码就是当前状态                           | D3-D5        |
| <strong>T5 测试补充</strong> | 当前 HEAD              | 待测的模块就在当前代码中                           | D3-D5 + D6   |
| <strong>T2 Bug 修复</strong> | 按优先级选择（见下方） | 需要已知参考答案做对比                             | 取决于策略   |
| <strong>T3 功能新增</strong> | 按优先级选择（见下方） | 同上                                               | 取决于策略   |

**T2/T3 环境搭建优先级**：

```plaintext
1. 优先：在当前 HEAD 上尝试 git revert --no-commit <fix-commit>
   └─ 成功（无冲突）→ 采用。在当前代码状态下执行，能同时观测 D1-D5 的综合效果
   └─ 失败（有冲突）→ 进入 2

2. 退回：创建历史 worktree
   └─ git worktree add /tmp/eval-task-N <fix-commit~1>
   └─ 将当前 HEAD 的 D1-D2 产物（文档、.cursor/rules/、CLAUDE.md 等）复制到 worktree
   └─ 在 worktree 中执行任务

3. 在报告中标注所使用的策略（见报告模板）

```

> **已知局限性**：当 T2/T3 任务退回到历史 worktree 执行时，周边代码的状态是历史快照。这意味着近期对 D3-D5（代码结构、类型安全、可读性）的改进**无法被该任务观测到**——只有 D1-D2（通过 overlay 复制到 worktree 的文档和行为指引）的改进效果会被体现。这是可复现性与观测完整性之间的固有权衡。
> **缓解措施**：
>
> - 优先选取最近 2-4 周的 commit（缩小 D3-D5 历史与现状的差距）
> - 优先使用策略 1（在当前 HEAD 上 revert），仅在冲突时退回策略 2
> - T1/T4/T5 在当前 HEAD 上执行，天然能观测 D3-D5 的改进效果，与 T2/T3 结果互补

#### 执行流程

```plaintext
1. 确定基线 → 选定当前 HEAD commit 作为评估基线
2. 定义任务集 → 3-5 个基准任务，覆盖核心场景
3. 搭建环境 → 按上述策略为每个任务准备执行环境
4. 执行任务 → 每个任务独立会话，记录完整交互过程
5. 采集指标 → 计算 FPR、TCR、AIR、AVR、HAR
6. 关联分析 → 将交互指标与静态评分对比，识别偏差维度
7. 输出报告 → 附在静态评估报告之后（见报告模板扩展）

```

#### 执行约束

- 每个任务使用**独立的 AI 会话**（不复用上下文），确保结果独立
- 交互过程中**不提供超出项目文档的额外提示**（如口头告知\"用 jotai\"），AI 应能从项目文档/代码自行发现
- 记录**完整的交互日志**（提示词 + AI 响应 + 人工反馈），用于复盘分析
- 对同一任务可使用**多个 AI 模型**执行，取平均值以消除模型差异

### 3.5 交互验证报告模板

```markdown
## 交互验证结果

**执行日期**: {日期}
**基线 Commit（当前 HEAD）**: {git commit hash}
**AI 模型**: {模型名 + 版本}
**基准任务数**: {N}

### 指标汇总

| 指标                   | 值     | 参考基线     |
| ---------------------- | ------ | ------------ |
| 首次通过率 (FPR)       | {X}%   | > 60% 为良好 |
| 最终完成率 (TCR)       | {X}%   | > 80% 为良好 |
| 平均交互轮数 (AIR)     | {X} 轮 | < 3 轮为良好 |
| 自动化验证通过率 (AVR) | {X}%   | > 70% 为良好 |
| 人工采纳率 (HAR)       | {X}%   | > 50% 为良好 |

### 逐任务明细

| #   | 类别 | 描述   | 执行策略                                                  | 首次通过 | 交互轮数 | 人工采纳 | 失败原因分析                                 |
| --- | ---- | ------ | --------------------------------------------------------- | -------- | -------- | -------- | -------------------------------------------- |
| 1   | T2   | {描述} | {HEAD revert / 历史 worktree + D1-D2 overlay / 当前 HEAD} | ✅/❌    | {N}      | ✅/❌    | {若失败：缺乏 X 上下文 / 类型推断错误 / ...} |

### 静态评分 vs 交互表现关联分析

{分析静态评分与交互指标的吻合/偏差情况，例如：

- D1 文档体系得分 85，但 T1 代码导航任务 AI 需要 5 轮交互 → 文档虽存在但可发现性不足
- D4 类型安全得分 90，FPR 为 80% → 类型系统有效约束了 AI 产出
- D6 测试得分 40，AVR 仅 30% → 缺乏测试导致 AI 无法自行验证}
```

### 3.6 静态评分校准

交互验证的核心价值之一是**校准静态评分的有效性**。当两者出现显著偏差时，说明静态检查项存在盲区或误判：

| 偏差模式        | 可能原因                                                            | 改进方向                                             |
| --------------- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| 静态高 + 交互低 | 文档/测试存在但质量低（形式达标、内容空洞）；存在未被评估的隐性障碍 | 深入审视低 FPR 任务的失败原因，补充静态检查项        |
| 静态低 + 交互高 | 代码自身结构极清晰，弥补了文档/配置的不足                           | 说明代码质量本身是最大的 AI 友好因子，可适当调整权重 |
| 两者均低        | 项目整体 AI 友好度不足                                              | 按静态评分的 P0 建议优先改进                         |
| 两者均高        | 项目 AI 友好度良好，静态评分可信                                    | 维持现状，定期复评                                   |

---

## 四、评分方法

### 4.1 评分流程

```plaintext
1. 判定项目属性:
   a. 项目角色 → 基建型 / 业务型（影响 D6 权重和评分标准，见下方判定规则）
   b. D9 激活条件 → 确定使用"标准公式"还是"Monorepo 公式"
2. 逐项评估 → 对每个检查项打 0/1/2 分（D6 按项目角色选择对应标准），并记录证据
3. 维度得分 → 按公式计算各维度百分制得分
4. 加权总分 → 按对应公式和项目角色权重计算加权原始分
5. 短板修正 → 检查是否触发短板规则，计算修正后总分（见 4.3）
6. 等级判定 → 按修正后总分确定等级

```

#### 项目角色判定规则

项目角色决定 D6 的权重和评分标准，以及关键维度的组成。判定基于**下游影响范围**和**项目定位**两个维度：

| 判定条件                                                                                    | 满足任一即为 <strong>基建型</strong> |
| ------------------------------------------------------------------------------------------- | ------------------------------------ |
| 被 &gt;= 3 个其他项目直接依赖（monorepo 内 workspace 依赖或 npm 发布后被引用）              | 代码变更影响面广，需严格自动化保障   |
| 项目定位为框架、共享库、SDK、构建工具、CLI 工具                                             | 本质上是"为其他项目提供能力"的代码   |
| package.json 中 <code>main</code> / <code>exports</code> 字段指向源码入口（即作为包被消费） | 表明该项目被设计为公共 API 提供方    |

| 判定条件                                                 | 满足以下特征即为 <strong>业务型</strong>     |
| -------------------------------------------------------- | -------------------------------------------- |
| 项目为面向终端用户的应用（如 SPA、SSR 应用、H5 页面）    | 代码变更主要影响用户体验，功能验证由 QA 保障 |
| 项目为叶子节点（无其他项目依赖它，或仅被部署流水线消费） | 变更的爆炸半径限于自身                       |
| 项目以高频迭代业务需求为主（功能开发 &gt; 基础能力建设） | 迭代效率优先于自动化覆盖率                   |

**混合情况处理**：

当项目同时具有基建型和业务型特征时（如一个业务应用恰好被少量项目引用了部分 util），不预设默认方向，由评估者根据项目的**主要职责**自行判定，并在报告中记录理由。

**评估报告中须明确记录**：项目角色判定结果 + 判定依据（如\"下游依赖项目数\"、\"项目主要职责\"等），以确保评估可复现。

### 4.2 评分公式

**标准公式 — 基建型**（D9 未激活，D6 权重 15%）：

```plaintext
总分 = D1×0.20 + D2×0.15 + D3×0.15 + D4×0.15 + D5×0.10 + D6×0.15 + D7×0.05 + D8×0.05

```

**标准公式 — 业务型**（D9 未激活，D6 权重降至 8%，空出 7% 重新分配）：

```plaintext
总分 = D1×0.20 + D2×0.15 + D3×0.17 + D4×0.15 + D5×0.12 + D6×0.08 + D7×0.08 + D8×0.05

```

> **业务型权重说明**：D6 从 15% 降至 8%，空出的 7% 分配给 D3（+2%，代码结构对 AI 导航更重要）、D5（+2%，可读性弥补测试不足）、D7（+3%，构建体验对迭代效率影响大）。

**Monorepo 公式**（D9 激活，适用于有大量源码级 workspace 依赖的项目）：

```plaintext
基础分 = {按项目角色选择上述标准公式计算}
总分   = 基础分 × 0.90 + D9×0.10

```

> **归一化原理**：D1-D8 的权重比例保持不变（内部相对关系不受影响），仅整体等比缩放至 90%，腾出 10% 给 D9。这样：
>
> - 一个单项目得 80 分的项目，总分 = 80
> - 一个 monorepo 项目 D1-D8 同样得 80 分，D9 得 80 分，总分 = 80×0.9 + 80×0.1 = 80（分数可比）
> - 一个 monorepo 项目 D1-D8 得 80 分，但 D9 仅 40 分，总分 = 80×0.9 + 40×0.1 = 76（依赖复杂度拖累了整体得分，符合预期）

### 4.3 短板修正规则

纯线性加权无法反映维度间的\"短板效应\"——一个文档和类型都很好但完全没有测试的项目，AI 无法验证任何产出，实际 AI 友好度远低于加权分数所暗示的水平。短板修正规则通过**等级封顶**和**短板惩罚**两个机制来解决这一问题。

#### 规则 1：关键维度等级封顶

**关键维度因项目角色而异**：

| 项目角色                | 关键维度                           | 说明                                                                       |
| ----------------------- | ---------------------------------- | -------------------------------------------------------------------------- |
| <strong>基建型</strong> | D1（文档）、D4（类型）、D6（测试） | 三大支柱齐全，测试是基建代码的生命线                                       |
| <strong>业务型</strong> | D1（文档）、D4（类型）             | 文档和类型是保障业务迭代效率和 AI 理解力的核心，测试由 QA 覆盖，权重已降低 |

**封顶规则**：

| 关键维度得分 | 最高允许等级 | 说明                                               |
| ------------ | ------------ | -------------------------------------------------- |
| &lt; 40      | C (及格)     | 关键维度严重不足，即使其他项得分高，整体也难称良好 |
| &lt; 60      | B (良好)     | 关键维度存在明显短板，限制了项目整体 AI 友好度上限 |
| = 60         | A (优秀)     | 无封顶，按总分计算                                 |

**修正流程**：

1. 计算加权原始总分
2. 检查所有关键维度的得分
3. 若任一关键维度得分触发封顶，则将项目的**最终等级**限制在封顶等级，即使原始总分可能更高。例如，一个基建型项目总分 85（A），但 D6 测试仅 35 分，则最终等级被修正为 C。

#### 规则 2：短板惩罚

当多个**非关键维度**同时得分极低时，也会产生连锁负效应。

**触发条件**：除 D1/D4/D6 外，任意 **2 个或以上**的维度得分 < 40**惩罚措施**：在加权原始总分的基础上，额外扣除 **5 分**

**示例**：一个业务型项目，D1=80, D4=85，但 D2=30, D3=35, D5=90, D7=90, D8=90。

- 加权原始总分 = 79.1
- 触发短板惩罚：D2 < 40 且 D3 < 40
- 修正后总分 = 79.1 - 5 = 74.1

### 4.4 等级判定

| 总分范围 | 等级 | 描述                                                                                                                                  |
| -------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------- |
| ≥ 85     | A    | <strong>AI 友好</strong>：项目结构清晰、文档全面、类型严格、测试覆盖良好，AI 可高效、可靠地完成大部分任务                             |
| 70-84    | B    | <strong>AI 可用</strong>：项目具备基本的 AI 友好特征，但存在一些短板（如文档过时、测试覆盖不足），AI 在某些场景下可能需要更多人工引导 |
| 50-69    | C    | <strong>AI 可挑战</strong>：项目存在显著的 AI 不友好特征，AI 完成任务的成本较高，产出质量不稳定，需要大量人工干预和修正               |
| &lt; 50  | D    | <strong>AI 不友好</strong>：项目缺乏基本的 AI 友好度设计，AI 难以理解上下文，产出代码几乎不可用                                       |

---

## 五、评估报告模板

```markdown
# {项目名} AI 友好度评估报告

**评估日期**: {YYYY-MM-DD}
**评估人**: {姓名}
**项目角色**: {基建型 / 业务型}
**总览 Commit**: {git commit hash}

---

## 评估结果

- **修正后总分**: {XX.X}
- **最终等级**: {A / B / C / D}
- **关键短板**: {D1 文档 / D4 类型 / D6 测试 / ...}

---

## 维度得分与证据

| 维度                      | 权重      | 原始得分 | 证据与说明                                                                                  |
| ------------------------- | --------- | -------- | ------------------------------------------------------------------------------------------- |
| D1 文档体系               | {XX%}     | {XX.X}   | {简述各检查项得分依据，如：`1.1(2), 1.2(1), 1.3(0)...`，附上关键好/坏案例截图或链接}        |
| D2 AI 行为指引            | {XX%}     | {XX.X}   | {评估了哪些生效的 AI 配置文件？是根级继承还是子项目增量？glob 路径是否正确？内容质量如何？} |
| D3 代码可发现性与结构     | {XX%}     | {XX.X}   | {目录结构、命名一致性、复杂度扫描结果等}                                                    |
| D4 类型安全与约束一致性   | {XX%}     | {XX.X}   | {strict 模式、any 使用情况、lint 规则强度等}                                                |
| D5 代码可读性与注释       | {XX%}     | {XX.X}   | {自文档化函数占比、复杂逻辑注释覆盖率、常量语义化情况等}                                    |
| D6 测试与可验证性         | {XX%}     | {XX.X}   | {测试覆盖率、CI 中 lint/type-check/test 执行情况、E2E 覆盖等}                               |
| D7 构建与开发体验         | {XX%}     | {XX.X}   | {一键搭建、脚本完整性、构建速度等}                                                          |
| D8 代码信噪比             | {XX%}     | {XX.X}   | {生成代码隔离、无用代码扫描结果、依赖重叠情况等}                                            |
| D9 Workspace 依赖可导航性 | {10% / -} | {XX.X}   | {是否激活？依赖图、包边界、别名追溯、修改边界等}                                            |

---

## 短板修正详情

- **加权原始总分**: {XX.X}
- **关键维度等级封顶**: {是否触发？哪个维度？封顶至哪个等级？}
- **短板惩罚**: {是否触发？哪几个维度？扣除 5 分}
- **修正后总分**: {XX.X}

---

## 改进建议（ROI 导向）

> **改进投资回报率 (ROI) 判定指南**
>
> 改进建议应聚焦于**高 ROI** 的行动项。ROI 取决于两方面：**投入成本**和**收益**（对 AI 友好度的提升效果）。
>
> | 维度 | 典型改进成本                   |
> | ---- | ------------------------------ |
> | D1   | 低-中（补写文档）              |
> | D2   | 低（撰写 AI 行为指引）         |
> | D3   | 中-高（调整目录结构、重命名）  |
> | D4   | 中-高（开启 strict、消除 any） |
> | D5   | 低-中（补充注释、语义化常量）  |
> | D6   | 高（补写测试）                 |
> | D7   | 低-中（规范化脚本、优化构建）  |
> | D8   | 低（配置 lint、清理死代码）    |
> | D9   | 低-中（文档化依赖、标注边界）  |
>
> **基本原则**：优先从**成本低、分数低**的维度入手，能快速提升总分。

### P0 (必须改进)

- {关键维度得分 < 40 的项}
- {触发短板惩罚的项}

### P1 (强烈建议)

- {得分 < 60 且改进成本为低/中的项}

### P2 (可以考虑)

- {其他得分较低但改进成本较高的项}

---

## 附录：交互验证报告（可选）

{若执行了交互验证，将报告附在此处}
```

---

## 附录 A：快速评估检查清单

### 项目属性

- [ ] 项目角色：基建型 / 业务型（原因: ...）
- [ ] D9 激活：是 / 否（原因: ...）

### 检查项（2 分标准）

**D1 文档体系**

- [ ] 1.1 有含模块结构、入口、命令、架构简述的 README
- [ ] 1.2 有系统性架构文档（模块图、数据流、技术栈）
- [ ] 1.3 有独立的概念文档定义业务术语
- [ ] 1.4 有标准化开发流程文档
- [ ] 1.5 有文档索引 + 场景化导航
- [ ] 1.6 >= 50% 核心模块有 README
- [ ] 1.7 文档最近 1 个月内有更新
      **D2 AI 行为指引与上下文管控**（评估生效配置 = 根级继承 + 子项目增量）

- [ ] 2.1 有项目特定的 AI 行为指引（根级覆盖 + 子项目增量均可计分）
- [ ] 2.2 指引按层级组织（全局 → 框架 → 项目 → 模块）
- [ ] 2.3 有 AI 导航文档（入口、禁区、任务路径）
- [ ] 2.4 有专门的 AI 上下文过滤配置
- [ ] 2.5 有按领域组织的可检索知识文档
- [ ] 2.6 有明确的文档阅读顺序指引
- [ ] 2.7 多工具共享知识层 + 薄适配层 + 一致性保障
- [ ] Monorepo：根级规则 glob 正确匹配到本子项目路径（跨包可发现）
      **D3 代码可发现性与结构**

- [ ] 3.1 目录按职责清晰分层
- [ ] 3.2 模块有独立的内部结构
- [ ] 3.3 命名风格统一
- [ ] 3.4 关键模块有 barrel 文件
- [ ] 3.5 路径别名有配置和文档
- [ ] 3.6 多数文件 < 300 行 + ESLint `complexity` 规则已启用（阈值 ≤ 20）且核心模块无违规
      **D4 类型安全与约束一致性**

- [ ] 4.1 TypeScript strict: true
- [ ] 4.2 禁止或极少使用 any
- [ ] 4.3 API 有完整类型定义
- [ ] 4.4 组件 Props 有类型
- [ ] 4.5 严格 lint + CI 执行
- [ ] 4.6 有书面技术栈约束
- [ ] 4.7 环境变量有类型声明
      **D5 代码可读性与注释**

- [ ] 5.1 公共函数可理解性：普遍满足自文档化（CC ≤ 15 + 明确类型 + 语义命名），未满足者有 JSDoc 补偿
- [ ] 5.2 复杂逻辑段（>= 3 条件分支 / 魔法值 / 状态机 / 正则 / 外部契约）> 70% 有意图注释
- [ ] 5.3 常量语义化且集中管理
- [ ] 5.4 注释语言统一
      **D6 测试与可验证性**（标准因项目角色而异，下列为 2 分标准）

- [ ] 6.1 基建型: 覆盖率 >= 30% 且核心 >= 60% / 业务型: 关键路径有测试
- [ ] 6.2 基建型: 测试框架配置且有实际测试 / 业务型: lint + typecheck 严格执行
- [ ] 6.3 基建型: 统一测试模式 / 业务型: 至少有可参照的测试示例
- [ ] 6.4 tsc --noEmit 纳入 CI（两种角色相同）
- [ ] 6.5 基建型: 有 E2E 且持续运行 / 业务型: lint + typecheck + QA 覆盖
- [ ] 6.6 Lint 在 CI 严格执行（两种角色相同）
      **D7 构建与开发体验**

- [ ] 7.1 单命令完成环境搭建
- [ ] 7.2 有 build/dev/lint/test/format/type-check 脚本
- [ ] 7.3 脚本命名遵循社区惯例
- [ ] 7.4 构建 / 热更新 < 10s
      **D8 代码信噪比**

- [ ] 8.1 生成代码独立目录 + 文件头标识 + lint 忽略
- [ ] 8.2 文件均死代码告警 < 1 条 + `unused-imports` / `no-unused-vars` 设为 error + CI 强制
- [ ] 8.3 构建产物被 .gitignore + .cursorignore 排除
- [ ] 8.4 无功能重叠的依赖
- [ ] 8.5 日志 / 临时文件被双重排除
- [ ] 8.6 代码重复率 < 5%（`jscpd` 扫描），公共逻辑已抽取为共享模块
      **D9 Workspace 依赖可导航性**（条件维度，满足激活条件时评估）

- [ ] 9.1 有依赖图文档 / 可视化 / 影响分析报告
- [ ] 9.2 workspace 包有明确 barrel 导出 + package.json exports 限制
- [ ] 9.3 构建别名有文档化清单或别名层数 <= 1
- [ ] 9.4 AI 行为指引中标注了修改边界（可修改 / 只读 / 需协调）
- [ ] 9.5 高频消费的 workspace 包遵循统一模式
- [ ] 9.6 依赖扇出 < 10 或有分层文档；高耦合枢纽包（耦合指数 > 100）在 AI 指引中标注修改注意事项

---

## 附录 B：版本历史

| 版本 | 日期       | 变更内容                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1  | 2026-02-24 | 初版发布：8 维度、48 检查项、Good/Bad Case 示例、评估报告模板                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 0.2  | 2026-02-25 | D2 重构为工具中立设计；新增 D9 条件维度；新增\"三、交互验证方法论\"；新增短板修正规则；D6 引入项目角色适配（基建型 / 业务型）；评估报告新增 ROI 导向的改进优先级判定指南；维度权重调整指南新增改进投资 ROI 参考表；D2 新增 Monorepo 生效配置原则（根级继承 + 增量评估 + 跨包可发现性）；D5 重构：合并 5.1+5.2 为新 5.1「函数可理解性」确立自文档化优先原则，D5 满分调整为 8；检查项量化：5.1/5.2/8.2 补充操作性定义；交互验证执行协议细化（按任务类型分环境策略 + 已知局限性声明）；引入工程质量度量：D3.6 增强为「代码单元复杂度」纳入函数圈复杂度并新增扁平分发 CC 豁免机制，D8 新增 8.6「代码重复率」（D8 满分调整为 12），D9.6 扩展为「依赖扇出与耦合度」纳入包级耦合指数 |
