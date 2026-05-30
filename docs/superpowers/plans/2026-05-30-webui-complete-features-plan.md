# Pi WebUI Complete Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement ALL remaining pi RPC capabilities using Ant Design X components.

**Architecture:** Replace custom components with Ant Design X equivalents, add missing RPC command handlers.

**Tech Stack:** React 19, Vite 6, Ant Design X 1.3, Ant Design 5, highlight.js, ansi-to-html

---

## Task 1: Replace Composer with Sender

**Files:**
- Modify: `packages/webui/src/components/Composer.tsx`

- [ ] **Step 1: Rewrite Composer using Sender**

```tsx
import { Sender } from "@ant-design/x";

export interface ComposerProps {
	onSend: (message: string) => void;
	onCancel?: () => void;
	disabled?: boolean;
	loading?: boolean;
}

export function Composer({ onSend, onCancel, disabled, loading }: ComposerProps) {
	return (
		<Sender
			onSubmit={onSend}
			onCancel={onCancel}
			loading={loading}
			disabled={disabled}
			placeholder="Type a message... (Enter to send)"
			style={{ margin: 12 }}
		/>
	);
}
```

- [ ] **Step 2: Update App.tsx to pass loading and onCancel**

```tsx
<Composer
	onSend={handleSend}
	onCancel={handleAbort}
	disabled={!connected}
	loading={state.isStreaming}
/>
```

- [ ] **Step 3: Add abort handler**

```tsx
const handleAbort = useCallback(() => {
	try { send({ type: "abort" }); } catch { /* ignore */ }
}, [send]);
```

- [ ] **Step 4: Verify and commit**

---

## Task 2: Replace Message List with Bubble.List

**Files:**
- Modify: `packages/webui/src/components/ChatView.tsx`
- Modify: `packages/webui/src/components/MessageBubble.tsx`

- [ ] **Step 1: Rewrite ChatView using Bubble.List**

```tsx
import { Bubble } from "@ant-design/x";
import type { AgentMessage, ToolCallState } from "../bridge/types.ts";
import { MessageBubble } from "./MessageBubble.tsx";

export interface ChatViewProps {
	messages: AgentMessage[];
	streamingMessage?: AgentMessage;
	toolCalls?: Map<string, ToolCallState>;
}

export function ChatView({ messages, streamingMessage, toolCalls }: ChatViewProps) {
	const allMessages = streamingMessage
		? [...messages, streamingMessage]
		: messages;

	return (
		<Bubble.List
			items={allMessages.map((msg, i) => ({
				key: `${msg.role}-${msg.timestamp ?? i}`,
				content: msg,
				placement: msg.role === "user" ? "end" : "start",
				avatar: msg.role === "user"
					? { icon: "U" }
					: { icon: "AI" },
				loading: i === allMessages.length - 1 && streamingMessage !== undefined,
				messageRender: (content) => (
					<MessageBubble
						message={content as AgentMessage}
						isStreaming={i === allMessages.length - 1 && streamingMessage !== undefined}
						toolCalls={toolCalls}
					/>
				),
			}))}
			style={{ flex: 1, overflow: "auto", padding: 16 }}
		/>
	);
}
```

- [ ] **Step 2: Simplify MessageBubble (content only, no Bubble wrapper)**

```tsx
export function MessageBubble({ message, isStreaming, toolCalls }: MessageBubbleProps) {
	// Return content only, Bubble.List handles the bubble wrapper
	return (
		<div>
			{thinking && <ThinkingBlock content={thinking} />}
			<div>{content}{isStreaming ? "▋" : ""}</div>
			{toolCallCards}
		</div>
	);
}
```

- [ ] **Step 3: Verify and commit**

---

## Task 3: Add ThinkingProcess Component

**Files:**
- Create: `packages/webui/src/components/ThinkingProcess.tsx`

- [ ] **Step 1: Create ThinkingProcess using ThoughtChain**

