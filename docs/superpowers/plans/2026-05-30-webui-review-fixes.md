# Pi WebUI Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all Critical and Important issues identified in the Phase 1 webui code review, plus selected Minor issues.

**Architecture:** Each task is self-contained and produces a compilable, testable state. Tasks are ordered by dependency: type system first (touches all files), then functional fixes, then infrastructure.

**Tech Stack:** TypeScript, React 19, Vite 6, Ant Design X, ws, vitest

---

## File Map

| File | Changes |
|------|---------|
| `packages/webui/package.json` | Add `@earendil-works/pi-coding-agent` devDep, add `jsdom` devDep |
| `packages/webui/tsconfig.json` | Add `@earendil-works/pi-coding-agent` to `types` if needed |
| `packages/webui/src/bridge/types.ts` | Replace manual types with imports from existing packages; keep only unexported types |
| `packages/webui/src/bridge/client.ts` | Add backoff reconnect, non-JSON logging |
| `packages/webui/src/bridge/useBridge.ts` | Send `get_state` on connect, bound event list, add `clearEvents` |
| `packages/webui/src/App.tsx` | Use incremental state instead of `extractMessages`, show user messages immediately, handle `extension_ui_request` |
| `packages/webui/src/components/MessageBubble.tsx` | Better content fallback |
| `packages/webui/src/components/StatusBar.tsx` | No changes expected |
| `packages/webui/src/components/Composer.tsx` | No changes expected |
| `packages/webui/vite.config.ts` | Fix proxy path or remove dead proxy config |
| `packages/webui/test/bridge-client.test.ts` | Rewrite with proper WebSocket mock |
| `packages/webui/.gitignore` | Create (dist, node_modules) |

---

### Task 1: Add dependencies to package.json

**Files:**
- Modify: `packages/webui/package.json`

- [ ] **Step 1: Add `@earendil-works/pi-coding-agent` and `jsdom` to devDependencies**

```jsonc
// In packages/webui/package.json, add to devDependencies:
"@earendil-works/pi-coding-agent": "^0.78.0",
"jsdom": "26.1.0",
```

Full devDependencies block after edit:

```json
{
  "devDependencies": {
    "@earendil-works/pi-agent-core": "^0.78.0",
    "@earendil-works/pi-ai": "^0.78.0",
    "@earendil-works/pi-coding-agent": "^0.78.0",
    "@types/node": "24.12.4",
    "@types/react": "19.2.15",
    "@types/react-dom": "19.2.3",
    "@types/ws": "8.18.1",
    "@vitejs/plugin-react": "4.4.0",
    "concurrently": "10.0.0",
    "jsdom": "26.1.0",
    "shx": "0.4.0",
    "tsx": "4.22.3",
    "typescript": "5.9.3",
    "vite": "6.3.0",
    "vitest": "3.2.4"
  }
}
```

- [ ] **Step 2: Run `npm install --ignore-scripts` from repo root**

Run: `npm install --ignore-scripts`
Expected: Lockfile updates, no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/webui/package.json package-lock.json
git commit -m "chore(webui): add pi-coding-agent and jsdom dependencies"
```

---

### Task 2: Replace manual types with imports

**Files:**
- Modify: `packages/webui/src/bridge/types.ts`

The canonical types live in three places:
- `@earendil-works/pi-coding-agent`: exports `RpcCommand`, `RpcResponse`, `RpcSessionState`
- `@earendil-works/pi-agent-core`: exports `ThinkingLevel`, `AgentMessage`
- `@earendil-works/pi-ai`: exports `ImageContent`, `Model`

Types NOT exported from any package (keep manually): `RpcExtensionUIRequest`, `RpcExtensionUIResponse`, `RpcCommandType`, `RpcSlashCommand`.

- [ ] **Step 1: Rewrite `types.ts`**

Replace the entire file with:

```ts
// Re-export canonical types from existing packages.
export type { RpcCommand, RpcResponse, RpcSessionState } from "@earendil-works/pi-coding-agent";
export type { AgentMessage, ThinkingLevel } from "@earendil-works/pi-agent-core";
export type { ImageContent, Model } from "@earendil-works/pi-ai";

