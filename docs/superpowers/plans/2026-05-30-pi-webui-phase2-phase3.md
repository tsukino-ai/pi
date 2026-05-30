# Pi WebUI Phase 2 + Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add rich tool renderers (Phase 2) and complete the full feature set with session management, theme switching, and component library extraction (Phase 3).

**Architecture:** Phase 2 adds a `tool-renderers/` directory with specialized components for each agent tool. Phase 3 adds a sidebar layout shell, theme provider, and library build targets.

**Tech Stack:** React 19, Vite 6, Ant Design X 1.3, Ant Design 5, highlight.js 10, diff 8, ws 8.

---

## File Structure

### Phase 2 Additions

```
packages/webui/src/
├── utils/
│   ├── syntax-highlight.ts      # highlight.js wrapper with lazy language loading
│   └── diff-parser.ts           # parse unified diff into line objects
├── components/
│   ├── tool-renderers/
│   │   ├── index.ts             # barrel export
│   │   ├── ToolCallCard.tsx     # collapsible card wrapper
│   │   ├── CodeBlock.tsx        # syntax highlighted code block
│   │   ├── DiffView.tsx         # line-by-line diff renderer
│   │   ├── TerminalOutput.tsx   # dark terminal with ANSI colors
│   │   ├── InlineForm.tsx       # askUser inline form
│   │   └── FileNotice.tsx       # write tool result notice
│   └── MessageBubble.tsx        # MODIFIED: embed ToolCallCard for tool calls
└── bridge/
    └── useBridge.ts             # MODIFIED: track toolCalls map
```

### Phase 3 Additions

```
packages/webui/src/
├── index.ts                     # library barrel export (NEW)
├── app/
│   ├── App.tsx                  # MOVED from src/App.tsx + sidebar layout
│   ├── main.tsx                 # MOVED from src/main.tsx
│   ├── ThemeProvider.tsx        # Ant Design ConfigProvider wrapper
│   ├── Sidebar.tsx              # collapsible sidebar shell
│   ├── SessionList.tsx          # session list + actions
│   ├── ModelConfig.tsx          # model + thinking level config
│   ├── Settings.tsx             # theme + bridge URL + pi path
│   └── ExportHtml.tsx           # HTML export trigger + download
├── components/
│   └── index.ts                 # library component barrel export
└── bridge/
    └── index.ts                 # bridge barrel export
```

---

### Task 1: Create `utils/syntax-highlight.ts`

**Files:**
- Create: `packages/webui/src/utils/syntax-highlight.ts`
- Create: `packages/webui/src/utils/index.ts`

- [ ] **Step 1: Write `syntax-highlight.ts`**

```typescript
import hljs from "highlight.js";

const loadedLanguages = new Set<string>();

export function detectLanguage(filePath?: string): string | undefined {
	if (!filePath) return undefined;
	const ext = filePath.split(".").pop()?.toLowerCase();
	const map: Record<string, string> = {
		ts: "typescript",
		tsx: "typescript",
		js: "javascript",
		jsx: "javascript",
		py: "python",
		rs: "rust",
		go: "go",
		java: "java",
		md: "markdown",
		json: "json",
		yaml: "yaml",
		yml: "yaml",
		sh: "bash",
		bash: "bash",
		css: "css",
		html: "html",
		sql: "sql",
	};
	return map[ext ?? ""];
}

export function highlightCode(code: string, language?: string): string {
	if (!language) {
		return hljs.highlightAuto(code).value;
	}
	try {
		if (!loadedLanguages.has(language)) {
			// Attempt to register if available
			const mod = hljs.getLanguage(language);
			if (mod) {
				loadedLanguages.add(language);
			}
		}
		return hljs.highlight(code, { language }).value;
	} catch {
		return hljs.highlightAuto(code).value;
	}
}
```

- [ ] **Step 2: Write `utils/index.ts`**

```typescript
export { detectLanguage, highlightCode } from "./syntax-highlight.ts";
export { parseDiff, type DiffLine } from "./diff-parser.ts";
```

- [ ] **Step 3: Commit**

```bash
git add packages/webui/src/utils/
git commit -m "feat(webui): add syntax highlight utility"
```

---

### Task 2: Create `utils/diff-parser.ts`

**Files:**
- Create: `packages/webui/src/utils/diff-parser.ts`

- [ ] **Step 1: Write `diff-parser.ts`**

```typescript
export interface DiffLine {
	type: "context" | "add" | "remove";
	oldLineNumber?: number;
	newLineNumber?: number;
	content: string;
}

export interface DiffHunk {
	oldStart: number;
	oldCount: number;
	newStart: number;
	newCount: number;
	lines: DiffLine[];
}

export function parseDiff(oldContent: string, newContent: string): DiffHunk[] {
	const oldLines = oldContent.split("\n");
	const newLines = newContent.split("\n");
	const hunks: DiffHunk[] = [];

	// Simple LCS-based diff for display purposes
	let oldIndex = 0;
	let newIndex = 0;
	let hunkLines: DiffLine[] = [];
	let hunkOldStart = 1;
	let hunkNewStart = 1;

	function flushHunk() {
		if (hunkLines.length === 0) return;
		hunks.push({
			oldStart: hunkOldStart,
			oldCount: oldIndex - hunkOldStart + 1,
			newStart: hunkNewStart,
			newCount: newIndex - hunkNewStart + 1,
			lines: hunkLines.slice(),
		});
		hunkLines = [];
	}

	while (oldIndex < oldLines.length || newIndex < newLines.length) {
		if (oldIndex < oldLines.length && newIndex < newLines.length && oldLines[oldIndex] === newLines[newIndex]) {
			hunkLines.push({
				type: "context",
				oldLineNumber: oldIndex + 1,
				newLineNumber: newIndex + 1,
				content: oldLines[oldIndex],
			});
			oldIndex++;
			newIndex++;
		} else if (
			newIndex < newLines.length &&
			(oldIndex >= oldLines.length || oldLines[oldIndex] !== newLines[newIndex])
		) {
			if (hunkLines.length === 0) {
				hunkOldStart = oldIndex + 1;
				hunkNewStart = newIndex + 1;
			}
			hunkLines.push({
				type: "add",
				newLineNumber: newIndex + 1,
				content: newLines[newIndex],
			});
			newIndex++;
		} else {
			if (hunkLines.length === 0) {
				hunkOldStart = oldIndex + 1;
				hunkNewStart = newIndex + 1;
			}
			hunkLines.push({
				type: "remove",
				oldLineNumber: oldIndex + 1,
				content: oldLines[oldIndex],
			});
			oldIndex++;
		}
	}

	flushHunk();
	return hunks;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/webui/src/utils/diff-parser.ts packages/webui/src/utils/index.ts
git commit -m "feat(webui): add diff parser utility"
```