```tsx
import { ThoughtChain } from "@ant-design/x";
import { BulbOutlined } from "@ant-design/icons";

export interface ThinkingStep {
	id: string;
	title: string;
	content: string;
	status: "pending" | "success" | "error";
}

export interface ThinkingProcessProps {
	steps: ThinkingStep[];
}

export function ThinkingProcess({ steps }: ThinkingProcessProps) {
	if (steps.length === 0) return null;

	return (
		<ThoughtChain
			items={steps.map(step => ({
				key: step.id,
				icon: <BulbOutlined />,
				title: step.title,
				description: step.content,
				status: step.status,
			}))}
			collapsible
			size="small"
			style={{ marginBottom: 8 }}
		/>
	);
}
```

- [ ] **Step 2: Integrate into MessageBubble**

Extract thinking content from `AssistantMessage.content` and render as ThinkingProcess.

- [ ] **Step 3: Verify and commit**

---

## Task 4: Replace SessionList with Conversations

**Files:**
- Modify: `packages/webui/src/app/SessionList.tsx`

- [ ] **Step 1: Rewrite using Conversations component**

```tsx
import { Conversations } from "@ant-design/x";
import { Button, Input, Modal } from "antd";
import {
	DownloadOutlined,
	EditOutlined,
	ForkOutlined,
	PlusOutlined,
	CopyOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import type { RpcCommand } from "../bridge/types.ts";

export interface Session {
	id: string;
	name: string;
	lastMessage: string;
	timestamp: number;
}

export interface SessionListProps {
	sessions: Session[];
	currentSessionId?: string;
	send: (command: RpcCommand) => void;
	onSwitch: (sessionId: string) => void;
}

export function SessionList({ sessions, currentSessionId, send, onSwitch }: SessionListProps) {
	const [renameModalOpen, setRenameModalOpen] = useState(false);
	const [renameTarget, setRenameTarget] = useState<string | null>(null);
	const [newName, setNewName] = useState("");

	const handleMenuClick = (key: string, sessionId: string) => {
		switch (key) {
			case "rename":
				setRenameTarget(sessionId);
				setNewName(sessions.find(s => s.id === sessionId)?.name ?? "");
				setRenameModalOpen(true);
				break;
			case "fork":
				send({ type: "fork", entryId: sessionId });
				break;
			case "clone":
				send({ type: "clone" });
				break;
			case "export":
				send({ type: "export_html" });
				break;
		}
	};

	const handleRename = () => {
		if (renameTarget && newName) {
			send({ type: "set_session_name", name: newName });
			setRenameModalOpen(false);
		}
	};

	return (
		<div>
			<Button
				type="primary"
				icon={<PlusOutlined />}
				block
				onClick={() => send({ type: "new_session" })}
				style={{ marginBottom: 12 }}
			>
				New Session
			</Button>

			<Conversations
				items={sessions.map(s => ({
					key: s.id,
					label: s.name || "Untitled",
					description: s.lastMessage?.slice(0, 50),
				}))}
				activeKey={currentSessionId}
				onActiveChange={onSwitch}
				menu={(item) => ({
					items: [
						{ key: "rename", label: "Rename", icon: <EditOutlined /> },
						{ key: "fork", label: "Fork", icon: <ForkOutlined /> },
						{ key: "clone", label: "Clone", icon: <CopyOutlined /> },
						{ type: "divider" },
						{ key: "export", label: "Export HTML", icon: <DownloadOutlined /> },
					],
					onClick: ({ key }) => handleMenuClick(key, item.key),
				})}
				groupable
			/>

			<Modal
				title="Rename Session"
				open={renameModalOpen}
				onOk={handleRename}
				onCancel={() => setRenameModalOpen(false)}
			>
				<Input
					value={newName}
					onChange={(e) => setNewName(e.target.value)}
					placeholder="Session name"
				/>
			</Modal>
		</div>
	);
}
```

- [ ] **Step 2: Update App.tsx to pass sessions and handlers**

- [ ] **Step 3: Verify and commit**

---

## Task 5: Add Model Dropdown

**Files:**
- Modify: `packages/webui/src/app/ModelConfig.tsx`

