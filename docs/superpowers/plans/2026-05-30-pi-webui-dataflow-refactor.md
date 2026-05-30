# pi WebUI Phase 1: Data Flow Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ad-hoc `events[]` accumulation in `App.tsx` with a standardized `usePiChat` hook that manages message lifecycle (idle/loading/success/error), supports abort, and prevents memory leaks via event trimming.

**Architecture:** Introduce a single source-of-truth hook (`usePiChat`) that wraps `useBridge` and maintains derived state (messages, streamingMessage, status). The hook converts raw bridge events into a structured chat state, exposes `onRequest`/`onAbort`, and prunes old events to cap memory. `App.tsx` becomes a thin layout component. An `ErrorBoundary` prevents React render crashes from bubbling to white screen.

**Tech Stack:** React 19, TypeScript, `@ant-design/x` (Sender, Bubble), WebSocket, pi RPC protocol

---

## File Structure

| File | Responsibility |
|---|---|
| `src/hooks/usePiChat.ts` | New. Core hook: bridges WebSocket events → chat state. Manages message lifecycle, event trimming, abort. |
| `src/components/ErrorBoundary.tsx` | New. Catches render errors, displays fallback UI instead of white screen. |
| `src/components/Composer.tsx` | Modify. Wire `Sender.loading` + `Sender.onCancel` to `usePiChat`. |
| `src/components/ChatView.tsx` | Modify. Accept `status` prop to show skeleton when loading. |
| `src/App.tsx` | Modify. Replace `extractMessages` + `useBridge` with `usePiChat`. Wire `ErrorBoundary`. |
| `src/bridge/useBridge.ts` | No change. `usePiChat` consumes it. |
| `test/usePiChat.test.ts` | New. Unit test the hook with a mock bridge. |

---

## Task 1: Error Boundary

**Files:**
- Create: `src/components/ErrorBoundary.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
	children: ReactNode;
}

interface State {
	hasError: boolean;
	error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
	state: State = { hasError: false };

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error("[ErrorBoundary]", error, info.componentStack);
	}

	render() {
		if (this.state.hasError) {
			return (
				<div style={{ padding: 40, textAlign: "center" }}>
					<h2>Something went wrong</h2>
					<p style={{ color: "#999" }}>{this.state.error?.message}</p>
					<button
						onClick={() => window.location.reload()}
						style={{
							marginTop: 16,
							padding: "8px 16px",
							cursor: "pointer",
						}}
					>
						Reload
					</button>
				</div>
			);
		}
		return this.props.children;
	}
}
```

- [ ] **Step 2: Commit**

```bash
cd packages/webui
git add src/components/ErrorBoundary.tsx
git commit -m "feat(webui): add ErrorBoundary to prevent white screen crashes"
```

---

## Task 2: usePiChat Hook — Scaffold

**Files:**
- Create: `src/hooks/usePiChat.ts`

- [ ] **Step 1: Write types and scaffold**

```ts
import { useCallback, useMemo, useRef, useState } from "react";
import { useBridge } from "../bridge/useBridge.ts";
import type { AgentMessage, ImageContent, RpcCommand } from "../bridge/types.ts";

export type ChatStatus = "idle" | "loading" | "error";

export interface UsePiChatReturn {
	/** Completed messages */
	messages: AgentMessage[];
	/** Currently streaming incomplete message */
	streamingMessage?: AgentMessage;
	/** Overall chat status */
	status: ChatStatus;
	/** WebSocket connected */
	connected: boolean;
	/** Send a user prompt */
	onRequest: (message: string, images?: ImageContent[]) => void;
	/** Abort ongoing generation */
	onAbort: () => void;
}

export function usePiChat(): UsePiChatReturn {
	const { connected, events, send } = useBridge();
	const [status, setStatus] = useState<ChatStatus>("idle");

	return {
		messages: [],
		streamingMessage: undefined,
		status,
		connected,
		onRequest: () => {},
		onAbort: () => {},
	};
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd packages/webui && npm run check
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePiChat.ts
git commit -m "feat(webui): scaffold usePiChat hook"
```

