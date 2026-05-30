# Pi WebUI RICH Design Language Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the pi WebUI to follow Ant Design X's RICH design language for a polished AI chat experience.

**Architecture:** Enhance existing components with Ant Design X's advanced features: Bubble typing effects, Sender context display, ThoughtChain for thinking, Welcome screen, and Prompts for suggestions.

**Tech Stack:** React 19, Vite 6, Ant Design X 1.3, Ant Design 5

---

## File Structure

```
packages/webui/src/
├── components/
│   ├── ChatView.tsx           # MODIFY: Use Bubble.List with typing
│   ├── Composer.tsx           # MODIFY: Add header/footer/prefix
│   ├── MessageBubble.tsx      # MODIFY: Add typing effect, messageRender
│   ├── WelcomeScreen.tsx      # CREATE: Welcome component
│   ├── ThinkingProcess.tsx    # CREATE: ThoughtChain wrapper
│   └── SuggestionBar.tsx      # CREATE: Suggestion component
├── app/
│   ├── App.tsx                # MODIFY: Add WelcomeScreen, SuggestionBar
│   └── SessionList.tsx        # MODIFY: Enhanced grouping
```

---

### Task 1: Add Typing Effect to Bubble

**Files:**
- Modify: `packages/webui/src/components/MessageBubble.tsx`

- [ ] **Step 1: Update MessageBubble with typing prop**

```tsx
import { Bubble } from "@ant-design/x";
import { Collapse } from "antd";
import type { AgentMessage, ToolCallState } from "../bridge/types.ts";
import { ToolCallCard } from "./tool-renderers/index.ts";

export interface MessageBubbleProps {
	message: AgentMessage;
	isStreaming?: boolean;
	toolCalls?: Map<string, ToolCallState>;
}

function getThinkingContent(msg: AgentMessage): string | undefined {
	if (typeof msg.content === "string") return undefined;
	if (!Array.isArray(msg.content)) return undefined;

	const thinkingParts = msg.content
		.filter((c) => c.type === "thinking")
		.map((c) => (c as { thinking?: string }).thinking ?? "")
		.filter(Boolean);

	return thinkingParts.length > 0 ? thinkingParts.join("\n") : undefined;
}

function getMessageContent(msg: AgentMessage): string {
	if (typeof msg.content === "string") return msg.content;
	if (!Array.isArray(msg.content)) return JSON.stringify(msg.content);

	return msg.content
		.filter((c) => c.type === "text")
		.map((c) => c.text ?? "")
		.join("\n");
}

export function MessageBubble({ message, isStreaming, toolCalls }: MessageBubbleProps) {
	const placement = message.role === "user" ? "end" : "start";
	const content = getMessageContent(message);
	const thinking = message.role === "assistant" ? getThinkingContent(message) : undefined;

	// For assistant messages, render ToolCallCard for each tool call entry
	const toolCallCards: React.ReactNode[] = [];
	if (message.role === "assistant" && Array.isArray(message.content) && toolCalls) {
		const toolCallStates = Array.from(toolCalls.values());
		let stateIndex = 0;

		for (const entry of message.content) {
			if (entry.type === "toolCall") {
				const tcState = toolCallStates[stateIndex];
				toolCallCards.push(
					<ToolCallCard
						key={entry.arguments ?? stateIndex}
						toolName={tcState?.toolName ?? entry.name ?? "unknown"}
						args={tcState?.args ?? {}}
						status={tcState?.status ?? "pending"}
						result={tcState?.result}
					/>,
				);
				stateIndex++;
			}
		}
	}

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: placement === "end" ? "flex-end" : "flex-start",
				maxWidth: "80%",
			}}
		>
			{thinking && (
				<Collapse
					size="small"
					style={{ marginBottom: 4, width: "100%", background: "#f6f6f6" }}
					items={[
						{
							key: "thinking",
							label: <span style={{ color: "#888", fontSize: 12 }}>💭 Thinking...</span>,
							children: (
								<pre
									style={{
										margin: 0,
										fontSize: 12,
										color: "#666",
										whiteSpace: "pre-wrap",
										wordBreak: "break-word",
										maxHeight: 300,
										overflow: "auto",
									}}
								>
									{thinking}
								</pre>
							),
						},
					]}
				/>
			)}
			<Bubble
				placement={placement}
				content={content}
				avatar={message.role === "user" ? { icon: "U" } : { icon: "AI" }}
				typing={isStreaming ? { step: 2, interval: 50 } : false}
				loading={isStreaming && !content}
				variant="shadow"
				shape="round"
			/>
			{toolCallCards}
		</div>
	);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/webui && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/webui/src/components/MessageBubble.tsx
git commit -m "feat(webui): add typing effect and shadow variant to Bubble"
```