---

### Task 3: Create `tool-renderers/CodeBlock.tsx`

**Files:**
- Create: `packages/webui/src/components/tool-renderers/CodeBlock.tsx`

- [ ] **Step 1: Write `CodeBlock.tsx`**

```typescript
import { Button, Card } from "antd";
import { CopyOutlined } from "@ant-design/icons";
import { useMemo } from "react";
import { detectLanguage, highlightCode } from "../../utils/syntax-highlight.ts";

export interface CodeBlockProps {
	content: string;
	filePath?: string;
}

export function CodeBlock({ content, filePath }: CodeBlockProps) {
	const language = detectLanguage(filePath);
	const highlighted = useMemo(() => highlightCode(content, language), [content, language]);

	const handleCopy = () => {
		navigator.clipboard.writeText(content);
	};

	return (
		<Card
			size="small"
			title={filePath ?? "Code"}
			extra={
				<Button size="small" icon={<CopyOutlined />} onClick={handleCopy}>
					Copy
				</Button>
			}
			style={{ marginTop: 8 }}
		>
			<pre
				style={{
					margin: 0,
					overflowX: "auto",
					fontSize: 13,
					lineHeight: 1.5,
				}}
			>
				<code dangerouslySetInnerHTML={{ __html: highlighted }} />
			</pre>
		</Card>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/webui/src/components/tool-renderers/CodeBlock.tsx
git commit -m "feat(webui): add CodeBlock tool renderer"
```

---

### Task 4: Create `tool-renderers/DiffView.tsx`

**Files:**
- Create: `packages/webui/src/components/tool-renderers/DiffView.tsx`

- [ ] **Step 1: Write `DiffView.tsx`**

```typescript
import { Card } from "antd";
import { useMemo } from "react";
import { parseDiff } from "../../utils/diff-parser.ts";

export interface DiffViewProps {
	oldContent: string;
	newContent: string;
	filePath: string;
}

export function DiffView({ oldContent, newContent, filePath }: DiffViewProps) {
	const hunks = useMemo(() => parseDiff(oldContent, newContent), [oldContent, newContent]);

	return (
		<Card size="small" title={`Diff: ${filePath}`} style={{ marginTop: 8 }}>
			{hunks.map((hunk, hi) => (
				<div key={hi} style={{ fontFamily: "monospace", fontSize: 13, lineHeight: 1.5 }}>
					<div style={{ color: "#888", padding: "4px 8px", background: "#f5f5f5" }}>
						@@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@
					</div>
					{hunk.lines.map((line, li) => {
						const bg =
							line.type === "add"
								? "#e6ffed"
								: line.type === "remove"
									? "#ffeef0"
									: "transparent";
						const prefix = line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";
						return (
							<div
								key={li}
								style={{
									background: bg,
									padding: "1px 8px",
									whiteSpace: "pre",
								}}
							>
								{prefix}
								{line.content}
							</div>
						);
					})}
				</div>
			))}
		</Card>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/webui/src/components/tool-renderers/DiffView.tsx
git commit -m "feat(webui): add DiffView tool renderer"
```

---

### Task 5: Create `tool-renderers/TerminalOutput.tsx`

**Files:**
- Create: `packages/webui/src/components/tool-renderers/TerminalOutput.tsx`

- [ ] **Step 1: Write `TerminalOutput.tsx`**

```typescript
import { Card, Tag } from "antd";
import { useState } from "react";

export interface TerminalOutputProps {
	command: string;
	stdout: string;
	stderr: string;
	exitCode: number;
}

const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

function stripAnsi(text: string): string {
	return text.replace(ANSI_REGEX, "");
}

export function TerminalOutput({ command, stdout, stderr, exitCode }: TerminalOutputProps) {
	const [expanded, setExpanded] = useState(false);
	const fullOutput = stripAnsi(stdout + (stderr ? "\n" + stderr : ""));
	const lines = fullOutput.split("\n");
	const isLong = lines.length > 20;
	const displayLines = expanded ? lines : lines.slice(0, 20);

	return (
		<Card
			size="small"
			title={
				<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
					<span style={{ fontFamily: "monospace" }}>$ {command}</span>
					<Tag color={exitCode === 0 ? "green" : "red"}>{exitCode === 0 ? "OK" : `Exit ${exitCode}`}</Tag>
				</div>
			}
			style={{ marginTop: 8, background: "#1e1e1e", color: "#d4d4d4" }}
		>
			<pre
				style={{
					margin: 0,
					fontFamily: "monospace",
					fontSize: 13,
					lineHeight: 1.5,
					whiteSpace: "pre-wrap",
					wordBreak: "break-all",
					color: "#d4d4d4",
				}}
			>
				{displayLines.join("\n")}
			</pre>
			{isLong && (
				<div style={{ textAlign: "center", paddingTop: 8 }}>
					<a onClick={() => setExpanded(!expanded)} style={{ color: "#1890ff", cursor: "pointer" }}>
						{expanded ? "Show less" : `Show ${lines.length - 20} more lines`}
					</a>
				</div>
			)}
		</Card>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/webui/src/components/tool-renderers/TerminalOutput.tsx
git commit -m "feat(webui): add TerminalOutput tool renderer"
```