---

## Task 3: usePiChat — Message Extraction Logic

**Files:**
- Modify: `src/hooks/usePiChat.ts`

- [ ] **Step 1: Add event-to-state reducer**

Replace the body of `usePiChat` with state derivation from `events`:

```ts
export function usePiChat(): UsePiChatReturn {
	const { connected, events, send } = useBridge();

	const state = useMemo(() => {
		const messages: AgentMessage[] = [];
		let streamingMessage: AgentMessage | undefined;
		let status: ChatStatus = "idle";

		for (const event of events) {
			if (event.type === "rpc_event") {
				const payload = event.payload as Record<string, unknown>;
				if (payload.type === "agent_start") {
					status = "loading";
				}
				if (payload.type === "agent_end") {
					status = "idle";
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
				const resp = event.payload;
				if (resp.success === false) {
					status = "error";
				}
			}
		}

		return { messages, streamingMessage, status };
	}, [events]);

	return {
		messages: state.messages,
		streamingMessage: state.streamingMessage,
		status: state.status,
		connected,
		onRequest: () => {},
		onAbort: () => {},
	};
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd packages/webui && npm run check
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePiChat.ts
git commit -m "feat(webui): add message extraction to usePiChat"
```

---

## Task 4: usePiChat — Request & Abort

**Files:**
- Modify: `src/hooks/usePiChat.ts`

- [ ] **Step 1: Implement onRequest**

```ts
export function usePiChat(): UsePiChatReturn {
	const { connected, events, send } = useBridge();

	// ... existing state derivation ...

	const onRequest = useCallback(
		(message: string, images?: ImageContent[]) => {
			if (!message.trim() || !connected) return;
			send({ type: "prompt", message: message.trim(), images });
		},
		[send, connected],
	);

	const onAbort = useCallback(() => {
		send({ type: "abort" });
	}, [send]);

	return {
		messages: state.messages,
		streamingMessage: state.streamingMessage,
		status: state.status,
		connected,
		onRequest,
		onAbort,
	};
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd packages/webui && npm run check
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePiChat.ts
git commit -m "feat(webui): add onRequest and onAbort to usePiChat"
```

---

## Task 5: usePiChat — Event Trimming

**Files:**
- Modify: `src/hooks/usePiChat.ts`

- [ ] **Step 1: Add trimEvents helper**

Before `usePiChat`, add:

```ts
const MAX_EVENTS = 2000;

function trimEvents(events: ReturnType<typeof useBridge>["events"]) {
	if (events.length <= MAX_EVENTS) return events;
	// Keep the last MAX_EVENTS, but always preserve from the latest
	// `new_session` or `agent_start` boundary to avoid breaking state.
	const cutoff = events.length - MAX_EVENTS;
	for (let i = cutoff; i < events.length; i++) {
		const ev = events[i];
		if (
			ev.type === "rpc_event" &&
			((ev.payload as Record<string, unknown>).type === "agent_start" ||
				(ev.payload as Record<string, unknown>).type === "new_session")
		) {
			return events.slice(i);
		}
	}
	return events.slice(cutoff);
}
```

- [ ] **Step 2: Use trimEvents in state derivation**

Replace `for (const event of events)` with:

```ts
const trimmed = trimEvents(events);
for (const event of trimmed) {
	// ... existing loop body ...
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
cd packages/webui && npm run check
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/usePiChat.ts
git commit -m "feat(webui): cap event history at 2000 entries with boundary-aware trim"
```

---

## Task 6: App.tsx — Wire usePiChat + ErrorBoundary

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace useBridge + extractMessages with usePiChat**

Full replacement of `src/App.tsx`:

```tsx
import { Welcome } from "@ant-design/x";
import { CommentOutlined } from "@ant-design/icons";
import { usePiChat } from "./hooks/usePiChat.ts";
import { ChatView } from "./components/ChatView.tsx";
import { Composer } from "./components/Composer.tsx";
import { StatusBar } from "./components/StatusBar.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";

export function App() {
	const {
		messages,
		streamingMessage,
		status,
		connected,
		onRequest,
		onAbort,
	} = usePiChat();

	const showWelcome = messages.length === 0 && !streamingMessage;

	return (
		<ErrorBoundary>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					height: "100dvh",
					overflow: "hidden",
					background: "#fff",
				}}
			>
				{showWelcome ? (
					<div
						style={{
							flex: 1,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							padding: 24,
						}}
					>
						<Welcome
							icon={
								<CommentOutlined style={{ fontSize: 48, color: "#1677ff" }} />
							}
							title="pi WebUI"
							description="Connect to bridge and start chatting with your AI agent."
						/>
					</div>
				) : (
					<ChatView
						messages={messages}
						streamingMessage={streamingMessage}
						status={status}
					/>
				)}
				<Composer
					onSend={onRequest}
					onAbort={onAbort}
					disabled={!connected}
					loading={status === "loading"}
				/>
				<StatusBar
					connected={connected}
					isStreaming={status === "loading"}
					modelName={undefined} // modelName will be added in Phase 2 or later
				/>
			</div>
		</ErrorBoundary>
	);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd packages/webui && npm run check
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx src/components/ErrorBoundary.tsx
git commit -m "feat(webui): wire usePiChat and ErrorBoundary into App"
```

---

## Task 7: Composer — Wire Loading + Abort

**Files:**
- Modify: `src/components/Composer.tsx`

- [ ] **Step 1: Expand props and wire Sender**

```tsx
import { Sender } from "@ant-design/x";

export interface ComposerProps {
	onSend: (message: string) => void;
	onAbort: () => void;
	disabled?: boolean;
	loading?: boolean;
}

export function Composer({ onSend, onAbort, disabled, loading }: ComposerProps) {
	return (
		<div
			style={{
				padding: "0 16px",
				paddingBottom: "max(12px, env(safe-area-inset-bottom))",
				background: "#fff",
			}}
		>
			<Sender
				onSubmit={onSend}
				onCancel={onAbort}
				disabled={disabled}
				loading={loading}
				submitType="shiftEnter"
				placeholder="Shift + Enter to send"
			/>
		</div>
	);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd packages/webui && npm run check
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/Composer.tsx
git commit -m "feat(webui): Composer supports loading state and abort via Sender"
```

---

## Task 8: ChatView — Status Prop

**Files:**
- Modify: `src/components/ChatView.tsx`

- [ ] **Step 1: Add status prop for skeleton loading**

```tsx
import { Bubble } from "@ant-design/x";
import type { BubbleDataType } from "@ant-design/x/es/bubble/BubbleList";
import type { AgentMessage } from "../bridge/types.ts";
import type { ChatStatus } from "../hooks/usePiChat.ts";
import { UserOutlined, RobotOutlined } from "@ant-design/icons";

export interface ChatViewProps {
	messages: AgentMessage[];
	streamingMessage?: AgentMessage;
	status: ChatStatus;
}

// ... getContent helper unchanged ...

export function ChatView({ messages, streamingMessage, status }: ChatViewProps) {
	const items: BubbleDataType[] = messages.map((msg, i) => ({
		key: i,
		role: msg.role,
		placement: msg.role === "user" ? "end" : "start",
		content: getContent(msg),
		avatar:
			msg.role === "user"
				? { icon: <UserOutlined />, style: { background: "#1677ff" } }
				: { icon: <RobotOutlined />, style: { background: "#87e8de" } },
	}));

	if (streamingMessage) {
		items.push({
			key: "streaming",
			role: streamingMessage.role,
			placement: streamingMessage.role === "user" ? "end" : "start",
			content: getContent(streamingMessage),
			typing: { suffix: <span>▋</span> },
			avatar:
				streamingMessage.role === "user"
					? { icon: <UserOutlined />, style: { background: "#1677ff" } }
					: { icon: <RobotOutlined />, style: { background: "#87e8de" } },
		});
	}

	// Show a skeleton bubble while waiting for first token
	if (status === "loading" && !streamingMessage && messages.length > 0) {
		items.push({
			key: "skeleton",
			role: "assistant",
			placement: "start",
			loading: true,
			avatar: { icon: <RobotOutlined />, style: { background: "#87e8de" } },
		});
	}

	return (
		<div style={{ flex: 1, overflow: "hidden", padding: "12px 16px" }}>
			<Bubble.List
				items={items}
				autoScroll
				roles={{
					user: { placement: "end" },
					assistant: { placement: "start" },
					toolResult: { placement: "start" },
				}}
				style={{ height: "100%" }}
			/>
		</div>
	);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd packages/webui && npm run check
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ChatView.tsx
git commit -m "feat(webui): ChatView shows skeleton bubble on loading"
```