---

### Task 2: Enhance Sender with Header/Footer

**Files:**
- Modify: `packages/webui/src/components/Composer.tsx`

- [ ] **Step 1: Update Composer with header and footer**

```tsx
import { Sender } from "@ant-design/x";
import { Tag } from "antd";
import type { SessionStats } from "../bridge/types.ts";

export interface ComposerProps {
	onSend: (message: string) => void;
	onCancel?: () => void;
	disabled?: boolean;
	loading?: boolean;
	sessionName?: string;
	sessionStats?: SessionStats;
}

export function Composer({ onSend, onCancel, disabled, loading, sessionName, sessionStats }: ComposerProps) {
	return (
		<Sender
			onSubmit={onSend}
			onCancel={onCancel}
			loading={loading}
			disabled={disabled}
			placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
			style={{ margin: 12 }}
			header={
				sessionName ? (
					<div style={{ padding: "4px 12px", borderBottom: "1px solid #f0f0f0", fontSize: 12, color: "#888" }}>
						📁 {sessionName}
						{sessionStats && (
							<Tag style={{ marginLeft: 8 }} color="blue">
								{sessionStats.totalMessages} messages
							</Tag>
						)}
					</div>
				) : undefined
			}
			footer={
				<div style={{ padding: "4px 12px", fontSize: 11, color: "#bbb" }}>
					Press / for commands • Ctrl+Enter to send
				</div>
			}
		/>
	);
}
```

- [ ] **Step 2: Update App.tsx to pass new props**

In `App.tsx`, update the Composer usage:

```tsx
<Composer
	onSend={handleSend}
	onCancel={handleAbort}
	disabled={!connected}
	loading={state.isStreaming}
	sessionName={state.sessionStats?.sessionFile}
	sessionStats={state.sessionStats}
/>
```

- [ ] **Step 3: Verify and commit**

```bash
git add packages/webui/src/components/Composer.tsx packages/webui/src/app/App.tsx
git commit -m "feat(webui): add header/footer to Sender with session context"
```

---

### Task 3: Create WelcomeScreen Component

**Files:**
- Create: `packages/webui/src/components/WelcomeScreen.tsx`

- [ ] **Step 1: Create WelcomeScreen**

```tsx
import { Welcome } from "@ant-design/x";
import { Button, Space } from "antd";
import { RobotOutlined } from "@ant-design/icons";

export interface WelcomeScreenProps {
	onQuickStart: () => void;
	onSelectDirectory: () => void;
}

export function WelcomeScreen({ onQuickStart, onSelectDirectory }: WelcomeScreenProps) {
	return (
		<div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", padding: 48 }}>
			<Welcome
				icon={<RobotOutlined style={{ fontSize: 48 }} />}
				title="Pi AI Assistant"
				description="I can help you with coding, debugging, file operations, and more. Select a project directory to get started."
				variant="borderless"
				extra={
					<Space>
						<Button type="primary" size="large" onClick={onSelectDirectory}>
							Select Project Directory
						</Button>
						<Button size="large" onClick={onQuickStart}>
							Quick Start
						</Button>
					</Space>
				}
			/>
		</div>
	);
}
```

- [ ] **Step 2: Integrate into App.tsx**

Add to App.tsx render:

```tsx
{waitingForDirectory && !currentCwd ? (
	<WelcomeScreen
		onQuickStart={useTempWorkspace}
		onSelectDirectory={() => {/* open directory picker */}}
	/>
) : (
	/* existing layout */
)}
```