// Types not exported from coding-agent — mirror manually.
// Keep in sync with packages/coding-agent/src/modes/rpc/rpc-types.ts

export type RpcExtensionUIRequest =
  | { type: "extension_ui_request"; id: string; method: "select"; title: string; options: string[]; timeout?: number }
  | { type: "extension_ui_request"; id: string; method: "confirm"; title: string; message: string; timeout?: number }
  | { type: "extension_ui_request"; id: string; method: "input"; title: string; placeholder?: string; timeout?: number }
  | { type: "extension_ui_request"; id: string; method: "editor"; title: string; prefill?: string }
  | { type: "extension_ui_request"; id: string; method: "notify"; message: string; notifyType?: "info" | "warning" | "error" }
  | { type: "extension_ui_request"; id: string; method: "setStatus"; statusKey: string; statusText: string | undefined }
  | { type: "extension_ui_request"; id: string; method: "setWidget"; widgetKey: string; widgetLines: string[] | undefined; widgetPlacement?: "aboveEditor" | "belowEditor" }
  | { type: "extension_ui_request"; id: string; method: "setTitle"; title: string }
  | { type: "extension_ui_request"; id: string; method: "set_editor_text"; text: string };

export type RpcExtensionUIResponse =
  | { type: "extension_ui_response"; id: string; value: string }
  | { type: "extension_ui_response"; id: string; confirmed: boolean }
  | { type: "extension_ui_response"; id: string; cancelled: true };

export type RpcCommandType = RpcCommand["type"];
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/webui && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Fix any import issues**

If `@earendil-works/pi-coding-agent` doesn't resolve (workspace linking issue), check that `packages/coding-agent/package.json` exports include the types. If needed, adjust the import to use the source path directly:

```ts
// Fallback if workspace resolution fails:
export type { RpcCommand, RpcResponse, RpcSessionState } from "../../coding-agent/src/modes/rpc/rpc-types.ts";
```

- [ ] **Step 4: Commit**

```bash
git add packages/webui/src/bridge/types.ts
git commit -m "refactor(webui): import canonical types from existing packages"
```

---

### Task 3: Send `get_state` on connect

**Files:**
- Modify: `packages/webui/src/bridge/useBridge.ts`

- [ ] **Step 1: Add `get_state` dispatch after connection**

In `useBridge.ts`, modify the `connected` event handler to send `get_state`:

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import { BridgeClient, type BridgeEvent } from "./client.ts";
import type { RpcCommand } from "./types.ts";

export interface UseBridgeState {
  connected: boolean;
  events: BridgeEvent[];
  send: (command: RpcCommand) => void;
  clearEvents: () => void;
}