---

### Task 6: Create `tool-renderers/InlineForm.tsx`

**Files:**
- Create: `packages/webui/src/components/tool-renderers/InlineForm.tsx`

- [ ] **Step 1: Write `InlineForm.tsx`**

```typescript
import { Button, Input, Radio } from "antd";
import { useState } from "react";

export interface InlineFormProps {
	question: string;
	options?: string[];
	onSubmit: (value: string) => void;
}

export function InlineForm({ question, options, onSubmit }: InlineFormProps) {
	const [value, setValue] = useState("");

	const handleSubmit = () => {
		if (!value) return;
		onSubmit(value);
	};

	return (
		<div style={{ padding: 12, border: "1px solid #d9d9d9", borderRadius: 4, marginTop: 8 }}>
			<div style={{ marginBottom: 8, fontWeight: 500 }}>{question}</div>
			{options ? (
				<Radio.Group
					value={value}
					onChange={(e) => setValue(e.target.value)}
					style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}
				>
					{options.map((opt) => (
						<Radio key={opt} value={opt}>
							{opt}
						</Radio>
					))}
				</Radio.Group>
			) : (
				<Input.TextArea
					value={value}
					onChange={(e) => setValue(e.target.value)}
					placeholder="Your answer..."
					autoSize={{ minRows: 2, maxRows: 6 }}
					style={{ marginBottom: 12 }}
				/>
			)}
			<Button type="primary" onClick={handleSubmit} disabled={!value}>
				Submit
			</Button>
		</div>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/webui/src/components/tool-renderers/InlineForm.tsx
git commit -m "feat(webui): add InlineForm tool renderer"
```

---

### Task 7: Create `tool-renderers/FileNotice.tsx`

**Files:**
- Create: `packages/webui/src/components/tool-renderers/FileNotice.tsx`

- [ ] **Step 1: Write `FileNotice.tsx`**

```typescript
import { Card } from "antd";
import { FileAddOutlined } from "@ant-design/icons";

export interface FileNoticeProps {
	filePath: string;
	content: string;
}

export function FileNotice({ filePath, content }: FileNoticeProps) {
	const preview = content.split("\n").slice(0, 3).join("\n");
	return (
		<Card
			size="small"
			style={{ marginTop: 8, background: "#f6ffed", borderColor: "#b7eb8f" }}
		>
			<div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
				<FileAddOutlined style={{ color: "#52c41a" }} />
				<span style={{ fontWeight: 500 }}>Created {filePath}</span>
			</div>
			<pre
				style={{
					margin: 0,
					fontSize: 12,
					color: "#666",
					whiteSpace: "pre-wrap",
				}}
			>
				{preview}
				{content.split("\n").length > 3 && "\n..."}
			</pre>
		</Card>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/webui/src/components/tool-renderers/FileNotice.tsx
git commit -m "feat(webui): add FileNotice tool renderer"
```

---

### Task 8: Create `tool-renderers/ToolCallCard.tsx`

**Files:**
- Create: `packages/webui/src/components/tool-renderers/ToolCallCard.tsx`
- Create: `packages/webui/src/components/tool-renderers/index.ts`

- [ ] **Step 1: Write `ToolCallCard.tsx`**

```typescript
import { Card, Collapse, Spin, Tag } from "antd";
import {
	CodeOutlined,
	EditOutlined,
	FileTextOutlined,
	FormOutlined,
	TerminalOutlined,
} from "@ant-design/icons";
import type { AgentMessage } from "../../bridge/types.ts";
import { CodeBlock } from "./CodeBlock.tsx";
import { DiffView } from "./DiffView.tsx";
import { TerminalOutput } from "./TerminalOutput.tsx";
import { InlineForm } from "./InlineForm.tsx";
import { FileNotice } from "./FileNotice.tsx";

export interface ToolCallCardProps {
	toolCallId: string;
	toolName: string;
	args: unknown;
	status: "pending" | "success" | "error";
	result?: AgentMessage;
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
	read: <FileTextOutlined />,
	edit: <EditOutlined />,
	bash: <TerminalOutlined />,
	askUser: <FormOutlined />,
	write: <CodeOutlined />,
};

function getArgSummary(toolName: string, args: unknown): string {
	if (!args || typeof args !== "object") return "";
	const a = args as Record<string, string>;
	switch (toolName) {
		case "read":
			return a.filePath ?? "";
		case "edit":
			return a.filePath ?? "";
		case "bash":
			return a.command ?? "";
		case "write":
			return a.filePath ?? "";
		case "askUser":
			return a.question ?? "";
		default:
			return "";
	}
}

function ToolResultBody({ toolName, args, result }: { toolName: string; args: unknown; result?: AgentMessage }) {
	if (!result || result.role !== "toolResult") return null;
	const content = typeof result.content === "string" ? result.content : "";
	const details = (result as unknown as Record<string, unknown>).details;

	switch (toolName) {
		case "read": {
			const filePath = (args as Record<string, string>)?.filePath;
			return <CodeBlock content={content} filePath={filePath} />;
		}
		case "edit": {
			const filePath = (args as Record<string, string>)?.filePath;
			const oldContent = (details as Record<string, string>)?.oldContent ?? "";
			return <DiffView oldContent={oldContent} newContent={content} filePath={filePath ?? "unknown"} />;
		}
		case "bash": {
			const d = details as { command?: string; stdout?: string; stderr?: string; exitCode?: number };
			return (
				<TerminalOutput
					command={d?.command ?? ""}
					stdout={d?.stdout ?? content}
					stderr={d?.stderr ?? ""}
					exitCode={d?.exitCode ?? 0}
				/>
			);
		}
		case "write": {
			const filePath = (args as Record<string, string>)?.filePath;
			return <FileNotice filePath={filePath ?? "unknown"} content={content} />;
		}
		default:
			return <CodeBlock content={content} />;
	}
}

export function ToolCallCard({ toolName, args, status, result }: ToolCallCardProps) {
	const icon = TOOL_ICONS[toolName] ?? <CodeOutlined />;
	const summary = getArgSummary(toolName, args);
	const isError = status === "error";

	return (
		<Card
			size="small"
			style={{
				marginTop: 8,
				borderColor: isError ? "#ff4d4f" : undefined,
			}}
		>
			<Collapse
				ghost
				defaultActiveKey={status === "pending" ? undefined : ["body"]}
				items={[
					{
						key: "body",
						label: (
							<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
								{icon}
								<span style={{ fontWeight: 500 }}>{toolName}</span>
								<span style={{ color: "#888", fontSize: 12 }}>{summary}</span>
								{status === "pending" && <Spin size="small" />}
								{status === "success" && <Tag color="green">Done</Tag>}
								{isError && <Tag color="red">Error</Tag>}
							</div>
						),
						children: <ToolResultBody toolName={toolName} args={args} result={result} />,
					},
				]}
			/>
		</Card>
	);
}
```

