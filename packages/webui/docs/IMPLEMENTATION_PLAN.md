# pi WebUI 剩余功能实现计划

## 总体目标

将当前极简聊天界面升级为符合 Ant Design X RICH 范式的完整 AI Agent 交互界面，分 5 个阶段实施，预计总工作量 5-7 天。

## 当前架构回顾

```
Browser <--WebSocket--> BridgeServer <--stdio RPC--> pi --mode rpc
```

前端通过 `useBridge` 与 BridgeServer 建立 WebSocket 连接，收发 JSON-RPC 消息。`pi` 进程的事件流包含：
- `agent_start` / `agent_end` — 流式生成开始/结束
- `message_update` — 流式内容增量更新
- `message_end` — 单条消息完成
- `extension_ui_request` — 扩展 UI 交互请求（select/confirm/input/...）
- `tool_execution_start` / `tool_execution_end` — 工具执行生命周期

**关键发现**：`message_update`/`message_end` 的 `message.content` 数组中已包含 `type: "thinking"` 的内容块（来自 pi 的 reasoning 输出），但当前 `MessageBubble` 只处理了 `text` 和 `toolCall`，`thinking` 被静默丢弃。

---

## Phase 1: 数据流重构（1-2 天）

### 问题

- `events` 数组在 `useBridge` 中无限累积，无上限、无清理
- 消息状态（loading/success/error）无标准化管理
- 状态提取逻辑散落在 `App.tsx` 的 `extractMessages` 中
- 没有 `abort` 能力（用户无法中断生成）

### 方案

创建 `usePiChat` hook，对标 `useXChat` 但适配 pi 的 WebSocket RPC 协议。

```ts
// src/hooks/usePiChat.ts
interface UsePiChatReturn {
  messages: AgentMessage[];           // 已完成的消息列表
  streamingMessage?: AgentMessage;    // 当前流式消息
  status: "idle" | "loading" | "error";
  connected: boolean;
  onRequest: (message: string, images?: ImageContent[]) => void;
  onAbort: () => void;
}
```

### 任务清单

| # | 任务 | 文件 |
|---|---|---|
| 1.1 | 创建 `usePiChat`，封装 `useBridge` + 状态机 | `src/hooks/usePiChat.ts` |
| 1.2 | 实现消息生命周期：`local` → `loading`（发 prompt 后）→ `success`（agent_end 后） | `src/hooks/usePiChat.ts` |
| 1.3 | 实现 `events` 自动清理：只保留最近 2000 条，或按消息边界裁剪 | `src/hooks/usePiChat.ts` |
| 1.4 | 实现 `onAbort`：发送 `abort` RPC 命令 | `src/hooks/usePiChat.ts` |
| 1.5 | `App.tsx` 移除 `extractMessages`，改用 `usePiChat` | `src/App.tsx` |
| 1.6 | `Composer` 接入 `loading` / `onAbort`（Sender 支持 `onCancel`） | `src/components/Composer.tsx` |

### 风险

- `events` 清理策略需与调试需求平衡（是否保留完整历史用于 export_html？）
- **缓解**：清理前将过期事件归档到 `WeakRef` 或 sessionStorage

---

## Phase 2: ThoughtChain 思维链（1 天）

### 问题

AI 的 reasoning/thinking 过程被丢弃，用户看不到模型"在想什么"。

### 方案

从 `message.content` 数组中提取 `type: "thinking"` 的块，使用 Ant Design X `ThoughtChain` 组件展示。

```ts
// content 数组中的 thinking 块示例
[
  { type: "thinking", thinking: "让我分析一下..." },
  { type: "text", text: "最终答案..." }
]
```

### 任务清单

| # | 任务 | 文件 |
|---|---|---|
| 2.1 | 在 `getContent` 中分离 `thinking` 和 `text`/`toolCall` | `src/components/ChatView.tsx` |
| 2.2 | 创建 `ThoughtChainView`，接收 `thinkingSteps: string[]` | `src/components/ThoughtChainView.tsx` |
| 2.3 | `Bubble` 的 `footer` 插槽中嵌入可折叠的 `ThoughtChainView` | `src/components/ChatView.tsx` |
| 2.4 | 移动端适配：折叠按钮需 ≥ 44px 触摸区域 | `src/components/ThoughtChainView.tsx` |

### 设计细节

- 默认折叠，点击展开
- 流式生成时实时追加 thinking 步骤
- thinking 文本使用 `font-family: monospace` + 灰底区分

---

## Phase 3: Attachments 附件上传（1 天）

### 问题

无法发送图片，`Sender` 没有附件前缀，`prompt` 命令的 `images` 字段始终为空。

### 方案

使用 `@ant-design/x` 的 `Attachments` 组件作为 `Sender` 的 `prefix`，支持点击上传和拖拽上传。

### 任务清单

| # | 任务 | 文件 |
|---|---|---|
| 3.1 | `Sender` 添加 `prefix={<Attachments ... />}` | `src/components/Composer.tsx` |
| 3.2 | 管理附件状态（fileList），限制单图/多图 | `src/components/Composer.tsx` |
| 3.3 | `onSubmit` 时将图片转为 base64 `ImageContent` | `src/components/Composer.tsx` |
| 3.4 | `usePiChat.onRequest` 支持 `images` 参数 | `src/hooks/usePiChat.ts` |
| 3.5 | 消息气泡展示图片（`ImageContent` 渲染） | `src/components/ChatView.tsx` |