- [ ] **Step 1: Add model selector with get_available_models**

```tsx
import { Select, Space, Switch } from "antd";
import { useEffect, useState } from "react";
import type { Model, RpcCommand } from "../bridge/types.ts";

export interface ModelConfigProps {
	send: (command: RpcCommand) => void;
	currentModel?: Model;
	thinkingLevel: string;
	steeringMode: string;
	autoCompaction: boolean;
	autoRetry: boolean;
}

export function ModelConfig({
	send,
	currentModel,
	thinkingLevel,
	steeringMode,
	autoCompaction,
	autoRetry,
}: ModelConfigProps) {
	const [availableModels, setAvailableModels] = useState<Model[]>([]);

	// Fetch models when dropdown opens
	const handleDropdownVisibleChange = (open: boolean) => {
		if (open && availableModels.length === 0) {
			send({ type: "get_available_models" });
		}
	};

	return (
		<Space direction="vertical" style={{ width: "100%" }} size="middle">
			<div>
				<label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Model</label>
				<Select
					style={{ width: "100%" }}
					value={currentModel?.id}
					placeholder="Select model"
					onDropdownVisibleChange={handleDropdownVisibleChange}
					options={availableModels.map(m => ({
						value: m.id,
						label: m.name,
					}))}
					onChange={(value) => {
						const model = availableModels.find(m => m.id === value);
						if (model) {
							send({ type: "set_model", provider: model.provider, modelId: model.id });
						}
					}}
				/>
			</div>
			{/* ... thinking level, steering mode, etc. */}
		</Space>
	);
}
```

- [ ] **Step 2: Handle get_available_models response in App.tsx**

- [ ] **Step 3: Verify and commit**

---

## Task 6: Add Session Stats to StatusBar

**Files:**
- Modify: `packages/webui/src/components/StatusBar.tsx`

- [ ] **Step 1: Add token usage display**

Already implemented in previous commit. Enhance with:
- Session name (editable)
- Message count
- Compact button

- [ ] **Step 2: Add compact button**

```tsx
<Button
	size="small"
	icon={<CompressOutlined />}
	onClick={() => send({ type: "compact" })}
	title="Compact context"
/>
```

- [ ] **Step 3: Verify and commit**

---

## Task 7: Add Bash Terminal

**Files:**
- Create: `packages/webui/src/components/BashTerminal.tsx`

- [ ] **Step 1: Create BashTerminal component**

```tsx
import { Button, Card, Input, Tag } from "antd";
import { TerminalOutlined, StopOutlined } from "@ant-design/icons";
import { useState } from "react";
import { ansiToHtmlString } from "../utils/ansi.ts";
import type { RpcCommand } from "../bridge/types.ts";

export interface BashTerminalProps {
	send: (command: RpcCommand) => void;
	isRunning: boolean;
	output?: string;
	isError?: boolean;
}

export function BashTerminal({ send, isRunning, output, isError }: BashTerminalProps) {
	const [command, setCommand] = useState("");

	const handleRun = () => {
		if (command.trim()) {
			send({ type: "bash", command: command.trim() });
		}
	};

	return (
		<Card
			size="small"
			title={
				<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
					<TerminalOutlined />
					<span>Bash</span>
					{isRunning && <Tag color="blue">Running</Tag>}
				</div>
			}
			extra={
				isRunning ? (
					<Button
						size="small"
						danger
						icon={<StopOutlined />}
						onClick={() => send({ type: "abort_bash" })}
					>
						Stop
					</Button>
				) : null
			}
		>
			<Input.Search
				value={command}
				onChange={(e) => setCommand(e.target.value)}
				placeholder="Enter bash command..."
				onSearch={handleRun}
				disabled={isRunning}
				enterButton="Run"
			/>
			{output && (
				<pre
					style={{
						margin: 8,
						padding: 8,
						background: "#1e1e1e",
						color: "#d4d4d4",
						borderRadius: 4,
						maxHeight: 300,
						overflow: "auto",
						fontSize: 12,
					}}
					dangerouslySetInnerHTML={{ __html: ansiToHtmlString(output) }}
				/>
			)}
		</Card>
	);
}
```

