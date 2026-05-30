# Pi WebUI Phase 3 Design Spec — Complete Standalone App

## Goal

Complete the standalone web UI with sidebar (session management, model configuration, settings), theme switching, and HTML export. Focus on shipping a polished standalone app — component library extraction is deferred to a future phase when there's a real consumer.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  App.tsx (layout shell)                                     │
│  ┌────────────┬─────────────────────────────────────────┐   │
│  │ Sidebar    │  ChatArea                               │   │
│  │            │  ┌───────────────────────────────────┐  │   │
│  │ - Sessions │  │ ChatView                          │  │   │
│  │ - Models   │  │ ├─ MessageBubble                  │  │   │
│  │ - Settings │  │ │  ├─ ToolCallCard (Phase 2)      │  │   │
│  │            │  │ │  └─ ...                         │  │   │
│  │            │  │ └─ Composer                       │  │   │
│  │            │  └───────────────────────────────────┘  │   │
│  │            │  StatusBar                                │   │
│  └────────────┴─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Component Design

### App.tsx — Layout Shell

Replace the current single-column layout with a sidebar + chat area:

```tsx
<Layout>
  <Sider collapsible collapsed={sidebarCollapsed} onCollapse={setSidebarCollapsed}>
    <Sidebar />
  </Sider>
  <Layout>
    <ChatView />
    <Composer />
    <StatusBar />
  </Layout>
</Layout>
```

### Sidebar

Three sections, each in a collapsible `Collapse.Panel`:

#### 1. Session List

- List of recent sessions with name + last message preview + timestamp.
- "New Session" button at top.
- Click to switch session.
- Each session item has a context menu with available actions.

**RPC mapping:**

| Action | RPC Command | Notes |
|--------|-------------|-------|
| Switch session | `switch_session` | Takes `sessionPath` |
| New session | `new_session` | Optionally with `parentSession` for fork |
| Rename | `set_session_name` | Takes `name` |
| Get messages | `get_messages` | Fetch full message history |

**Actions that need UX clarification:**

| Action | RPC Command | UX |
|--------|-------------|-----|
| Fork | `fork` | Takes `entryId`. User picks an entry from the current session to branch from. |
| Clone | `clone` | No params. Creates a copy of current session. |
| Export HTML | `export_html` | Returns `{ path }`. Bridge server could serve the file via HTTP for direct download. |

**Not available in RPC protocol (omit from UI):**

- Delete session — no `delete_session` command exists
- Session search/filter — client-side filtering of loaded session list

#### 2. Model Configuration

- Dropdown selector for model (populated via `get_available_models`).
- Thinking level toggle: off / minimal / low / medium / high / xhigh.
- Steering mode: all / one-at-a-time.
- Follow-up mode: all / one-at-a-time.
- Auto-compaction toggle.
- Auto-retry toggle.

**RPC mapping:**

| Control | RPC Command | Response |
|---------|-------------|----------|
| Model list | `get_available_models` | `{ models: Model[] }` |
| Set model | `set_model` | `{ provider, modelId }` |
| Cycle model | `cycle_model` | Next model in list |
| Thinking level | `set_thinking_level` | `{ level }` |
| Steering mode | `set_steering_mode` | `{ mode }` |
| Follow-up mode | `set_follow_up_mode` | `{ mode }` |
| Auto-compaction | `set_auto_compaction` | `{ enabled }` |
| Auto-retry | `set_auto_retry` | `{ enabled }` |

Current values are loaded from `get_state` on connect (already implemented in Phase 1).

#### 3. Settings

- Theme: Light / Dark / System.
- Bridge URL input (default `ws://localhost:8080`) — requires reconnect.
- pi CLI path (read-only display, configured via env var).

Settings are stored in `localStorage`.

### Sidebar Component

```typescript
interface SidebarProps {
  sessions: SessionInfo[];
  currentSessionId: string | undefined;
  models: Model[];
  currentModel: Model | undefined;
  thinkingLevel: ThinkingLevel;
  settings: AppSettings;
  onAction: (action: SidebarAction) => void;
}
```