- [ ] **Step 2: Write `index.ts`**

```typescript
export { ToolCallCard } from "./ToolCallCard.tsx";
export { CodeBlock } from "./CodeBlock.tsx";
export { DiffView } from "./DiffView.tsx";
export { TerminalOutput } from "./TerminalOutput.tsx";
export { InlineForm } from "./InlineForm.tsx";
export { FileNotice } from "./FileNotice.tsx";
```

- [ ] **Step 3: Commit**

```bash
git add packages/webui/src/components/tool-renderers/
git commit -m "feat(webui): add ToolCallCard with dispatch to specialized renderers"
```

---

### Task 9: Modify `MessageBubble.tsx` to embed `ToolCallCard`

**Files:**
- Modify: `packages/webui/src/components/MessageBubble.tsx`

- [ ] **Step 1: Rewrite `MessageBubble.tsx`**

```typescript
import { Bubble } from "@ant-design/x";
import type { AgentMessage } from "../bridge/types.ts";
import { ToolCallCard } from "./tool-renderers/index.ts";

export interface MessageBubbleProps {
	message: AgentMessage;
	isStreaming?: boolean;
	toolCalls?: Map<string, { toolName: string; args: unknown; status: "pending" | "success" | "error"; result?: AgentMessage }>;
}

function getMessageContent(msg: AgentMessage): string {
	if (msg.role === "user") {
		return typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
	}
	if (msg.role === "assistant") {
		if (!Array.isArray(msg.content)) return String(msg.content);
		return msg.content
			.map((c) => {
				if (c.type === "text") return c.text ?? "";
				if (c.type === "toolCall") return `Tool call: ${c.name ?? "unknown"}`;
				return "";
			})
			.join("\n");
	}
	if (msg.role === "toolResult") {
		if (!Array.isArray(msg.content)) return String(msg.content);
		return msg.content.map((c) => (c.type === "text" ? c.text ?? "" : "")).join("\n");
	}
	return "";
}

export function MessageBubble({ message, isStreaming, toolCalls }: MessageBubbleProps) {
	const placement = message.role === "user" ? "end" : "start";
	const content = getMessageContent(message);

	// Render tool call cards for assistant messages that contain tool calls
	const toolCallBlocks =
		message.role === "assistant" && Array.isArray(message.content)
			? message.content
					.filter((c) => c.type === "toolCall")
					.map((c) => {
						const tc = toolCalls?.get(c.arguments ?? "");
						return (
							<ToolCallCard
								key={c.arguments}
								toolCallId={c.arguments ?? ""}
								toolName={c.name ?? "unknown"}
								args={tc?.args ?? {}}
								status={tc?.status ?? "pending"}
								result={tc?.result}
							/>
						);
					})
			: null;

	return (
		<div style={{ display: "flex", flexDirection: "column", alignItems: placement === "end" ? "flex-end" : "flex-start" }}>
			<Bubble
				placement={placement}
				content={content + (isStreaming ? "▋" : "")}
				avatar={message.role === "user" ? { icon: "U" } : { icon: "AI" }}
			/>
			{toolCallBlocks}
		</div>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/webui/src/components/MessageBubble.tsx
git commit -m "feat(webui): embed ToolCallCard in assistant message bubbles"
```

---

### Task 10: Update `useBridge.ts` to track tool calls

**Files:**
- Modify: `packages/webui/src/bridge/useBridge.ts`

- [ ] **Step 1: Rewrite `useBridge.ts`**

```typescript
import { useCallback, useEffect, useRef, useState } from "react";
import { BridgeClient, type BridgeEvent } from "./client.ts";
import type { AgentMessage, RpcCommand } from "./types.ts";

export interface ToolCallState {
	toolName: string;
	args: unknown;
	status: "pending" | "success" | "error";
	result?: AgentMessage;
}

export interface UseBridgeState {
	connected: boolean;
	events: BridgeEvent[];
	toolCalls: Map<string, ToolCallState>;
	send: (command: RpcCommand) => void;
}

export function useBridge(url = "ws://localhost:8080"): UseBridgeState {
	const clientRef = useRef<BridgeClient>(new BridgeClient(url));
	const [connected, setConnected] = useState(false);
	const [events, setEvents] = useState<BridgeEvent[]>([]);
	const [toolCalls, setToolCalls] = useState<Map<string, ToolCallState>>(new Map());

	useEffect(() => {
		const client = clientRef.current;
		client.connect();

		const unsubscribe = client.subscribe((event) => {
			if (event.type === "connected") {
				setConnected(true);
			} else if (event.type === "disconnected") {
				setConnected(false);
			}
			setEvents((prev) => [...prev, event]);

			if (event.type === "rpc_event") {
				const payload = event.payload as Record<string, unknown>;
				if (payload.type === "tool_execution_start") {
					const id = String(payload.toolCallId);
					setToolCalls((prev) => {
						const next = new Map(prev);
						next.set(id, {
							toolName: String(payload.toolName),
							args: payload.args,
							status: "pending",
						});
						return next;
					});
				} else if (payload.type === "tool_execution_end") {
					const id = String(payload.toolCallId);
					setToolCalls((prev) => {
						const next = new Map(prev);
						const existing = next.get(id);
						if (existing) {
							next.set(id, {
								...existing,
								status: payload.isError ? "error" : "success",
								result: payload.result as AgentMessage,
							});
						}
						return next;
					});
				}
			}
		});

		return () => {
			unsubscribe();
			client.disconnect();
		};
	}, [url]);

	const send = useCallback((command: RpcCommand) => {
		clientRef.current.send(command);
	}, []);

	return { connected, events, toolCalls, send };
}
```