export function useBridge(url = "ws://localhost:8080"): UseBridgeState {
  const clientRef = useRef<BridgeClient>(new BridgeClient(url));
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<BridgeEvent[]>([]);

  useEffect(() => {
    const client = clientRef.current;
    client.connect();

    const unsubscribe = client.subscribe((event) => {
      if (event.type === "connected") {
        setConnected(true);
        // Request initial state so StatusBar can display model name
        try {
          client.send({ type: "get_state" });
        } catch {
          // Will retry on next reconnect
        }
      } else if (event.type === "disconnected") {
        setConnected(false);
      }
      setEvents((prev) => [...prev, event]);
    });

    return () => {
      unsubscribe();
      client.disconnect();
    };
  }, [url]);

  const send = useCallback((command: RpcCommand) => {
    clientRef.current.send(command);
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return { connected, events, send, clearEvents };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/webui && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/webui/src/bridge/useBridge.ts
git commit -m "feat(webui): send get_state on connect for model name display"
```

---

### Task 4: Add reconnect backoff and non-JSON logging

**Files:**
- Modify: `packages/webui/src/bridge/client.ts`

- [ ] **Step 1: Implement exponential backoff**

Replace the `onclose` handler and add backoff state:

```ts
import type { RpcCommand, RpcResponse } from "./types.ts";

export type BridgeEvent =
  | { type: "rpc_response"; payload: RpcResponse }
  | { type: "rpc_event"; payload: unknown }
  | { type: "bridge_error"; message: string }
  | { type: "connected" }
  | { type: "disconnected" };

export class BridgeClient {
  private ws: WebSocket | undefined;
  private callbacks = new Set<(event: BridgeEvent) => void>();
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private url: string;
  private shouldReconnect = true;
  private reconnectDelay = 1000; // Start at 1s
  private readonly maxReconnectDelay = 30_000; // Cap at 30s

  constructor(url = "ws://localhost:8080") {
    this.url = url;
  }

  connect(): void {
    this.shouldReconnect = true;
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.emit({ type: "connected" });
      this.reconnectDelay = 1000; // Reset on successful connect
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = undefined;
      }
    };

    this.ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(String(ev.data));
        if (data.type === "line") {
          const payload = data.data;
          if (payload && typeof payload === "object") {
            if (payload.type === "response") {
              this.emit({ type: "rpc_response", payload: payload as RpcResponse });
            } else {
              this.emit({ type: "rpc_event", payload });
            }
          }
        } else if (data.type === "bridge_error") {
          this.emit({ type: "bridge_error", message: data.message });
        } else {
          this.emit({ type: "rpc_event", payload: data });
        }
      } catch {
        console.warn("[bridge] Non-JSON message from server:", String(ev.data).slice(0, 200));
      }
    };

    this.ws.onclose = () => {
      this.emit({ type: "disconnected" });
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
          this.connect();
        }, this.reconnectDelay);
      }
    };

    this.ws.onerror = () => {
      this.emit({ type: "bridge_error", message: "WebSocket error" });
    };
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.ws?.close();
  }

  send(command: RpcCommand): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }
    this.ws.send(JSON.stringify(command));
  }

  subscribe(callback: (event: BridgeEvent) => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private emit(event: BridgeEvent): void {
    for (const cb of this.callbacks) {
      cb(event);
    }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/webui && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/webui/src/bridge/client.ts
git commit -m "feat(webui): exponential reconnect backoff and non-JSON logging"
```

---

### Task 5: Rewrite App.tsx with incremental state and extension_ui handling

**Files:**
- Modify: `packages/webui/src/App.tsx`

- [ ] **Step 1: Replace extractMessages with useReducer-based state**

This fixes: O(n^2) event scanning, missing user message display, missing extension_ui_request handling.

```tsx
import { useCallback, useEffect, useReducer } from "react";
import { useBridge } from "./bridge/useBridge.ts";
import type { AgentMessage, RpcExtensionUIRequest } from "./bridge/types.ts";
import { ChatView } from "./components/ChatView.tsx";
import { Composer } from "./components/Composer.tsx";
import { StatusBar } from "./components/StatusBar.tsx";

interface ChatState {
  messages: AgentMessage[];
  streamingMessage: AgentMessage | undefined;
  isStreaming: boolean;
  modelName: string | undefined;
  pendingExtension: RpcExtensionUIRequest | undefined;
}

type ChatAction =
  | { type: "agent_start" }
  | { type: "agent_end" }
  | { type: "message_end"; message: AgentMessage }
  | { type: "message_update"; message: AgentMessage }
  | { type: "user_message"; message: AgentMessage }
  | { type: "model_name"; name: string }
  | { type: "extension_request"; request: RpcExtensionUIRequest }
  | { type: "extension_dismiss" };

const initialState: ChatState = {
  messages: [],
  streamingMessage: undefined,
  isStreaming: false,
  modelName: undefined,
  pendingExtension: undefined,
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "agent_start":
      return { ...state, isStreaming: true };
    case "agent_end":
      return { ...state, isStreaming: false, streamingMessage: undefined };
    case "message_end":
      return {
        ...state,
        messages: [...state.messages, action.message],
        streamingMessage: undefined,
      };
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
    default:
      return state;
  }
}

export function App() {
  const { connected, events, send } = useBridge();
  const [state, dispatch] = useReducer(chatReducer, initialState);

  // Process new events incrementally
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
          if (payload.message) {
            dispatch({ type: "message_end", message: payload.message as AgentMessage });
          }
          break;
        case "message_update":
          if (payload.message) {
            dispatch({ type: "message_update", message: payload.message as AgentMessage });
          }
          break;
        case "extension_ui_request":
          dispatch({ type: "extension_request", request: payload as unknown as RpcExtensionUIRequest });
          break;
      }
    }

    if (event.type === "rpc_response") {
      const resp = event.payload as Record<string, unknown>;
      if (resp.command === "get_state" && resp.success) {
        const data = resp.data as { model?: { name?: string } };
        if (data.model?.name) {
          dispatch({ type: "model_name", name: data.model.name });
        }
      }
    }
  }, [events]);

  const handleSend = useCallback(
    (message: string) => {
      // Show user message immediately
      dispatch({
        type: "user_message",
        message: {
          role: "user",
          content: message,
          timestamp: Date.now(),
        },
      });
      send({ type: "prompt", message });
    },
    [send],
  );

  const handleExtensionDismiss = useCallback(() => {
    dispatch({ type: "extension_dismiss" });
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <ChatView
        messages={state.messages}
        streamingMessage={state.streamingMessage}
      />
      <Composer
        onSend={handleSend}
        disabled={!connected || state.isStreaming}
      />
      <StatusBar
        connected={connected}
        isStreaming={state.isStreaming}
        modelName={state.modelName}
      />
      {state.pendingExtension && (
        <div style={{ padding: 12, background: "#fffbe6", borderTop: "1px solid #ffe58f" }}>
          <span>Extension request: {state.pendingExtension.method}</span>
          <button onClick={handleExtensionDismiss} style={{ marginLeft: 8 }}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/webui && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/webui/src/App.tsx
git commit -m "refactor(webui): incremental state, user message display, extension_ui placeholder"
```

---

### Task 6: Fix MessageBubble content fallback

**Files:**
- Modify: `packages/webui/src/components/MessageBubble.tsx`

- [ ] **Step 1: Add fallback for unknown content types**

```tsx
import { Bubble } from "@ant-design/x";
import type { AgentMessage } from "../bridge/types.ts";

export interface MessageBubbleProps {
  message: AgentMessage;
  isStreaming?: boolean;
}

function getMessageContent(msg: AgentMessage): string {
  if (typeof msg.content === "string") return msg.content;
  if (!Array.isArray(msg.content)) return JSON.stringify(msg.content);

  return msg.content
    .map((c) => {
      if (c.type === "text") return c.text ?? "";
      if (c.type === "toolCall") return `Tool call: ${c.name ?? "unknown"}`;
      // Fallback: show type so unknown content isn't silently dropped
      return `[${c.type}]`;
    })
    .join("\n");
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const placement = message.role === "user" ? "end" : "start";
  const content = getMessageContent(message);

  return (
    <Bubble
      placement={placement}
      content={content + (isStreaming ? "▋" : "")}
      avatar={message.role === "user" ? { icon: "U" } : { icon: "AI" }}
    />
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/webui && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/webui/src/components/MessageBubble.tsx
git commit -m "fix(webui): fallback for unknown message content types"
```

---

### Task 7: Fix Vite proxy mismatch

**Files:**
- Modify: `packages/webui/vite.config.ts`

The frontend connects directly to `ws://localhost:8080`, bypassing the Vite dev server entirely. The `/api` proxy config is dead code. Two options:

**Option A (recommended):** Remove the proxy, document that bridge runs on :8080 separately.
**Option B:** Route frontend through Vite proxy by changing `useBridge` default URL.

Going with Option A — simpler, matches the `concurrently` dev script design.

- [ ] **Step 1: Remove dead proxy config**

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: ".",
  build: {
    outDir: "dist/app",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/webui && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/webui/vite.config.ts
git commit -m "fix(webui): remove dead vite proxy config"
```

---

### Task 8: Add package-level .gitignore

**Files:**
- Create: `packages/webui/.gitignore`

- [ ] **Step 1: Create .gitignore**

```
dist/
node_modules/
*.tsbuildinfo
```

- [ ] **Step 2: Commit**

```bash
git add packages/webui/.gitignore
git commit -m "chore(webui): add package-level gitignore"
```

---

### Task 9: Rewrite tests

**Files:**
- Modify: `packages/webui/test/bridge-client.test.ts`

The current tests directly manipulate private internals and don't test real behavior. Rewrite to use a proper mock WebSocket or test the public API surface.

- [ ] **Step 1: Rewrite bridge-client.test.ts**

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { BridgeClient, type BridgeEvent } from "../src/bridge/client.ts";

// Minimal WebSocket mock that exercises the real callback paths
class MockWebSocket {
  static instances: MockWebSocket[] = [];

  readyState = 1; // OPEN
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  sent: string[] = [];

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
    // Simulate async connect
    queueMicrotask(() => this.onopen?.(new Event("open")));
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3; // CLOSED
    this.onclose?.(new CloseEvent("close"));
  }

  // Helper to simulate receiving a message
  receiveMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  // Helper to simulate an error
  simulateError() {
    this.onerror?.(new Event("error"));
  }
}

describe("BridgeClient", () => {
  let originalWebSocket: typeof globalThis.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    originalWebSocket = globalThis.WebSocket;
    // @ts-expect-error Mock replacement
    globalThis.WebSocket = MockWebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
  });

  it("emits connected event on open", async () => {
    const client = new BridgeClient("ws://localhost:9999");
    const events: BridgeEvent[] = [];
    client.subscribe((e) => events.push(e));
    client.connect();

    // Wait for microtask (mock connect)
    await vi.waitFor(() => {
      expect(events.some((e) => e.type === "connected")).toBe(true);
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("connected");
    client.disconnect();
  });

  it("emits disconnected event on close", async () => {
    const client = new BridgeClient("ws://localhost:9999");
    const events: BridgeEvent[] = [];
    client.subscribe((e) => events.push(e));
    client.connect();

    await vi.waitFor(() => {
      expect(events.some((e) => e.type === "connected")).toBe(true);
    });

    const ws = MockWebSocket.instances[0]!;
    ws.close();

    expect(events.some((e) => e.type === "disconnected")).toBe(true);
  });

  it("parses rpc_response from line event", async () => {
    const client = new BridgeClient("ws://localhost:9999");
    const events: BridgeEvent[] = [];
    client.subscribe((e) => events.push(e));
    client.connect();

    await vi.waitFor(() => {
      expect(events.some((e) => e.type === "connected")).toBe(true);
    });

    const ws = MockWebSocket.instances[0]!;
    ws.receiveMessage({
      type: "line",
      data: { type: "response", command: "prompt", success: true },
    });

    const rpcEvents = events.filter((e) => e.type === "rpc_response");
    expect(rpcEvents).toHaveLength(1);
    expect(rpcEvents[0]).toEqual({
      type: "rpc_response",
      payload: { type: "response", command: "prompt", success: true },
    });

    client.disconnect();
  });

  it("emits rpc_event for non-response payloads", async () => {
    const client = new BridgeClient("ws://localhost:9999");
    const events: BridgeEvent[] = [];
    client.subscribe((e) => events.push(e));
    client.connect();

    await vi.waitFor(() => {
      expect(events.some((e) => e.type === "connected")).toBe(true);
    });

    const ws = MockWebSocket.instances[0]!;
    ws.receiveMessage({
      type: "line",
      data: { type: "agent_start" },
    });

    const rpcEvents = events.filter((e) => e.type === "rpc_event");
    expect(rpcEvents).toHaveLength(1);
    expect((rpcEvents[0] as { payload: { type: string } }).payload.type).toBe("agent_start");

    client.disconnect();
  });

  it("emits bridge_error for bridge error messages", async () => {
    const client = new BridgeClient("ws://localhost:9999");
    const events: BridgeEvent[] = [];
    client.subscribe((e) => events.push(e));
    client.connect();

    await vi.waitFor(() => {
      expect(events.some((e) => e.type === "connected")).toBe(true);
    });

    const ws = MockWebSocket.instances[0]!;
    ws.receiveMessage({ type: "bridge_error", message: "test error" });

    const errorEvents = events.filter((e) => e.type === "bridge_error");
    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0]).toEqual({ type: "bridge_error", message: "test error" });

    client.disconnect();
  });

  it("throws when sending while disconnected", () => {
    const client = new BridgeClient("ws://localhost:9999");
    // Never called connect(), so ws is undefined
    expect(() => client.send({ type: "prompt", message: "test" })).toThrow(
      "WebSocket not connected",
    );
  });

  it("unsubscribe stops receiving events", async () => {
    const client = new BridgeClient("ws://localhost:9999");
    const events: BridgeEvent[] = [];
    const unsub = client.subscribe((e) => events.push(e));
    client.connect();

    await vi.waitFor(() => {
      expect(events.some((e) => e.type === "connected")).toBe(true);
    });

    unsub();
    events.length = 0;

    const ws = MockWebSocket.instances[0]!;
    ws.receiveMessage({ type: "line", data: { type: "agent_start" } });

    expect(events).toHaveLength(0);
    client.disconnect();
  });

  it("emits bridge_error on WebSocket error", async () => {
    const client = new BridgeClient("ws://localhost:9999");
    const events: BridgeEvent[] = [];
    client.subscribe((e) => events.push(e));
    client.connect();

    await vi.waitFor(() => {
      expect(events.some((e) => e.type === "connected")).toBe(true);
    });

    const ws = MockWebSocket.instances[0]!;
    ws.simulateError();

    const errorEvents = events.filter((e) => e.type === "bridge_error");
    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0]).toEqual({ type: "bridge_error", message: "WebSocket error" });

    client.disconnect();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd packages/webui && npx vitest --run`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/webui/test/bridge-client.test.ts
git commit -m "test(webui): rewrite bridge client tests with proper WebSocket mock"
```

---

### Task 10: Verify everything compiles and tests pass

- [ ] **Step 1: Run TypeScript check**

Run: `cd packages/webui && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 2: Run tests**

Run: `cd packages/webui && npx vitest --run`
Expected: All tests pass.

- [ ] **Step 3: Run biome check on webui files**

Run: `npx biome check --write packages/webui/`
Expected: No errors (auto-fixes formatting if needed).

- [ ] **Step 4: Final commit (if biome made changes)**

```bash
git add -u packages/webui/
git commit -m "style(webui): biome formatting fixes"
```

---

## Spec Coverage Check

| Spec Requirement | Task |
|---|---|
| Bridge server: WebSocket <-> JSONL | Already implemented, no changes needed |
| Frontend: Connect, send prompt, render stream | Tasks 3, 5 |
| Basic status bar (model name, streaming) | Task 3 (get_state enables model name) |
| Error handling: bridge disconnects | Task 4 (backoff reconnect) |
| Error handling: pi crashes | Already handled (PiProcess exit event) |
| Error handling: RPC error | Already handled in client.ts |
| Error handling: cannot connect | Task 4 (reconnect with backoff) |
| Testing: Bridge server round-trip | Task 9 (client-side mock tests) |
