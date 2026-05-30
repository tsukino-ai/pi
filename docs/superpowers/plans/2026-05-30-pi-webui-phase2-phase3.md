# Pi WebUI Phase 2 + Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add rich tool renderers (Phase 2) and complete the full feature set with sidebar, session management, and theme switching (Phase 3).

**Architecture:** Phase 2 adds a `tool-renderers/` directory with specialized components for each agent tool. Phase 3 adds a sidebar layout shell and theme provider. Component library extraction is deferred to a future phase.

**Tech Stack:** React 19, Vite 6, Ant Design X 1.3, Ant Design 5, highlight.js 11, ansi-to-html 0.7, ws 8

---

## Key Design Decisions

### Tool Execution Data Flow

Tool calls arrive as `tool_execution_*` events (forwarded from `AgentSessionEvent` through RPC):

```
tool_execution_start  → { toolCallId, toolName, args }
tool_execution_update → { toolCallId, toolName, args, partialResult }
tool_execution_end    → { toolCallId, toolName, result: AgentToolResult<T>, isError }
```

`AgentToolResult<T>` has: `{ content: (TextContent | ImageContent)[], details: T, terminate?: boolean }`

Tool-specific details:

| Tool | `details` type | Key fields for rendering |
|------|---------------|-------------------------|
| `read` | `ReadToolDetails` | `truncation?` |
| `edit` | `EditToolDetails` | `diff: string`, `patch: string` |
| `bash` | `BashToolDetails` | `truncation?`, `fullOutputPath?` |
| `write` | `undefined` | (none) |

### Tool Call ↔ Message Correlation

Assistant messages contain `{ type: "toolCall", name, arguments }` entries in their `content` array. These appear in the same order as `tool_execution_start` events. The `ToolCallCard` receives the result from the `toolCalls` map by index position — the Nth toolCall in the message content corresponds to the Nth `tool_execution_start` event for that assistant turn.

---

## File Structure

### Phase 2 Additions

```
packages/webui/src/
├── utils/
│   ├── diff-render.ts         # parse pre-formatted unified diff into renderable lines
│   └── ansi.ts                # ANSI-to-HTML wrapper
├── components/
│   ├── tool-renderers/
│   │   ├── index.ts           # barrel export
│   │   ├── ToolCallCard.tsx   # collapsible card wrapper, dispatches to renderer
│   │   ├── CodeBlock.tsx      # syntax highlighted code block (read tool)
│   │   ├── DiffView.tsx       # renders pre-formatted diff from EditToolDetails
│   │   ├── TerminalOutput.tsx # dark terminal with ANSI colors (bash tool)
│   │   └── FileNotice.tsx     # file creation notice (write tool)
│   └── MessageBubble.tsx      # MODIFIED: embed ToolCallCard for tool calls
├── bridge/
│   └── types.ts               # MODIFIED: add ToolCallState type
└── App.tsx                    # MODIFIED: track tool calls in reducer
```

### Phase 3 Additions

```
packages/webui/src/
├── app/
│   ├── App.tsx                # NEW: layout shell with sidebar (replaces src/App.tsx)
│   ├── ThemeProvider.tsx      # Ant Design ConfigProvider wrapper
│   ├── Sidebar.tsx            # collapsible sidebar with tab navigation
│   ├── SessionList.tsx        # session list + actions
│   ├── ModelConfig.tsx        # model + thinking level + mode controls
│   └── Settings.tsx           # theme + bridge URL
├── main.tsx                   # MODIFIED: wrap with ThemeProvider
└── components/
    └── StatusBar.tsx          # MODIFIED: add settings gear icon for sidebar toggle
```

---

## Phase 2 Tasks

### Task 1: Add dependencies

**Files:**
- Modify: `packages/webui/package.json`

- [ ] **Step 1: Add highlight.js and ansi-to-html**

Add to `dependencies`:

```json
"highlight.js": "11.11.1",
"ansi-to-html": "0.7.2"
```

- [ ] **Step 2: Install**

Run: `npm install --ignore-scripts`

- [ ] **Step 3: Commit**

```bash
git add packages/webui/package.json package-lock.json
git commit -m "chore(webui): add highlight.js and ansi-to-html dependencies"
```

---

### Task 2: Create `utils/diff-render.ts`

**Files:**
- Create: `packages/webui/src/utils/diff-render.ts`

The agent's `EditToolDetails.diff` is a pre-formatted diff string. This utility parses it into renderable line objects for the DiffView component.

- [ ] **Step 1: Write `diff-render.ts`**

```typescript
export interface DiffLine {
	type: "context" | "add" | "remove" | "header";
	content: string;
}

export function parseDiffLines(diff: string): DiffLine[] {
	const lines = diff.split("\n");
	const result: DiffLine[] = [];

	for (const line of lines) {
		if (line.startsWith("@@")) {
			result.push({ type: "header", content: line });
		} else if (line.startsWith("+")) {
			result.push({ type: "add", content: line.slice(1) });
		} else if (line.startsWith("-")) {
			result.push({ type: "remove", content: line.slice(1) });
		} else if (line.startsWith(" ")) {
			result.push({ type: "context", content: line.slice(1) });
		} else {
			// Lines that don't match diff format (e.g., "No newline at end of file")
			result.push({ type: "context", content: line });
		}
	}

	return result;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/webui/src/utils/diff-render.ts
git commit -m "feat(webui): add unified diff parser for rendering"
```