## Theme Switching

Use Ant Design's `ConfigProvider` with dynamic `theme` prop:

```tsx
<ConfigProvider theme={{ algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm }}>
  <App />
</ConfigProvider>
```

- Store preference in `localStorage` key `pi-webui-theme`.
- Options: `"light"` | `"dark"` | `"system"` (follows `prefers-color-scheme`).
- No CSS variables needed — Ant Design's built-in theming handles all components.

## HTML Export

The `export_html` RPC command returns `{ path: string }` — the file is written to disk by the pi process. To make it accessible from the browser:

**Option A (recommended):** Bridge server serves a static file directory.
- Bridge server exposes `GET /exports/:filename` that serves from a temp directory.
- After `export_html` returns, the frontend constructs a download URL.
- Simple, no new dependencies.

**Option B:** Frontend re-fetches via a new `download_html` RPC command that returns the file content inline.
- More portable (no HTTP server needed in bridge).
- Large HTML files could be slow over WebSocket.

**Recommendation:** Option A for Phase 3. The bridge server already runs an HTTP-capable WebSocket server; adding a static file route is minimal work.

## State Management

Extend the existing `useReducer` in `App.tsx`:

```typescript
interface AppState {
  // Chat state (existing)
  messages: AgentMessage[];
  streamingMessage: AgentMessage | undefined;
  isStreaming: boolean;
  modelName: string | undefined;
  pendingExtension: RpcExtensionUIRequest | undefined;

  // Phase 3 additions
  sessions: SessionInfo[];
  currentSessionId: string | undefined;
  availableModels: Model[];
  currentModel: Model | undefined;
  thinkingLevel: ThinkingLevel;
  steeringMode: "all" | "one-at-a-time";
  followUpMode: "all" | "one-at-a-time";
  autoCompaction: boolean;
  autoRetry: boolean;
  sidebarCollapsed: boolean;
  theme: "light" | "dark" | "system";
}
```

Most of these are populated from the `get_state` response on connect, and updated via subsequent RPC responses.

## File Structure

```
packages/webui/src/
├── main.tsx
├── App.tsx                   # Layout shell (sidebar + chat)
├── bridge/
│   ├── types.ts
│   ├── client.ts
│   └── useBridge.ts
├── components/
│   ├── ChatView.tsx
│   ├── Composer.tsx
│   ├── MessageBubble.tsx
│   ├── StatusBar.tsx
│   ├── Sidebar.tsx           # NEW: sidebar container
│   ├── SessionList.tsx       # NEW: session list + actions
│   ├── ModelConfig.tsx       # NEW: model/thinking/mode controls
│   ├── Settings.tsx          # NEW: theme + bridge URL
│   └── tool-renderers/       # Phase 2
│       └── ...
├── hooks/
│   ├── useTheme.ts           # NEW: theme management with localStorage
│   └── useSettings.ts        # NEW: settings persistence
└── styles/
    └── index.css
```

## Build

No changes to build config. Phase 3 remains a single build target (`vite build` → `dist/app/`).

Component library extraction is deferred. When needed:
- Add `vite-plugin-dts` for `.d.ts` generation
- Add `build.lib` config to `vite.config.ts`
- Extract reusable components to `src/lib/` with barrel exports
- Externalize `react`, `react-dom`, `antd`, `@ant-design/x` as peer deps

## Testing

- **Sidebar rendering:** Mount with mock data, verify session list, model dropdown, settings.
- **Theme switching:** Toggle light/dark/system, verify `ConfigProvider` algorithm changes.
- **Session switching:** Click session item, verify `switch_session` RPC command sent, messages reload.
- **Model selection:** Select model, verify `set_model` RPC command sent with correct `provider` + `modelId`.
- **HTML export:** Mock `export_html` response, verify download link appears.

## Out of Scope (Future)

- Component library extraction (separate effort when there's a consumer)
- Session search/filter (client-side, can add incrementally)
- Keyboard shortcuts for sidebar actions
- Session deletion (requires RPC protocol addition)
- Multi-window / multi-tab support