- [ ] **Step 2: Integrate into Sidebar or as a floating panel**

- [ ] **Step 3: Verify and commit**

---

## Task 8: Add Command Palette

**Files:**
- Create: `packages/webui/src/components/CommandPalette.tsx`

- [ ] **Step 1: Create CommandPalette using Prompts**

```tsx
import { Prompts } from "@ant-design/x";
import { useEffect, useState } from "react";
import type { RpcCommand } from "../bridge/types.ts";

interface Command {
	name: string;
	description?: string;
	source: string;
}

export interface CommandPaletteProps {
	visible: boolean;
	commands: Command[];
	onSelect: (command: string) => void;
	onClose: () => void;
	send: (command: RpcCommand) => void;
}

export function CommandPalette({ visible, commands, onSelect, onClose, send }: CommandPaletteProps) {
	useEffect(() => {
		if (visible && commands.length === 0) {
			send({ type: "get_commands" });
		}
	}, [visible, commands.length, send]);

	if (!visible) return null;

	return (
		<Prompts
			items={commands.map(cmd => ({
				key: cmd.name,
				label: `/${cmd.name}`,
				description: cmd.description,
			}))}
			onItemClick={(item) => {
				onSelect(item.key as string);
				onClose();
			}}
			style={{ marginBottom: 8 }}
		/>
	);
}
```

- [ ] **Step 2: Integrate into Composer/Sender**

Detect "/" prefix and show command palette.

- [ ] **Step 3: Verify and commit**

---

## Task 9: Add Session Loading

**Files:**
- Modify: `packages/webui/bridge-server/server.ts`

- [ ] **Step 1: Add list_sessions command handler**

```typescript
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

function scanSessions(baseDir: string): Session[] {
	try {
		const sessions: Session[] = [];
		const dirs = readdirSync(baseDir, { withFileTypes: true });
		for (const dir of dirs) {
			if (dir.isDirectory()) {
				const sessionDir = join(baseDir, dir.name);
				const files = readdirSync(sessionDir).filter(f => f.endsWith(".jsonl"));
				for (const file of files) {
					const filePath = join(sessionDir, file);
					const content = readFileSync(filePath, "utf-8");
					const lines = content.trim().split("\n").filter(Boolean);
					if (lines.length > 0) {
						// Parse first and last message for preview
						sessions.push({
							id: file.replace(".jsonl", ""),
							name: dir.name,
							path: filePath,
							messageCount: lines.length,
							lastMessage: lines[lines.length - 1]?.slice(0, 100),
						});
					}
				}
			}
		}
		return sessions.sort((a, b) => b.messageCount - a.messageCount);
	} catch {
		return [];
	}
}
```

- [ ] **Step 2: Handle list_sessions in frontend**

- [ ] **Step 3: Verify and commit**

---

## Task 10: Wire Everything Together

**Files:**
- Modify: `packages/webui/src/app/App.tsx`
- Modify: `packages/webui/src/app/Sidebar.tsx`

- [ ] **Step 1: Add all new state to App.tsx**

```typescript
interface AppState {
	// ... existing state
	availableModels: Model[];
	commands: Command[];
	bashOutput: string | undefined;
	bashIsRunning: boolean;
	sessions: Session[];
}
```

- [ ] **Step 2: Add all new action handlers**

- [ ] **Step 3: Update Sidebar with all new components**

- [ ] **Step 4: Verify and commit**

---

## Verification Checklist

- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] All tests pass: `npx vitest --run`
- [ ] Biome passes: `npx biome check`
- [ ] Manual test: Send message, see response
- [ ] Manual test: Stop generation works
- [ ] Manual test: Switch sessions works
- [ ] Manual test: Model dropdown works
- [ ] Manual test: Thinking process displays
- [ ] Manual test: Bash terminal works
- [ ] Manual test: Command palette works