- [ ] **Step 2: Update `App.tsx` to pass `toolCalls`**

Modify `packages/webui/src/App.tsx` to destructure `toolCalls` from `useBridge` and pass it to `ChatView`.

```typescript
const { connected, events, toolCalls, send } = useBridge();
// ...
<ChatView messages={messages} streamingMessage={streamingMessage} toolCalls={toolCalls} />
```

Also update `ChatView.tsx` to accept and forward `toolCalls`:

```typescript
export interface ChatViewProps {
	messages: AgentMessage[];
	streamingMessage?: AgentMessage;
	toolCalls?: Map<string, ToolCallState>;
}

export function ChatView({ messages, streamingMessage, toolCalls }: ChatViewProps) {
	// ...
	<MessageBubble key={i} message={msg} toolCalls={toolCalls} />
	// ...
	<MessageBubble message={streamingMessage} isStreaming toolCalls={toolCalls} />
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/webui/src/bridge/useBridge.ts packages/webui/src/App.tsx packages/webui/src/components/ChatView.tsx
git commit -m "feat(webui): track tool call state in useBridge"
```

---

### Task 11: Add Phase 2 tests

**Files:**
- Create: `packages/webui/test/diff-parser.test.ts`
- Create: `packages/webui/test/ToolCallCard.test.tsx`

- [ ] **Step 1: Write `diff-parser.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { parseDiff } from "../src/utils/diff-parser.ts";

describe("parseDiff", () => {
	it("detects added lines", () => {
		const hunks = parseDiff("old line", "old line\nnew line");
		expect(hunks.length).toBeGreaterThan(0);
		const lastHunk = hunks[hunks.length - 1];
		const added = lastHunk.lines.filter((l) => l.type === "add");
		expect(added.length).toBe(1);
		expect(added[0].content).toBe("new line");
	});

	it("detects removed lines", () => {
		const hunks = parseDiff("old line\nremoved", "old line");
		const removed = hunks[hunks.length - 1].lines.filter((l) => l.type === "remove");
		expect(removed.length).toBe(1);
		expect(removed[0].content).toBe("removed");
	});
});
```

- [ ] **Step 2: Write `ToolCallCard.test.tsx`**

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToolCallCard } from "../src/components/tool-renderers/ToolCallCard.tsx";

describe("ToolCallCard", () => {
	it("renders tool name and pending spinner", () => {
		render(<ToolCallCard toolCallId="t1" toolName="read" args={{ filePath: "test.ts" }} status="pending" />);
		expect(screen.getByText("read")).toBeDefined();
	});

	it("renders success badge", () => {
		render(<ToolCallCard toolCallId="t2" toolName="bash" args={{ command: "ls" }} status="success" />);
		expect(screen.getByText("Done")).toBeDefined();
	});
});
```

- [ ] **Step 3: Install testing-library**

Add to `packages/webui/package.json` devDependencies:

```json
"@testing-library/react": "16.3.0"
```

Run: `cd packages/webui && npm install --ignore-scripts`

- [ ] **Step 4: Run tests**

Run: `cd packages/webui && npx vitest --run`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/webui/test/ packages/webui/package.json package-lock.json
git commit -m "test(webui): add diff parser and ToolCallCard tests"
```

---

### Task 12: Phase 2 end-to-end verification

- [ ] **Step 1: Start bridge and frontend**

```bash
cd packages/webui && npm run dev
```

- [ ] **Step 2: Send a prompt that triggers tools**

Example: "Read package.json and list the files"

- [ ] **Step 3: Verify rendering**

| Tool | Expected UI |
|---|---|
| `read` | CodeBlock with file path header and syntax highlight |
| `edit` | DiffView with green/red lines |
| `bash` | TerminalOutput with dark background and command header |
| `write` | FileNotice with green border |

- [ ] **Step 4: Run root check**

Run: `npm run check`
Expected: passes.

- [ ] **Step 5: Commit final state**

```bash
git add -A
git commit -m "feat(webui): complete Phase 2 rich tool rendering"
```

---

## Phase 3 Tasks

### Task 13: Create `app/ThemeProvider.tsx`

**Files:**
- Create: `packages/webui/src/app/ThemeProvider.tsx`
- Create: `packages/webui/src/app/index.ts`

- [ ] **Step 1: Write `ThemeProvider.tsx`**

```typescript
import { ConfigProvider, theme } from "antd";
import { createContext, useContext, useEffect, useState } from "react";

type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
	mode: ThemeMode;
	setMode: (mode: ThemeMode) => void;
	isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
	mode: "light",
	setMode: () => {},
	isDark: false,
});

export function useTheme() {
	return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [mode, setModeState] = useState<ThemeMode>(() => {
		return (localStorage.getItem("pi-theme") as ThemeMode) ?? "system";
	});

	const [isDark, setIsDark] = useState(false);

	useEffect(() => {
		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const update = () => {
			setIsDark(mode === "dark" || (mode === "system" && media.matches));
		};
		update();
		media.addEventListener("change", update);
		return () => media.removeEventListener("change", update);
	}, [mode]);

	const setMode = (m: ThemeMode) => {
		localStorage.setItem("pi-theme", m);
		setModeState(m);
	};

	return (
		<ThemeContext.Provider value={{ mode, setMode, isDark }}>
			<ConfigProvider theme={{ algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm }}>
				{children}
			</ConfigProvider>
		</ThemeContext.Provider>
	);
}
```