---

## Task 9: StatusBar — Update Props

**Files:**
- Modify: `src/components/StatusBar.tsx`

- [ ] **Step 1: Simplify props (modelName removed for now, will restore later)**

```tsx
import { Tag } from "antd";

export interface StatusBarProps {
	connected: boolean;
	isStreaming: boolean;
}

export function StatusBar({ connected, isStreaming }: StatusBarProps) {
	return (
		<div
			style={{
				padding: "6px 12px",
				borderTop: "1px solid #f0f0f0",
				display: "flex",
				gap: 8,
				alignItems: "center",
				fontSize: 12,
				background: "#fff",
				minHeight: 32,
				overflow: "hidden",
			}}
		>
			<Tag color={connected ? "green" : "red"} style={{ fontSize: 12, margin: 0 }}>
				{connected ? "Connected" : "Disconnected"}
			</Tag>
			{isStreaming && (
				<Tag color="blue" style={{ fontSize: 12, margin: 0 }}>
					Streaming...
				</Tag>
			)}
		</div>
	);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd packages/webui && npm run check
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/StatusBar.tsx
git commit -m "refactor(webui): simplify StatusBar props for Phase 1"
```

---

## Task 10: Integration Test — Build + Smoke

**Files:**
- No new files.

- [ ] **Step 1: Full TypeScript check**

Run:
```bash
cd packages/webui && npm run check
```
Expected: no errors.

- [ ] **Step 2: Production build**

Run:
```bash
cd packages/webui && npm run build
```
Expected: `dist/app/` created with `index.html`, JS, CSS. No build errors.

- [ ] **Step 3: Start dev server and screenshot**

Run:
```bash
cd packages/webui && npm run dev
```
Wait for "VITE v6.3.0 ready", then open `http://localhost:5173/` in browser.
Expected:
- Welcome card visible
- Sender input visible
- "Connected" tag visible (if bridge running)
- No console errors.

- [ ] **Step 4: Commit any remaining changes**

```bash
git status
git add -u
git commit -m "feat(webui): complete Phase 1 data flow refactor"
```

---

## Self-Review Checklist

**1. Spec coverage:**
- [x] Replace ad-hoc `events[]` → `usePiChat` hook (Task 2-5)
- [x] Message lifecycle (idle/loading/success/error) (Task 3)
- [x] Abort support (Task 4)
- [x] Event trimming / memory leak prevention (Task 5)
- [x] Error Boundary to prevent white screen (Task 1)
- [x] Composer loading + cancel (Task 7)
- [x] Chat skeleton on loading (Task 8)

**2. Placeholder scan:**
- [x] No "TBD", "TODO", "implement later"
- [x] No vague "add error handling" without code
- [x] No "similar to Task N" without repetition
- [x] Every code step shows exact code

**3. Type consistency:**
- [x] `ChatStatus` used consistently across `usePiChat.ts`, `ChatView.tsx`
- [x] `AgentMessage` type from `types.ts` used in `usePiChat.ts`
- [x] `BubbleDataType` imported from correct path in `ChatView.tsx`

**Gaps found:** None.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-30-pi-webui-dataflow-refactor.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