- [ ] **Step 3: Verify and commit**

```bash
git add packages/webui/src/components/WelcomeScreen.tsx packages/webui/src/app/App.tsx
git commit -m "feat(webui): add WelcomeScreen for new users"
```

---

### Task 4: Create ThinkingProcess Component

**Files:**
- Create: `packages/webui/src/components/ThinkingProcess.tsx`

- [ ] **Step 1: Create ThinkingProcess with ThoughtChain**

```tsx
import { ThoughtChain } from "@ant-design/x";
import { BulbOutlined, CheckCircleOutlined, LoadingOutlined } from "@ant-design/icons";

export interface ThinkingStep {
	id: string;
	title: string;
	content: string;
	status: "pending" | "success" | "error";
}

export interface ThinkingProcessProps {
	steps: ThinkingStep[];
}

const STATUS_ICONS = {
	pending: <LoadingOutlined />,
	success: <CheckCircleOutlined style={{ color: "#52c41a" }} />,
	error: <BulbOutlined style={{ color: "#ff4d4f" }} />,
};

export function ThinkingProcess({ steps }: ThinkingProcessProps) {
	if (steps.length === 0) return null;

	return (
		<ThoughtChain
			items={steps.map((step) => ({
				key: step.id,
				title: step.title,
				description: step.content,
				icon: STATUS_ICONS[step.status],
				status: step.status,
			}))}
			collapsible
			size="small"
			style={{ marginBottom: 8, padding: 8, background: "#fafafa", borderRadius: 8 }}
		/>
	);
}
```

- [ ] **Step 2: Integrate into MessageBubble**

Replace the Collapse-based thinking display with ThinkingProcess:

```tsx
import { ThinkingProcess } from "./ThinkingProcess.tsx";

// In MessageBubble render:
{thinkingSteps.length > 0 && <ThinkingProcess steps={thinkingSteps} />}
```

- [ ] **Step 3: Verify and commit**

```bash
git add packages/webui/src/components/ThinkingProcess.tsx packages/webui/src/components/MessageBubble.tsx
git commit -m "feat(webui): add ThinkingProcess with ThoughtChain component"
```

---

### Task 5: Create SuggestionBar Component

**Files:**
- Create: `packages/webui/src/components/SuggestionBar.tsx`

- [ ] **Step 1: Create SuggestionBar**

```tsx
import { Prompts } from "@ant-design/icons";
import { BulbOutlined } from "@ant-design/icons";

export interface Suggestion {
	id: string;
	text: string;
	description?: string;
}

export interface SuggestionBarProps {
	suggestions: Suggestion[];
	onSelect: (suggestion: Suggestion) => void;
	visible: boolean;
}

export function SuggestionBar({ suggestions, onSelect, visible }: SuggestionBarProps) {
	if (!visible || suggestions.length === 0) return null;

	return (
		<Prompts
			items={suggestions.map((s) => ({
				key: s.id,
				label: s.text,
				description: s.description,
				icon: <BulbOutlined />,
			}))}
			onItemClick={(info) => {
				const suggestion = suggestions.find((s) => s.id === info.data.key);
				if (suggestion) onSelect(suggestion);
			}}
			style={{ padding: "0 16px", marginBottom: 8 }}
		/>
	);
}
```

- [ ] **Step 2: Add default suggestions**

```tsx
const DEFAULT_SUGGESTIONS: Suggestion[] = [
	{ id: "help", text: "What can you help me with?", description: "Learn about capabilities" },
	{ id: "code", text: "Help me write code", description: "Start a coding task" },
	{ id: "debug", text: "Debug an issue", description: "Troubleshoot a problem" },
	{ id: "explain", text: "Explain this code", description: "Understand existing code" },
];
```

- [ ] **Step 3: Integrate into App.tsx**

```tsx
<SuggestionBar
	suggestions={DEFAULT_SUGGESTIONS}
	onSelect={(s) => handleSend(s.text)}
	visible={state.messages.length === 0 && !state.isStreaming}
/>
```

- [ ] **Step 4: Verify and commit**