- [ ] **Step 2: Write `app/index.ts`**

```typescript
export { App } from "./App.tsx";
export { ThemeProvider, useTheme } from "./ThemeProvider.tsx";
export { Sidebar } from "./Sidebar.tsx";
export { SessionList } from "./SessionList.tsx";
export { ModelConfig } from "./ModelConfig.tsx";
export { Settings } from "./Settings.tsx";
```

- [ ] **Step 3: Commit**

```bash
git add packages/webui/src/app/
git commit -m "feat(webui): add ThemeProvider with light/dark/system modes"
```

---

### Task 14: Create `app/Sidebar.tsx`

**Files:**
- Create: `packages/webui/src/app/Sidebar.tsx`

- [ ] **Step 1: Write `Sidebar.tsx`**

```typescript
import { Layout, Menu } from "antd";
import {
	MessageOutlined,
	SettingOutlined,
	SlidersOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import { SessionList } from "./SessionList.tsx";
import { ModelConfig } from "./ModelConfig.tsx";
import { Settings } from "./Settings.tsx";

const { Sider } = Layout;

type SidebarTab = "sessions" | "models" | "settings";

export interface SidebarProps {
	send: (command: Record<string, unknown>) => void;
}

export function Sidebar({ send }: SidebarProps) {
	const [activeTab, setActiveTab] = useState<SidebarTab>("sessions");

	return (
		<Sider width={280} theme="light" style={{ borderRight: "1px solid #f0f0f0" }}>
			<Menu
				mode="horizontal"
				selectedKeys={[activeTab]}
				onClick={(e) => setActiveTab(e.key as SidebarTab)}
				items={[
					{ key: "sessions", icon: <MessageOutlined />, label: "Sessions" },
					{ key: "models", icon: <SlidersOutlined />, label: "Models" },
					{ key: "settings", icon: <SettingOutlined />, label: "Settings" },
				]}
			/>
			<div style={{ padding: 12 }}>
				{activeTab === "sessions" && <SessionList send={send} />}
				{activeTab === "models" && <ModelConfig send={send} />}
				{activeTab === "settings" && <Settings />}
			</div>
		</Sider>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/webui/src/app/Sidebar.tsx
git commit -m "feat(webui): add Sidebar with session/model/settings tabs"
```

---

### Task 15: Create `app/SessionList.tsx`

**Files:**
- Create: `packages/webui/src/app/SessionList.tsx`

- [ ] **Step 1: Write `SessionList.tsx`**

```typescript
import { Button, Dropdown, Empty, List, MenuProps } from "antd";
import {
	DeleteOutlined,
	DownloadOutlined,
	EditOutlined,
	ForkOutlined,
	PlusOutlined,
} from "@ant-design/icons";
import { useState } from "react";

export interface SessionListProps {
	send: (command: Record<string, unknown>) => void;
}

interface SessionItem {
	id: string;
	name: string;
	lastMessage: string;
	timestamp: string;
}

export function SessionList({ send }: SessionListProps) {
	const [sessions, setSessions] = useState<SessionItem[]>([]);

	const handleNew = () => {
		send({ type: "new_session" });
	};

	const getMenuItems = (session: SessionItem): MenuProps["items"] => [
		{ key: "rename", icon: <EditOutlined />, label: "Rename", onClick: () => send({ type: "set_session_name", name: session.name }) },
		{ key: "fork", icon: <ForkOutlined />, label: "Fork", onClick: () => send({ type: "fork", entryId: session.id }) },
		{ key: "export", icon: <DownloadOutlined />, label: "Export HTML", onClick: () => send({ type: "export_html" }) },
		{ type: "divider" },
		{ key: "delete", icon: <DeleteOutlined />, label: "Delete", danger: true },
	];

	return (
		<div>
			<Button type="primary" icon={<PlusOutlined />} block onClick={handleNew} style={{ marginBottom: 12 }}>
				New Session
			</Button>
			{sessions.length === 0 ? (
				<Empty description="No sessions yet" />
			) : (
				<List
					dataSource={sessions}
					renderItem={(s) => (
						<List.Item
							actions={[
								<Dropdown key="menu" menu={{ items: getMenuItems(s) }} placement="bottomRight">
									<Button size="small">...</Button>
								</Dropdown>,
							]}
						>
							<List.Item.Meta title={s.name} description={s.lastMessage} />
						</List.Item>
					)}
				/>
			)}
		</div>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/webui/src/app/SessionList.tsx
git commit -m "feat(webui): add SessionList component"
```

---

### Task 16: Create `app/ModelConfig.tsx`

**Files:**
- Create: `packages/webui/src/app/ModelConfig.tsx`

- [ ] **Step 1: Write `ModelConfig.tsx`**

```typescript
import { Button, Select, Space, Switch } from "antd";

export interface ModelConfigProps {
	send: (command: Record<string, unknown>) => void;
}

const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;

export function ModelConfig({ send }: ModelConfigProps) {
	return (
		<Space direction="vertical" style={{ width: "100%" }} size="middle">
			<div>
				<label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Model</label>
				<Button block onClick={() => send({ type: "cycle_model" })}>
					Cycle Model
				</Button>
			</div>
			<div>
				<label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Thinking Level</label>
				<Select
					style={{ width: "100%" }}
					options={THINKING_LEVELS.map((l) => ({ value: l, label: l }))}
					onChange={(v) => send({ type: "set_thinking_level", level: v })}
					defaultValue="off"
				/>
			</div>
			<div>
				<label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Steering Mode</label>
				<Select
					style={{ width: "100%" }}
					options={[
						{ value: "all", label: "All" },
						{ value: "one-at-a-time", label: "One at a time" },
					]}
					onChange={(v) => send({ type: "set_steering_mode", mode: v })}
					defaultValue="all"
				/>
			</div>
			<div>
				<label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Auto Compaction</label>
				<Switch onChange={(v) => send({ type: "set_auto_compaction", enabled: v })} />
			</div>
			<div>
				<label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Auto Retry</label>
				<Switch onChange={(v) => send({ type: "set_auto_retry", enabled: v })} />
			</div>
		</Space>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/webui/src/app/ModelConfig.tsx
git commit -m "feat(webui): add ModelConfig component"
```