---

### Task 3: Create `utils/ansi.ts`

**Files:**
- Create: `packages/webui/src/utils/ansi.ts`

- [ ] **Step 1: Write `ansi.ts`**

```typescript
import ansiToHtml from "ansi-to-html";

const converter = new ansiToHtml({
	fg: "#d4d4d4",
	bg: "#1e1e1e",
	newline: true,
	escapeXML: true,
});

export function ansiToHtmlString(text: string): string {
	try {
		return converter.toHtml(text);
	} catch {
		// Fallback: strip ANSI codes
		return text.replace(/\x1b\[[0-9;]*m/g, "");
	}
}

export function stripAnsi(text: string): string {
	return text.replace(/\x1b\[[0-9;]*m/g, "");
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/webui/src/utils/ansi.ts
git commit -m "feat(webui): add ANSI-to-HTML utility"
```

---

### Task 4: Add `ToolCallState` to bridge types

**Files:**
- Modify: `packages/webui/src/bridge/types.ts`

- [ ] **Step 1: Add types at the end of `types.ts`**

Append to the file:

```typescript
/** Structured result from a tool execution. Matches AgentToolResult<T> from the agent. */
export interface ToolResult {
	content: Array<{ type: string; text?: string }>;
	details: unknown;
	terminate?: boolean;
}

/** Tracked state for a single tool call. */
export interface ToolCallState {
	toolCallId: string;
	toolName: string;
	args: Record<string, unknown>;
	status: "pending" | "success" | "error";
	result?: ToolResult;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/webui && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/webui/src/bridge/types.ts
git commit -m "feat(webui): add ToolCallState and ToolResult types"
```

---

### Task 5: Create `tool-renderers/CodeBlock.tsx`

**Files:**
- Create: `packages/webui/src/components/tool-renderers/CodeBlock.tsx`

- [ ] **Step 1: Write `CodeBlock.tsx`**

```typescript
import { Button, Card } from "antd";
import { CopyOutlined } from "@ant-design/icons";
import { useMemo } from "react";
import hljs from "highlight.js";

const EXT_TO_LANG: Record<string, string> = {
	ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
	py: "python", rs: "rust", go: "go", java: "java", md: "markdown",
	json: "json", yaml: "yaml", yml: "yaml", sh: "bash", bash: "bash",
	css: "css", html: "html", sql: "sql",
};

function detectLanguage(filePath?: string): string | undefined {
	if (!filePath) return undefined;
	const ext = filePath.split(".").pop()?.toLowerCase();
	return EXT_TO_LANG[ext ?? ""];
}

export interface CodeBlockProps {
	content: string;
	filePath?: string;
}

export function CodeBlock({ content, filePath }: CodeBlockProps) {
	const language = detectLanguage(filePath);

	const highlighted = useMemo(() => {
		if (!language) return hljs.highlightAuto(content).value;
		try {
			return hljs.highlight(content, { language }).value;
		} catch {
			return hljs.highlightAuto(content).value;
		}
	}, [content, language]);

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
			<pre style={{ margin: 0, overflowX: "auto", fontSize: 13, lineHeight: 1.5 }}>
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

### Task 6: Create `tool-renderers/DiffView.tsx`

**Files:**
- Create: `packages/webui/src/components/tool-renderers/DiffView.tsx`

Renders the pre-formatted `diff` string from `EditToolDetails`. Does NOT compute diffs — the agent already did that.

- [ ] **Step 1: Write `DiffView.tsx`**

```typescript
import { Card } from "antd";
import { useMemo } from "react";
import { parseDiffLines, type DiffLine } from "../../utils/diff-render.ts";

function DiffLineComponent({ line }: { line: DiffLine }) {
	if (line.type === "header") {
		return (
			<div style={{ color: "#888", padding: "4px 8px", background: "#f5f5f5", fontFamily: "monospace", fontSize: 13 }}>
				{line.content}
			</div>
		);
	}

	const bg = line.type === "add" ? "#e6ffed" : line.type === "remove" ? "#ffeef0" : "transparent";
	const prefix = line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";

	return (
		<div style={{ background: bg, padding: "1px 8px", whiteSpace: "pre", fontFamily: "monospace", fontSize: 13, lineHeight: 1.5 }}>
			<span style={{ color: "#999", userSelect: "none", marginRight: 8 }}>{prefix}</span>
			{line.content}
		</div>
	);
}

export interface DiffViewProps {
	diff: string;       // Pre-formatted diff from EditToolDetails.diff
	filePath?: string;
}