### 设计细节

- 图片最大 5MB，格式限制 jpg/png/webp
- 上传后缩略图显示在输入框上方
- 移动端唤起相机/相册选择

---

## Phase 4: Prompts + Suggestion 快捷交互（1 天）

### 问题

空状态时用户不知道问什么；AI 回复后没有追问引导。

### 方案

- **Prompts**：空状态时用 `Prompts` 组件展示 4-6 个预设提示词（如"/help", "解释代码", "优化性能"）
- **Suggestion**：AI 回复完成后，在消息列表底部展示 3 个建议追问按钮

### 任务清单

| # | 任务 | 文件 |
|---|---|---|
| 4.1 | 创建 `PromptPanel`，配置静态提示词列表 | `src/components/PromptPanel.tsx` |
| 4.2 | 空状态时 `Welcome` 下方展示 `PromptPanel` | `src/App.tsx` |
| 4.3 | 创建 `SuggestionBar`，接收建议列表 | `src/components/SuggestionBar.tsx` |
| 4.4 | `agent_end` 后解析建议追问（若后端支持）或前端静态生成 | `src/hooks/usePiChat.ts` + `src/App.tsx` |
| 4.5 | 点击建议直接发送 follow_up | `src/components/SuggestionBar.tsx` |

### 风险

- pi 后端目前不返回"建议追问"，需协商协议扩展
- **缓解**：Phase 4.1-4.2 可先独立实施（Prompts 不依赖后端）

---

## Phase 5: Conversations 会话管理（2 天）

### 问题

无法查看历史会话、切换会话、新建会话。

### 方案

左侧边栏使用 `Conversations` 组件展示会话列表，支持分组、操作菜单。

```
+----------+----------------------------------+
| Sessions | Chat Area                        |
| ├─ Today |                                  |
| │  ●  Session 1                  |          |
| │    Session 2                   |          |
| ├─ Earlier                     |          |
| │    Session 3                   |          |
| + [New]                        |          |
+----------+----------------------------------+
```

### 任务清单

| # | 任务 | 文件 |
|---|---|---|
| 5.1 | `App.tsx` 布局改为 sidebar + main 双栏 | `src/App.tsx` |
| 5.2 | 移动端 sidebar 可折叠（汉堡菜单） | `src/App.tsx` |
| 5.3 | 创建 `ConversationList` 包装 `Conversations` | `src/components/ConversationList.tsx` |
| 5.4 | 调用 `get_commands` 或扫描 `.pi/agent/sessions` 获取会话列表 | `src/hooks/usePiChat.ts` 或 bridge 扩展 |
| 5.5 | 实现 `new_session`（+ 按钮） | `src/components/ConversationList.tsx` |
| 5.6 | 实现 `switch_session`（点击切换） | `src/components/ConversationList.tsx` |
| 5.7 | 实现 `fork` / `clone`（右键菜单） | `src/components/ConversationList.tsx` |
| 5.8 | 实现 `set_session_name`（重命名） | `src/components/ConversationList.tsx` |

### 风险

- pi RPC 协议没有 `list_sessions` 命令，需确定如何获取会话列表
- **方案 A**：BridgeServer 扫描 `~/.pi/agent/sessions` 目录，通过新 API 暴露
- **方案 B**：前端直接调用 `bash` 命令扫描目录（不推荐，权限问题）
- **建议**：优先在 `bridge-server/server.ts` 中添加 `GET /sessions` HTTP 端点

---

## 跨阶段公共任务

| # | 任务 | 说明 |
|---|---|---|
| A | 扩展消息内容渲染 | 当前只支持 `text`/`toolCall`/`thinking`，需支持 `image`、`code`（语法高亮）、`markdown` |
| B | Error Boundary | 添加 React Error Boundary 防止组件崩溃导致白屏 |
| C | Loading Skeleton | `Bubble.List` 的 `loading` 状态展示骨架屏 |
| D | 主题切换 | 通过 `XProvider` 支持 light/dark/system 主题 |

---

## 优先级建议

```
P0 (立即): Phase 1 (数据流重构) — 所有后续功能的基础
P1 (本周): Phase 2 (ThoughtChain) + Phase 3 (Attachments)
P2 (下周): Phase 4 (Prompts + Suggestion)
P3 (下下周): Phase 5 (Conversations) — 依赖后端协议扩展
```

---

## 文件变更总览

### 新增文件

```
src/hooks/usePiChat.ts
src/components/ThoughtChainView.tsx
src/components/PromptPanel.tsx
src/components/SuggestionBar.tsx
src/components/ConversationList.tsx
src/components/AttachmentButton.tsx
src/components/ErrorBoundary.tsx
```

### 修改文件

```
src/main.tsx              — 已有 XProvider
src/App.tsx               — 接入 usePiChat、sidebar 布局
src/components/ChatView.tsx     — 接入 ThoughtChain、图片渲染
src/components/Composer.tsx     — 接入 Attachments、Abort
src/components/StatusBar.tsx    — 可扩展显示 token 统计
src/bridge/types.ts       — 可能需要扩展会话列表类型
src/styles/index.css      — 主题变量适配
```

### 可能的后端变更

```
packages/webui/bridge-server/server.ts  — 添加 GET /sessions 端点
packages/webui/bridge-server/pi-process.ts — 如有需要
```