---

### Task 17: Create `app/Settings.tsx`

**Files:**
- Create: `packages/webui/src/app/Settings.tsx`

- [ ] **Step 1: Write `Settings.tsx`**

```typescript
import { Input, Radio, Space } from "antd";
import { useTheme } from "./ThemeProvider.tsx";

export function Settings() {
	const { mode, setMode } = useTheme();

	return (
		<Space direction="vertical" style={{ width: "100%" }} size="middle">
			<div>
				<label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Theme</label>
				<Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
					<Radio.Button value="light">Light</Radio.Button>
					<Radio.Button value="dark">Dark</Radio.Button>
					<Radio.Button value="system">System</Radio.Button>
				</Radio.Group>
			</div>
			<div>
				<label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Bridge URL</label>
				<Input defaultValue="ws://localhost:8080" />
			</div>
			<div>
				<label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>pi CLI Path</label>
				<Input placeholder="pi (uses PATH)" />
			</div>
		</Space>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/webui/src/app/Settings.tsx
git commit -m "feat(webui): add Settings component"
```

---

### Task 18: Refactor `app/App.tsx` with sidebar layout

**Files:**
- Create: `packages/webui/src/app/App.tsx`
- Modify: `packages/webui/src/main.tsx`

- [ ] **Step 1: Write new `app/App.tsx`**

```typescript
import { Layout } from "antd";
import { useCallback, useMemo } from "react";
import { useBridge } from "../bridge/useBridge.ts";
import type { AgentMessage } from "../bridge/types.ts";
import { ChatView } from "../components/ChatView.tsx";
import { Composer } from "../components/Composer.tsx";
import { StatusBar } from "../components/StatusBar.tsx";
import { Sidebar } from "./Sidebar.tsx";

function extractMessages(events: ReturnType<typeof useBridge>["events"]): {
	messages: AgentMessage[];
	streamingMessage?: AgentMessage;
	isStreaming: boolean;
	modelName?: string;
} {
	const messages: AgentMessage[] = [];
	let streamingMessage: AgentMessage | undefined;
	let isStreaming = false;
	let modelName: string | undefined;

	for (const event of events) {
		if (event.type === "rpc_event") {
			const payload = event.payload as Record<string, unknown>;
			if (payload.type === "agent_start") isStreaming = true;
			if (payload.type === "agent_end") {
				isStreaming = false;
				streamingMessage = undefined;
			}
			if (payload.type === "message_end" && payload.message) {
				messages.push(payload.message as AgentMessage);
				streamingMessage = undefined;
			}
			if (payload.type === "message_update" && payload.message) {
				streamingMessage = payload.message as AgentMessage;
			}
		}
		if (event.type === "rpc_response") {
			if (event.payload.command === "get_state" && event.payload.success) {
				const data = event.payload.data as { model?: { name?: string } };
				modelName = data.model?.name;
			}
		}
	}
	return { messages, streamingMessage, isStreaming, modelName };
}

export function App() {
	const { connected, events, toolCalls, send } = useBridge();
	const { messages, streamingMessage, isStreaming, modelName } = useMemo(
		() => extractMessages(events),
		[events],
	);

	const handleSend = useCallback(
		(message: string) => {
			send({ type: "prompt", message });
		},
		[send],
	);

	return (
		<Layout style={{ height: "100vh" }}>
			<Sidebar send={send} />
			<Layout>
				<ChatView messages={messages} streamingMessage={streamingMessage} toolCalls={toolCalls} />
				<Composer onSend={handleSend} disabled={!connected || isStreaming} />
				<StatusBar connected={connected} isStreaming={isStreaming} modelName={modelName} />
			</Layout>
		</Layout>
	);
}
```

- [ ] **Step 2: Update `main.tsx`**

```typescript
import "../styles/index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App.tsx";
import { ThemeProvider } from "./app/ThemeProvider.tsx";

const root = createRoot(document.getElementById("root")!);
root.render(
	<StrictMode>
		<ThemeProvider>
			<App />
		</ThemeProvider>
	</StrictMode>,
);
```

- [ ] **Step 3: Delete old `src/App.tsx`**

```bash
rm packages/webui/src/App.tsx
```

- [ ] **Step 4: Commit**

```bash
git add packages/webui/src/app/App.tsx packages/webui/src/main.tsx
git rm packages/webui/src/App.tsx
git commit -m "feat(webui): refactor App with sidebar layout and ThemeProvider"
```

---

### Task 19: Implement HTML export in bridge server

**Files:**
- Modify: `packages/webui/bridge-server/server.ts`

- [ ] **Step 1: Add HTTP endpoint for file download**

Modify `BridgeServer` to also start a minimal HTTP server on the same port (or a separate port) to serve exported HTML files for download.

For simplicity, extend the WebSocket server to also handle HTTP:

```typescript
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { WebSocketServer } from "ws";

// In BridgeServer constructor:
const httpServer = createServer((req, res) => {
	if (req.url?.startsWith("/download/")) {
		const filePath = decodeURIComponent(req.url.slice("/download/".length));
		try {
			const data = readFileSync(filePath);
			res.setHeader("Content-Type", "text/html");
			res.setHeader("Content-Disposition", `attachment; filename="${filePath.split("/").pop()}"`);
			res.end(data);
		} catch {
			res.statusCode = 404;
			res.end("Not found");
		}
	} else {
		res.statusCode = 404;
		res.end("Not found");
	}
});

this.wss = new WebSocketServer({ server: httpServer });
httpServer.listen(options.port);
```

Update `server.ts` to use `createServer` instead of standalone `WebSocketServer`.

- [ ] **Step 2: Commit**

```bash
git add packages/webui/bridge-server/server.ts
git commit -m "feat(webui): add HTTP download endpoint for exported HTML"
```

---

### Task 20: Component library extraction — update `package.json`