```bash
git add packages/webui/src/components/SuggestionBar.tsx packages/webui/src/app/App.tsx
git commit -m "feat(webui): add SuggestionBar with default prompts"
```

---

### Task 6: Enhanced SessionList Grouping

**Files:**
- Modify: `packages/webui/src/app/SessionList.tsx`

- [ ] **Step 1: Add session count and last message preview**

Update the Conversations items to show more context:

```tsx
<Conversations
	items={dirSessions.map((s) => ({
		key: `${s.workDirHash}/${s.sessionId}`,
		label: s.title || s.sessionId.slice(0, 8),
		description: (
			<div>
				<div>{s.turns} messages</div>
				<div style={{ fontSize: 11, color: "#bbb" }}>
					{new Date(s.lastUpdated).toLocaleDateString()}
				</div>
			</div>
		),
	}))}
	// ... rest of props
/>
```

- [ ] **Step 2: Add project summary stats**

```tsx
// In the Collapse label:
<span style={{ marginLeft: "auto", fontSize: 11, color: "#888" }}>
	{dirSessions.reduce((sum, s) => sum + s.turns, 0)} total messages
</span>
```

- [ ] **Step 3: Verify and commit**

```bash
git add packages/webui/src/app/SessionList.tsx
git commit -m "feat(webui): enhance SessionList with message counts and dates"
```

---

### Task 7: Update ChatView with Bubble.List

**Files:**
- Modify: `packages/webui/src/components/ChatView.tsx`

- [ ] **Step 1: Use Bubble.List for better scrolling**

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
				avatar: msg.role === "user" ? { icon: "U" } : { icon: "AI" },
				loading: i === allMessages.length - 1 && streamingMessage !== undefined && !getMessageContent(msg),
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

function getMessageContent(msg: AgentMessage): string {
	if (typeof msg.content === "string") return msg.content;
	if (!Array.isArray(msg.content)) return "";
	return msg.content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
}
```

- [ ] **Step 2: Verify and commit**

```bash
git add packages/webui/src/components/ChatView.tsx
git commit -m "feat(webui): use Bubble.List for better scroll behavior"
```

---

### Task 8: Final Integration and Testing

**Files:**
- Modify: `packages/webui/src/app/App.tsx`

- [ ] **Step 1: Wire all new components together**

Update App.tsx to integrate WelcomeScreen, SuggestionBar, and enhanced Composer:

```tsx
import { WelcomeScreen } from "../components/WelcomeScreen.tsx";
import { SuggestionBar, type Suggestion } from "../components/SuggestionBar.tsx";

const DEFAULT_SUGGESTIONS: Suggestion[] = [
	{ id: "help", text: "What can you help me with?" },
	{ id: "code", text: "Help me write code" },
	{ id: "debug", text: "Debug an issue" },
];

// In render:
{waitingForDirectory && !currentCwd ? (
	<WelcomeScreen
		onQuickStart={useTempWorkspace}
		onSelectDirectory={() => setDirectoryPickerVisible(true)}
	/>
) : (
	<Layout>
		<SuggestionBar
			suggestions={DEFAULT_SUGGESTIONS}
			onSelect={(s) => handleSend(s.text)}
			visible={state.messages.length === 0 && !state.isStreaming}
		/>
		<ChatView ... />
		<Composer
			sessionName={currentCwd ? currentCwd.split(/[/\\]/).pop() : undefined}
			sessionStats={state.sessionStats}
			...
		/>
	</Layout>
)}
```

- [ ] **Step 2: Run all checks**

```bash
cd packages/webui && npx tsc --noEmit && npx vitest --run && npx biome check
```

- [ ] **Step 3: Commit**

```bash
git add -u packages/webui/
git commit -m "feat(webui): complete RICH design language integration"
```

---

## Verification Checklist

- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] All tests pass: `npx vitest --run`
- [ ] Biome passes: `npx biome check`
- [ ] Welcome screen shows for new users
- [ ] Typing effect works on streaming messages
- [ ] Sender shows session context in header
- [ ] Thinking process renders with ThoughtChain
- [ ] Suggestion bar shows when chat is empty
- [ ] Session list shows message counts
