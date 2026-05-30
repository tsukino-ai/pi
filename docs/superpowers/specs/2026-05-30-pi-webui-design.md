# Pi WebUI Design Spec

## Goal

Build a standalone browser-based Web UI for pi coding-agent, using Ant Design X as the component layer and the existing RPC mode (`pi --mode rpc`) as the backend protocol, bridged via a lightweight WebSocket server.

## Architecture

```
┌─────────────────────────────────────────────┐
│  Browser (React + Vite + Ant Design X)      │
│  - Chat view (Bubble, Conversations)        │
│  - Composer input                           │
│  - Status bar (model, tokens, streaming)    │
│  - Tool result cards (Phase 2)              │
└──────────────┬──────────────────────────────┘
               │ WebSocket (JSON messages)
┌──────────────▼──────────────────────────────┐
│  Bridge Server (Node + ws)                  │
│  - Spawns `pi --mode rpc` child process     │
│  - Forwards WebSocket ↔ stdin/stdout JSONL  │
│  - Manages process lifecycle                │
└──────────────┬──────────────────────────────┘
               │ stdin/stdout (JSON Lines)
┌──────────────▼──────────────────────────────┐
│  pi --mode rpc                              │
│  - Full coding-agent headless protocol      │
│  - Commands, responses, events, ext UI      │
└─────────────────────────────────────────────┘
```

## Tech Stack

- **Frontend**: React 19, Vite 6, TypeScript (strict), Ant Design X, Ant Design 5
- **Bridge**: Node.js, `ws` library, `node:child_process`
- **Protocol**: Reuse `packages/coding-agent/src/modes/rpc/rpc-types.ts`

## Monorepo Placement

New workspace package: `packages/webui`

```
packages/webui/
├── package.json              # Workspace dep, scripts: dev, build, check
├── tsconfig.json             # Extends root tsconfig.base.json
├── vite.config.ts            # Library + app dual build (Phase 1: app only)
├── index.html                # Vite entry
├── src/
│   ├── main.tsx              # React root render
│   ├── App.tsx               # Root layout (sidebar + chat area)
│   ├── bridge/
│   │   ├── types.ts          # Re-export / mirror of rpc-types.ts
│   │   ├── client.ts         # WebSocket client, exposes typed API
│   │   └── useBridge.ts      # React hook: bridge connection + state
│   ├── components/
│   │   ├── ChatView.tsx      # Message list + composer
│   │   ├── MessageBubble.tsx # Single message renderer (role, content, tool calls)
│   │   ├── Composer.tsx      # Input box + send button
│   │   └── StatusBar.tsx     # Model name, token stats, streaming indicator
│   └── styles/
│       └── index.css         # Minimal overrides on top of Ant Design X
├── bridge-server/
│   ├── server.ts             # WebSocket server entry
│   ├── pi-process.ts         # Spawn `pi --mode rpc`, JSONL framing
│   └── index.ts              # CLI entry: `node bridge-server/index.ts`
└── test/
    └── bridge-client.test.ts # Unit tests for bridge client logic
```

## Data Flow

### 1. Connection Establishment

1. User runs `npm run dev` in `packages/webui` — Vite dev server starts on `:5173`
2. Bridge server starts on `:8080` (separate process, started by dev script)
3. Frontend `useBridge` hook opens `ws://localhost:8080`
4. Bridge spawns `pi --mode rpc` (child process)
5. Bridge begins reading stdout JSONL lines and forwarding to WebSocket

### 2. Sending a Prompt

```
User types in Composer → Enter
  → useBridge.send({ type: "prompt", message: "..." })
  → WebSocket → Bridge → pi stdin
  → pi processes → stdout events
  → Bridge → WebSocket → useBridge.onMessage(event)
  → React state update → ChatView re-renders
```

### 3. Event Mapping

| RPC Event (`stdout`) | Frontend Action |
|---|---|
| `agent_start` | Set `isStreaming = true`, clear error |
| `turn_start` | Visual turn separator (optional) |
| `message_start` | Append empty message placeholder |
| `message_update` | Append delta text to streaming message |
| `message_end` | Finalize message, update token stats |
| `tool_execution_start` | Show tool call card (collapsed) |
| `tool_execution_end` | Expand tool call card with result |
| `turn_end` | — |
| `agent_end` | Set `isStreaming = false` |
| `extension_ui_request` | Render modal/dialog, await user response |

## Component Mapping (Ant Design X)

| UI Element | Ant Design X Component | Customization |
|---|---|---|
| Message list | `Conversations` / `Bubble.List` | Custom item renderer per role |
| User message | `Bubble` | Plain text, right-aligned |
| Assistant message | `Bubble` | Markdown rendering, streaming cursor |
| Tool call card | Custom card inside `Bubble` | Collapsible, icon per tool |
| Input box | `Sender` (or custom `Input.TextArea`) | Send button, Ctrl+Enter |
| Status bar | Custom footer | Model name, token count, cost |
| Extension dialog | `Modal` / custom | select/confirm/input/editor |

## Error Handling

| Scenario | Behavior |
|---|---|
| Bridge disconnects | Show reconnect banner, auto-retry with backoff |
| `pi` process crashes | Bridge kills zombie, respawns, frontend shows error toast |
| RPC error response | Toast notification with `error` field |
| Browser cannot connect to Bridge | Clear error message: "Bridge server not running. Run `npm run bridge`" |

## Phase 1 Scope (This Spec)

- Bridge server: WebSocket ↔ JSONL stdin/stdout
- Frontend: Connect, send prompt, render message stream
- Basic status bar (model name, streaming indicator)
- No tool result rendering (text-only fallback)
- No sidebar, no session management, no config panel

## Out of Scope (Phase 2+)

- Rich tool renderers (diff, file tree, terminal output)
- Session list / fork / clone / switch
- Model/thinking level configuration panel
- Theme switching
- Export to HTML
- Component library extraction

## Testing

- Bridge server: Spawn a mock child process (echo JSONL), verify WebSocket round-trip
- Frontend: Render `ChatView` with mock messages, verify Bubble count
- Integration: Start bridge + mock pi process, send prompt via WebSocket, assert event sequence