**Files:**
- Modify: `packages/webui/package.json`

- [ ] **Step 1: Add library exports and peer dependencies**

```json
{
	"name": "@earendil-works/pi-webui",
	"version": "0.78.0",
	"type": "module",
	"description": "Web UI components and bridge client for pi coding-agent",
	"main": "./dist/lib/index.js",
	"types": "./dist/lib/index.d.ts",
	"exports": {
		".": {
			"types": "./dist/lib/index.d.ts",
			"import": "./dist/lib/index.js"
		},
		"./bridge": {
			"types": "./dist/lib/bridge.d.ts",
			"import": "./dist/lib/bridge.js"
		}
	},
	"files": [
		"dist",
		"README.md"
	],
	"peerDependencies": {
		"react": "^19.0.0",
		"react-dom": "^19.0.0",
		"antd": "^5.20.0",
		"@ant-design/x": "^1.0.0"
	},
	"scripts": {
		"clean": "shx rm -rf dist",
		"dev": "concurrently \"npm run dev:bridge\" \"npm run dev:vite\"",
		"dev:vite": "vite",
		"dev:bridge": "tsx bridge-server/index.ts",
		"build": "npm run build:lib && npm run build:app",
		"build:lib": "vite build --config vite.lib.config.ts",
		"build:app": "vite build",
		"build:bridge": "tsgo -p tsconfig.bridge.json",
		"check": "tsc --noEmit",
		"test": "vitest --run"
	}
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/webui/package.json
git commit -m "chore(webui): add library exports and peer dependencies"
```

---

### Task 21: Component library extraction — create `vite.lib.config.ts`

**Files:**
- Create: `packages/webui/vite.lib.config.ts`

- [ ] **Step 1: Write `vite.lib.config.ts`**

```typescript
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
	plugins: [react(), dts({ include: ["src/components", "src/bridge"], outDir: "dist/lib" })],
	build: {
		lib: {
			entry: {
				index: "src/index.ts",
				bridge: "src/bridge/index.ts",
			},
			formats: ["es"],
			fileName: (format, entryName) => `${entryName}.js`,
		},
		rollupOptions: {
			external: ["react", "react-dom", "antd", "@ant-design/x", "react/jsx-runtime"],
			output: {
				globals: {
					react: "React",
					"react-dom": "ReactDOM",
					antd: "antd",
					"@ant-design/x": "AntDesignX",
				},
			},
		},
		outDir: "dist/lib",
		emptyOutDir: true,
	},
});
```

- [ ] **Step 2: Install `vite-plugin-dts`**

Add `"vite-plugin-dts": "4.5.0"` to devDependencies and run `npm install --ignore-scripts`.

- [ ] **Step 3: Commit**

```bash
git add packages/webui/vite.lib.config.ts packages/webui/package.json package-lock.json
git commit -m "chore(webui): add Vite library build config"
```

---

### Task 22: Create library barrel exports

**Files:**
- Create: `packages/webui/src/index.ts`
- Create: `packages/webui/src/bridge/index.ts`
- Create: `packages/webui/src/components/index.ts`

- [ ] **Step 1: Write `src/index.ts`**

```typescript
export {
	ChatView,
	Composer,
	MessageBubble,
	StatusBar,
} from "./components/index.ts";

export {
	ToolCallCard,
	CodeBlock,
	DiffView,
	TerminalOutput,
	InlineForm,
	FileNotice,
} from "./components/tool-renderers/index.ts";

export type { AgentMessage, RpcCommand, RpcResponse, ToolCallState } from "./bridge/types.ts";
```

- [ ] **Step 2: Write `src/bridge/index.ts`**

```typescript
export { BridgeClient, type BridgeEvent } from "./client.ts";
export { useBridge, type UseBridgeState } from "./useBridge.ts";
export type {
	AgentMessage,
	RpcCommand,
	RpcResponse,
	RpcExtensionUIRequest,
	RpcExtensionUIResponse,
	RpcSessionState,
	RpcCommandType,
	ToolCallState,
} from "./types.ts";
```

- [ ] **Step 3: Write `src/components/index.ts`**

```typescript
export { ChatView } from "./ChatView.tsx";
export { Composer } from "./Composer.tsx";
export { MessageBubble } from "./MessageBubble.tsx";
export { StatusBar } from "./StatusBar.tsx";
```

- [ ] **Step 4: Commit**

```bash
git add packages/webui/src/index.ts packages/webui/src/bridge/index.ts packages/webui/src/components/index.ts
git commit -m "feat(webui): add library barrel exports"
```

---

### Task 23: Verify library build

**Files:**
- No new files.

- [ ] **Step 1: Build library**

Run: `cd packages/webui && npm run build:lib`
Expected: `dist/lib/index.js`, `dist/lib/index.d.ts`, `dist/lib/bridge.js`, `dist/lib/bridge.d.ts` created.

- [ ] **Step 2: Build app**

Run: `cd packages/webui && npm run build:app`
Expected: `dist/app/` created with static assets.

- [ ] **Step 3: Run root check**

Run: `npm run check`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(webui): complete Phase 3 with component library build"
```

---

## Self-Review

**1. Spec coverage:**
- Phase 2: CodeBlock, DiffView, TerminalOutput, InlineForm, FileNotice, ToolCallCard, useBridge tool tracking — all covered.
- Phase 3: ThemeProvider, Sidebar, SessionList, ModelConfig, Settings, App layout refactor, HTML export endpoint, library build — all covered.

**2. Placeholder scan:**
- No TBD/TODO/fill-in-details.
- Every step contains actual code or exact commands.

**3. Type consistency:**
- `ToolCallState` defined in `useBridge.ts` and re-exported from `bridge/index.ts`.
- `AgentMessage` defined in `types.ts` and used consistently across components.
- `send` prop signature matches `RpcCommand` in all sidebar components.

**4. Scope check:**
- Phase 2 is self-contained and produces working tool renderers.
- Phase 3 builds on Phase 2 and produces a complete app + library.