export function DiffView({ diff, filePath }: DiffViewProps) {
	const lines = useMemo(() => parseDiffLines(diff), [diff]);

	return (
		<Card size="small" title={`Diff: ${filePath ?? "unknown"}`} style={{ marginTop: 8 }}>
			<div style={{ overflowX: "auto" }}>
				{lines.map((line, i) => (
					<DiffLineComponent key={i} line={line} />
				))}
			</div>
		</Card>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/webui/src/components/tool-renderers/DiffView.tsx
git commit -m "feat(webui): add DiffView renderer for pre-formatted diffs"
```

---

### Task 7: Create `tool-renderers/TerminalOutput.tsx`

**Files:**
- Create: `packages/webui/src/components/tool-renderers/TerminalOutput.tsx`

Props match the design spec: `{ command, output, isError }`. Output comes from `result.content[0].text`.

- [ ] **Step 1: Write `TerminalOutput.tsx`**

```typescript
import { Card, Tag } from "antd";
import { useState } from "react";
import { ansiToHtmlString } from "../../utils/ansi.ts";

export interface TerminalOutputProps {
	command: string;
	output: string;     // Combined output from result.content[0].text
	isError: boolean;    // From tool_execution_end.isError
}

export function TerminalOutput({ command, output, isError }: TerminalOutputProps) {
	const [expanded, setExpanded] = useState(false);
	const htmlOutput = ansiToHtmlString(output);
	const lines = output.split("\n");
	const isLong = lines.length > 20;

	return (
		<Card
			size="small"
			title={
				<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
					<span style={{ fontFamily: "monospace", fontSize: 13 }}>$ {command}</span>
					<Tag color={isError ? "red" : "green"}>{isError ? "Error" : "OK"}</Tag>
				</div>
			}
			style={{ marginTop: 8, background: "#1e1e1e", color: "#d4d4d4" }}
			styles={{ body: { padding: "8px 12px" } }}
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
					maxHeight: expanded ? "none" : "400px",
					overflow: "auto",
				}}
				dangerouslySetInnerHTML={{ __html: isLong && !expanded ? ansiToHtmlString(lines.slice(0, 20).join("\n")) : htmlOutput }}
			/>
			{isLong && (
				<div style={{ textAlign: "center", paddingTop: 8 }}>
					<a
						onClick={() => setExpanded(!expanded)}
						style={{ color: "#1890ff", cursor: "pointer", fontSize: 12 }}
					>
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
git commit -m "feat(webui): add TerminalOutput renderer with ANSI support"
```

---

### Task 8: Create `tool-renderers/FileNotice.tsx`

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
	const lines = content.split("\n");
	const preview = lines.slice(0, 3).join("\n");

	return (
		<Card size="small" style={{ marginTop: 8, background: "#f6ffed", borderColor: "#b7eb8f" }}>
			<div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
				<FileAddOutlined style={{ color: "#52c41a" }} />
				<span style={{ fontWeight: 500 }}>Created {filePath}</span>
			</div>
			<pre style={{ margin: 0, fontSize: 12, color: "#666", whiteSpace: "pre-wrap" }}>
				{preview}
				{lines.length > 3 && "\n..."}
			</pre>
		</Card>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/webui/src/components/tool-renderers/FileNotice.tsx
git commit -m "feat(webui): add FileNotice renderer"
```

---

### Task 9: Create `tool-renderers/ToolCallCard.tsx` + barrel export

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
	TerminalOutlined,
} from "@ant-design/icons";
import type { ToolCallState } from "../../bridge/types.ts";
import { CodeBlock } from "./CodeBlock.tsx";
import { DiffView } from "./DiffView.tsx";
import { TerminalOutput } from "./TerminalOutput.tsx";
import { FileNotice } from "./FileNotice.tsx";

export interface ToolCallCardProps {
	toolName: string;
	args: Record<string, unknown>;
	status: ToolCallState["status"];
	result?: ToolCallState["result"];
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
	read: <FileTextOutlined />,
	edit: <EditOutlined />,
	bash: <TerminalOutlined />,
	write: <CodeOutlined />,
};

function getArgSummary(toolName: string, args: Record<string, unknown>): string {
	switch (toolName) {
		case "read":
		case "edit":
		case "write":
			return String(args.path ?? args.filePath ?? "");
		case "bash":
			return String(args.command ?? "");
		default:
			return "";
	}
}

function ToolResultBody({ toolName, args, result }: { toolName: string; args: Record<string, unknown>; result?: ToolCallState["result"] }) {
	if (!result) return null;

	const textContent = result.content
		.filter((c) => c.type === "text" && c.text)
		.map((c) => c.text!)
		.join("\n");

	switch (toolName) {
		case "read": {
			const filePath = String(args.path ?? args.filePath ?? "");
			return <CodeBlock content={textContent} filePath={filePath} />;
		}
		case "edit": {
			const details = result.details as { diff?: string; patch?: string } | undefined;
			const filePath = String(args.path ?? args.filePath ?? "");
			const diff = details?.diff ?? textContent;
			return <DiffView diff={diff} filePath={filePath} />;
		}
		case "bash": {
			const command = String(args.command ?? "");
			return <TerminalOutput command={command} output={textContent} isError={false} />;
		}
		case "write": {
			const filePath = String(args.path ?? args.filePath ?? "");
			return <FileNotice filePath={filePath} content={textContent} />;
		}
		default:
			return <CodeBlock content={textContent} />;
	}
}

export function ToolCallCard({ toolName, args, status, result }: ToolCallCardProps) {
	const icon = TOOL_ICONS[toolName] ?? <CodeOutlined />;
	const summary = getArgSummary(toolName, args);
	const isError = status === "error";

	return (
		<Card
			size="small"
			style={{ marginTop: 8, borderColor: isError ? "#ff4d4f" : undefined }}
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
export { FileNotice } from "./FileNotice.tsx";
```

- [ ] **Step 3: Commit**

```bash
git add packages/webui/src/components/tool-renderers/
git commit -m "feat(webui): add ToolCallCard with dispatch to specialized renderers"
```

---

### Task 10: Track tool calls in `App.tsx` reducer

**Files:**
- Modify: `packages/webui/src/App.tsx`
- Modify: `packages/webui/src/components/ChatView.tsx`
- Modify: `packages/webui/src/components/MessageBubble.tsx`

- [ ] **Step 1: Add tool call state to `App.tsx` reducer**

Add to `ChatState`:

```typescript
toolCalls: Map<string, import("./bridge/types.ts").ToolCallState>;
```

Add to `initialState`:

```typescript
toolCalls: new Map(),
```

Add reducer cases:

```typescript
case "tool_execution_start": {
  const next = new Map(state.toolCalls);
  next.set(action.toolCallId, {
    toolCallId: action.toolCallId,
    toolName: action.toolName,
    args: action.args,
    status: "pending",
  });
  return { ...state, toolCalls: next };
}
case "tool_execution_end": {
  const next = new Map(state.toolCalls);
  const existing = next.get(action.toolCallId);
  if (existing) {
    next.set(action.toolCallId, {
      ...existing,
      status: action.isError ? "error" : "success",
      result: action.result,
    });
  }
  return { ...state, toolCalls: next };
}
```

Add to `ChatAction` union:

```typescript
| { type: "tool_execution_start"; toolCallId: string; toolName: string; args: Record<string, unknown> }
| { type: "tool_execution_end"; toolCallId: string; isError: boolean; result: import("./bridge/types.ts").ToolResult }
```

Add to the event processing `useEffect`:

```typescript
case "tool_execution_start":
  dispatch({
    type: "tool_execution_start",
    toolCallId: String(payload.toolCallId),
    toolName: String(payload.toolName),
    args: (payload.args ?? {}) as Record<string, unknown>,
  });
  break;
case "tool_execution_end":
  dispatch({
    type: "tool_execution_end",
    toolCallId: String(payload.toolCallId),
    isError: Boolean(payload.isError),
    result: payload.result as import("./bridge/types.ts").ToolResult,
  });
  break;
```

Pass `toolCalls` to `ChatView`:

```typescript
<ChatView messages={state.messages} streamingMessage={state.streamingMessage} toolCalls={state.toolCalls} />
```

- [ ] **Step 2: Update `ChatView.tsx` to accept and forward `toolCalls`**

```typescript
import type { ToolCallState } from "../bridge/types.ts";

export interface ChatViewProps {
  messages: AgentMessage[];
  streamingMessage?: AgentMessage;
  toolCalls?: Map<string, ToolCallState>;
}

export function ChatView({ messages, streamingMessage, toolCalls }: ChatViewProps) {
  // Pass toolCalls to each MessageBubble
  // ...
  <MessageBubble key={...} message={msg} toolCalls={toolCalls} />
  // ...
}
```

- [ ] **Step 3: Update `MessageBubble.tsx` to embed `ToolCallCard`**

For assistant messages, extract `toolCall` entries from `content` and render a `ToolCallCard` for each. Use index-based correlation: the Nth toolCall in the message corresponds to the Nth pending tool execution for that assistant turn.

```typescript
import { ToolCallCard } from "./tool-renderers/index.ts";
import type { ToolCallState } from "../bridge/types.ts";

export interface MessageBubbleProps {
  message: AgentMessage;
  isStreaming?: boolean;
  toolCalls?: Map<string, ToolCallState>;
}

// In the render, for assistant messages with tool calls:
// 1. Filter content for { type: "toolCall" } entries
// 2. Collect all ToolCallState entries from the map in insertion order
// 3. Match by index position
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd packages/webui && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add packages/webui/src/App.tsx packages/webui/src/components/ChatView.tsx packages/webui/src/components/MessageBubble.tsx
git commit -m "feat(webui): track tool call state and render ToolCallCard in messages"
```

---

### Task 11: Add Phase 2 tests

**Files:**
- Create: `packages/webui/test/diff-render.test.ts`
- Create: `packages/webui/test/ToolCallCard.test.tsx`
- Modify: `packages/webui/package.json`

- [ ] **Step 1: Write `diff-render.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { parseDiffLines } from "../src/utils/diff-render.ts";

describe("parseDiffLines", () => {
  it("parses header lines", () => {
    const lines = parseDiffLines("@@ -1,3 +1,4 @@\n context\n+added\n-removed");
    expect(lines[0].type).toBe("header");
    expect(lines[0].content).toContain("@@");
  });

  it("parses added lines", () => {
    const lines = parseDiffLines("+new line");
    expect(lines).toHaveLength(1);
    expect(lines[0].type).toBe("add");
    expect(lines[0].content).toBe("new line");
  });

  it("parses removed lines", () => {
    const lines = parseDiffLines("-old line");
    expect(lines).toHaveLength(1);
    expect(lines[0].type).toBe("remove");
    expect(lines[0].content).toBe("old line");
  });

  it("parses context lines", () => {
    const lines = parseDiffLines(" unchanged");
    expect(lines).toHaveLength(1);
    expect(lines[0].type).toBe("context");
    expect(lines[0].content).toBe("unchanged");
  });

  it("handles mixed diff", () => {
    const diff = "@@ -1,3 +1,4 @@\n keep\n-remove\n+add1\n+add2";
    const lines = parseDiffLines(diff);
    expect(lines).toHaveLength(5);
    expect(lines.map((l) => l.type)).toEqual(["header", "context", "remove", "add", "add"]);
  });
});
```

- [ ] **Step 2: Write `ToolCallCard.test.tsx`**

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToolCallCard } from "../src/components/tool-renderers/ToolCallCard.tsx";

describe("ToolCallCard", () => {
  it("renders tool name", () => {
    render(
      <ToolCallCard
        toolName="read"
        args={{ path: "test.ts" }}
        status="pending"
      />
    );
    expect(screen.getByText("read")).toBeDefined();
  });

  it("renders pending spinner", () => {
    render(
      <ToolCallCard
        toolName="bash"
        args={{ command: "ls" }}
        status="pending"
      />
    );
    expect(screen.getByText("bash")).toBeDefined();
  });

  it("renders success tag", () => {
    render(
      <ToolCallCard
        toolName="read"
        args={{ path: "test.ts" }}
        status="success"
      />
    );
    expect(screen.getByText("Done")).toBeDefined();
  });

  it("renders error tag", () => {
    render(
      <ToolCallCard
        toolName="bash"
        args={{ command: "false" }}
        status="error"
      />
    );
    expect(screen.getByText("Error")).toBeDefined();
  });
});
```

- [ ] **Step 3: Add `@testing-library/react` to devDependencies**

```json
"@testing-library/react": "16.3.0"
```

Run: `npm install --ignore-scripts`

- [ ] **Step 4: Run tests**

Run: `cd packages/webui && npx vitest --run`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/webui/test/ packages/webui/package.json package-lock.json
git commit -m "test(webui): add diff parser and ToolCallCard tests"
```

---

### Task 12: Phase 2 verification

- [ ] **Step 1: Verify TypeScript compiles**

Run: `cd packages/webui && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 2: Run tests**

Run: `cd packages/webui && npx vitest --run`
Expected: All tests pass.

- [ ] **Step 3: Run biome**

Run: `npx biome check --write packages/webui/`
Expected: No errors (auto-fixes applied).

- [ ] **Step 4: Commit any biome fixes**

```bash
git add -u packages/webui/
git commit -m "style(webui): biome formatting fixes for Phase 2"
```

---

## Phase 3 Tasks

### Task 13: Create `app/ThemeProvider.tsx`

**Files:**
- Create: `packages/webui/src/app/ThemeProvider.tsx`

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
		const stored = localStorage.getItem("pi-webui-theme");
		if (stored === "light" || stored === "dark" || stored === "system") return stored;
		return "system";
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
		localStorage.setItem("pi-webui-theme", m);
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

- [ ] **Step 2: Commit**

```bash
git add packages/webui/src/app/ThemeProvider.tsx
git commit -m "feat(webui): add ThemeProvider with light/dark/system modes"
```

---

### Task 14: Create `app/SessionList.tsx`

**Files:**
- Create: `packages/webui/src/app/SessionList.tsx`

No "Delete" action — there's no `delete_session` RPC command.

- [ ] **Step 1: Write `SessionList.tsx`**

```typescript
import { Button, Dropdown, Empty, List } from "antd";
import {
	DownloadOutlined,
	EditOutlined,
	ForkOutlined,
	PlusOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import type { RpcCommand } from "../bridge/types.ts";

export interface SessionListProps {
	send: (command: RpcCommand) => void;
}

interface SessionItem {
	id: string;
	name: string;
	lastMessage: string;
}

export function SessionList({ send }: SessionListProps) {
	const [sessions, setSessions] = useState<SessionItem[]>([]);

	const handleNew = () => {
		send({ type: "new_session" });
	};

	const getMenuItems = (session: SessionItem): MenuProps["items"] => [
		{
			key: "rename",
			icon: <EditOutlined />,
			label: "Rename",
			onClick: () => {
				const name = prompt("New name:", session.name);
				if (name) send({ type: "set_session_name", name });
			},
		},
		{
			key: "fork",
			icon: <ForkOutlined />,
			label: "Fork",
			onClick: () => send({ type: "fork", entryId: session.id }),
		},
		{
			key: "export",
			icon: <DownloadOutlined />,
			label: "Export HTML",
			onClick: () => send({ type: "export_html" }),
		},
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

### Task 15: Create `app/ModelConfig.tsx`

**Files:**
- Create: `packages/webui/src/app/ModelConfig.tsx`

- [ ] **Step 1: Write `ModelConfig.tsx`**

```typescript
import { Select, Space, Switch } from "antd";
import type { RpcCommand } from "../bridge/types.ts";

export interface ModelConfigProps {
	send: (command: RpcCommand) => void;
	thinkingLevel: string;
	steeringMode: string;
	autoCompaction: boolean;
	autoRetry: boolean;
}

const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;

export function ModelConfig({ send, thinkingLevel, steeringMode, autoCompaction, autoRetry }: ModelConfigProps) {
	return (
		<Space direction="vertical" style={{ width: "100%" }} size="middle">
			<div>
				<label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Thinking Level</label>
				<Select
					style={{ width: "100%" }}
					value={thinkingLevel}
					options={THINKING_LEVELS.map((l) => ({ value: l, label: l }))}
					onChange={(v) => send({ type: "set_thinking_level", level: v })}
				/>
			</div>
			<div>
				<label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Steering Mode</label>
				<Select
					style={{ width: "100%" }}
					value={steeringMode}
					options={[
						{ value: "all", label: "All" },
						{ value: "one-at-a-time", label: "One at a time" },
					]}
					onChange={(v) => send({ type: "set_steering_mode", mode: v })}
				/>
			</div>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
				<span style={{ fontWeight: 500 }}>Auto Compaction</span>
				<Switch checked={autoCompaction} onChange={(v) => send({ type: "set_auto_compaction", enabled: v })} />
			</div>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
				<span style={{ fontWeight: 500 }}>Auto Retry</span>
				<Switch checked={autoRetry} onChange={(v) => send({ type: "set_auto_retry", enabled: v })} />
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

### Task 16: Create `app/Settings.tsx`

**Files:**
- Create: `packages/webui/src/app/Settings.tsx`

- [ ] **Step 1: Write `Settings.tsx`**

```typescript
import { Radio, Space } from "antd";
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

### Task 17: Create `app/Sidebar.tsx`

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
import type { RpcCommand } from "../bridge/types.ts";
import { SessionList } from "./SessionList.tsx";
import { ModelConfig } from "./ModelConfig.tsx";
import { Settings } from "./Settings.tsx";

const { Sider } = Layout;

type SidebarTab = "sessions" | "models" | "settings";

export interface SidebarProps {
	send: (command: RpcCommand) => void;
	thinkingLevel: string;
	steeringMode: string;
	autoCompaction: boolean;
	autoRetry: boolean;
}

export function Sidebar({ send, thinkingLevel, steeringMode, autoCompaction, autoRetry }: SidebarProps) {
	const [activeTab, setActiveTab] = useState<SidebarTab>("sessions");

	return (
		<Sider width={280} theme="light" style={{ borderRight: "1px solid #f0f0f0", overflow: "auto" }}>
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
				{activeTab === "models" && (
					<ModelConfig
						send={send}
						thinkingLevel={thinkingLevel}
						steeringMode={steeringMode}
						autoCompaction={autoCompaction}
						autoRetry={autoRetry}
					/>
				)}
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

### Task 18: Create `app/App.tsx` — sidebar layout

**Files:**
- Create: `packages/webui/src/app/App.tsx`

Uses Phase 1's `useReducer` pattern (not the old `extractMessages` approach). Extends the existing reducer with sidebar state.

- [ ] **Step 1: Write `app/App.tsx`**

```typescript
import { Layout } from "antd";
import { useCallback, useEffect, useReducer } from "react";
import { useBridge } from "../bridge/useBridge.ts";
import type { AgentMessage, RpcExtensionUIRequest, ToolCallState } from "../bridge/types.ts";
import { ChatView } from "../components/ChatView.tsx";
import { Composer } from "../components/Composer.tsx";
import { StatusBar } from "../components/StatusBar.tsx";
import { Sidebar } from "./Sidebar.tsx";

// Reuse the same reducer shape as Phase 1's App.tsx, extended with sidebar + tool state
interface AppState {
	messages: AgentMessage[];
	streamingMessage: AgentMessage | undefined;
	isStreaming: boolean;
	modelName: string | undefined;
	pendingExtension: RpcExtensionUIRequest | undefined;
	toolCalls: Map<string, ToolCallState>;
	// Sidebar state from get_state
	thinkingLevel: string;
	steeringMode: string;
	autoCompaction: boolean;
	autoRetry: boolean;
	sidebarCollapsed: boolean;
}

type AppAction =
	| { type: "agent_start" }
	| { type: "agent_end" }
	| { type: "message_end"; message: AgentMessage }
	| { type: "message_update"; message: AgentMessage }
	| { type: "user_message"; message: AgentMessage }
	| { type: "model_name"; name: string }
	| { type: "extension_request"; request: RpcExtensionUIRequest }
	| { type: "extension_dismiss" }
	| { type: "tool_execution_start"; toolCallId: string; toolName: string; args: Record<string, unknown> }
	| { type: "tool_execution_end"; toolCallId: string; isError: boolean; result: ToolCallState["result"] }
	| { type: "state_update"; thinkingLevel: string; steeringMode: string; autoCompaction: boolean; autoRetry: boolean }
	| { type: "toggle_sidebar" };

const initialState: AppState = {
	messages: [],
	streamingMessage: undefined,
	isStreaming: false,
	modelName: undefined,
	pendingExtension: undefined,
	toolCalls: new Map(),
	thinkingLevel: "off",
	steeringMode: "all",
	autoCompaction: true,
	autoRetry: true,
	sidebarCollapsed: false,
};

function appReducer(state: AppState, action: AppAction): AppState {
	switch (action.type) {
		case "agent_start":
			return { ...state, isStreaming: true };
		case "agent_end":
			return { ...state, isStreaming: false, streamingMessage: undefined };
		case "message_end":
			return { ...state, messages: [...state.messages, action.message], streamingMessage: undefined };
		case "message_update":
			return { ...state, streamingMessage: action.message };
		case "user_message":
			return { ...state, messages: [...state.messages, action.message] };
		case "model_name":
			return { ...state, modelName: action.name };
		case "extension_request":
			return { ...state, pendingExtension: action.request };
		case "extension_dismiss":
			return { ...state, pendingExtension: undefined };
		case "tool_execution_start": {
			const next = new Map(state.toolCalls);
			next.set(action.toolCallId, {
				toolCallId: action.toolCallId,
				toolName: action.toolName,
				args: action.args,
				status: "pending",
			});
			return { ...state, toolCalls: next };
		}
		case "tool_execution_end": {
			const next = new Map(state.toolCalls);
			const existing = next.get(action.toolCallId);
			if (existing) {
				next.set(action.toolCallId, {
					...existing,
					status: action.isError ? "error" : "success",
					result: action.result,
				});
			}
			return { ...state, toolCalls: next };
		}
		case "state_update":
			return {
				...state,
				thinkingLevel: action.thinkingLevel,
				steeringMode: action.steeringMode,
				autoCompaction: action.autoCompaction,
				autoRetry: action.autoRetry,
			};
		case "toggle_sidebar":
			return { ...state, sidebarCollapsed: !state.sidebarCollapsed };
		default:
			return state;
	}
}

export function App() {
	const { connected, events, send } = useBridge();
	const [state, dispatch] = useReducer(appReducer, initialState);

	useEffect(() => {
		const event = events[events.length - 1];
		if (!event) return;

		if (event.type === "rpc_event") {
			const payload = event.payload as Record<string, unknown>;
			switch (payload.type) {
				case "agent_start":
					dispatch({ type: "agent_start" });
					break;
				case "agent_end":
					dispatch({ type: "agent_end" });
					break;
				case "message_end":
					if (payload.message) dispatch({ type: "message_end", message: payload.message as AgentMessage });
					break;
				case "message_update":
					if (payload.message) dispatch({ type: "message_update", message: payload.message as AgentMessage });
					break;
				case "extension_ui_request":
					dispatch({ type: "extension_request", request: payload as unknown as RpcExtensionUIRequest });
					break;
				case "tool_execution_start":
					dispatch({
						type: "tool_execution_start",
						toolCallId: String(payload.toolCallId),
						toolName: String(payload.toolName),
						args: (payload.args ?? {}) as Record<string, unknown>,
					});
					break;
				case "tool_execution_end":
					dispatch({
						type: "tool_execution_end",
						toolCallId: String(payload.toolCallId),
						isError: Boolean(payload.isError),
						result: payload.result as ToolCallState["result"],
					});
					break;
			}
		}

		if (event.type === "rpc_response") {
			const resp = event.payload as Record<string, unknown>;
			if (resp.command === "get_state" && resp.success) {
				const data = resp.data as Record<string, unknown>;
				if (data.model) dispatch({ type: "model_name", name: (data.model as Record<string, string>).name });
				dispatch({
					type: "state_update",
					thinkingLevel: String(data.thinkingLevel ?? "off"),
					steeringMode: String(data.steeringMode ?? "all"),
					autoCompaction: Boolean(data.autoCompactionEnabled),
					autoRetry: Boolean(data.autoRetryEnabled),
				});
			}
		}
	}, [events]);

	const handleSend = useCallback(
		(message: string) => {
			dispatch({ type: "user_message", message: { role: "user", content: message, timestamp: Date.now() } });
			send({ type: "prompt", message });
		},
		[send],
	);

	return (
		<Layout style={{ height: "100vh" }}>
			{!state.sidebarCollapsed && (
				<Sidebar
					send={send}
					thinkingLevel={state.thinkingLevel}
					steeringMode={state.steeringMode}
					autoCompaction={state.autoCompaction}
					autoRetry={state.autoRetry}
				/>
			)}
			<Layout>
				<ChatView messages={state.messages} streamingMessage={state.streamingMessage} toolCalls={state.toolCalls} />
				<Composer onSend={handleSend} disabled={!connected || state.isStreaming} />
				<StatusBar
					connected={connected}
					isStreaming={state.isStreaming}
					modelName={state.modelName}
					onToggleSidebar={() => dispatch({ type: "toggle_sidebar" })}
				/>
			</Layout>
		</Layout>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/webui/src/app/App.tsx
git commit -m "feat(webui): add sidebar layout with full reducer integration"
```

---

### Task 19: Update `main.tsx` and remove old `App.tsx`

**Files:**
- Modify: `packages/webui/src/main.tsx`
- Delete: `packages/webui/src/App.tsx`

- [ ] **Step 1: Rewrite `main.tsx`**

```typescript
import "./styles/index.css";
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

- [ ] **Step 2: Delete old `src/App.tsx`**

```bash
git rm packages/webui/src/App.tsx
```

- [ ] **Step 3: Commit**

```bash
git add packages/webui/src/main.tsx
git commit -m "feat(webui): switch to sidebar App with ThemeProvider"
```

---

### Task 20: Add sidebar toggle to StatusBar

**Files:**
- Modify: `packages/webui/src/components/StatusBar.tsx`

- [ ] **Step 1: Add `onToggleSidebar` prop**

```typescript
import { Button, Tag } from "antd";
import { MenuOutlined } from "@ant-design/icons";

export interface StatusBarProps {
	connected: boolean;
	isStreaming: boolean;
	modelName?: string;
	onToggleSidebar?: () => void;
}

export function StatusBar({ connected, isStreaming, modelName, onToggleSidebar }: StatusBarProps) {
	return (
		<div
			style={{
				padding: "8px 16px",
				borderTop: "1px solid #f0f0f0",
				display: "flex",
				gap: 12,
				alignItems: "center",
				fontSize: 12,
			}}
		>
			{onToggleSidebar && (
				<Button size="small" type="text" icon={<MenuOutlined />} onClick={onToggleSidebar} />
			)}
			<Tag color={connected ? "green" : "red"}>{connected ? "Connected" : "Disconnected"}</Tag>
			{isStreaming && <Tag color="blue">Streaming...</Tag>}
			{modelName && <span style={{ marginLeft: "auto" }}>{modelName}</span>}
		</div>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/webui/src/components/StatusBar.tsx
git commit -m "feat(webui): add sidebar toggle button to StatusBar"
```

---

### Task 21: Phase 3 verification

- [ ] **Step 1: Verify TypeScript compiles**

Run: `cd packages/webui && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 2: Run tests**

Run: `cd packages/webui && npx vitest --run`
Expected: All tests pass.

- [ ] **Step 3: Run biome**

Run: `npx biome check --write packages/webui/`
Expected: No errors.

- [ ] **Step 4: Commit any biome fixes**

```bash
git add -u packages/webui/
git commit -m "style(webui): biome formatting fixes for Phase 3"
```

---

## Spec Coverage Check

### Phase 2

| Spec Requirement | Task |
|---|---|
| `highlight.js` for syntax highlighting | 1, 5 |
| Pre-formatted diff rendering from `EditToolDetails.diff` | 2, 6 |
| ANSI terminal output | 3, 7 |
| `ToolCallCard` with collapsible header | 9 |
| `CodeBlock` for read tool | 5 |
| `DiffView` for edit tool | 6 |
| `TerminalOutput` for bash tool | 7 |
| `FileNotice` for write tool | 8 |
| Tool call state tracking in reducer | 10 |
| MessageBubble embeds ToolCallCard | 10 |
| Extension UI dialogs (select, confirm, input, editor) | Out of scope — Phase 1 already handles basic dismiss; full dialogs are a future task |
| Error handling (fallbacks, truncation) | 5, 6, 7 |
| Tests | 11 |

### Phase 3

| Spec Requirement | Task |
|---|---|
| ThemeProvider with light/dark/system | 13 |
| Sidebar with tab navigation | 17 |
| Session list + actions (no delete) | 14 |
| Model config (thinking, steering, auto-compaction, auto-retry) | 15 |
| Settings (theme) | 16 |
| App layout refactor | 18, 19 |
| StatusBar sidebar toggle | 20 |
| Component library extraction | **Deferred** (per spec) |
| HTML export endpoint | **Deferred** (per spec — needs bridge HTTP route design) |
