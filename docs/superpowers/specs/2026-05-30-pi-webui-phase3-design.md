# Pi WebUI Phase 3 Design Spec — Full Feature Set + Component Library

## Goal

Complete the standalone web UI with session management, model configuration, theme switching, and HTML export. Then extract the reusable chat components into a publishable `@earendil-works/pi-webui` component library.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  App.tsx (layout shell)                                     │
│  ┌────────────┬─────────────────────────────────────────┐   │
│  │ Sidebar    │  ChatArea                               │   │
│  │            │  ┌───────────────────────────────────┐  │   │
│  │ - Sessions │  │ ChatView                          │  │   │
│  │ - Models   │  │ ├─ MessageBubble                  │  │   │
│  │ - Settings │  │ │  ├─ ToolCallCard                │  │   │
│  │            │  │ │  └─ ...                         │  │   │
│  │            │  │ └─ Composer                       │  │   │
│  │            │  └───────────────────────────────────┘  │   │
│  │            │  StatusBar                                │   │
│  └────────────┴─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Component Library Extraction

### What Gets Extracted

| Component | Library Export | Notes |
|---|---|---|
| `BridgeClient` | `@earendil-works/pi-webui/bridge` | WebSocket client + types |
| `useBridge` | `@earendil-works/pi-webui/bridge` | React hook |
| `ChatView` | `@earendil-works/pi-webui` | Message list container |
| `MessageBubble` | `@earendil-works/pi-webui` | Message renderer |
| `Composer` | `@earendil-works/pi-webui` | Input component |
| `ToolCallCard` | `@earendil-works/pi-webui` | Tool result cards |
| `CodeBlock` | `@earendil-works/pi-webui` | Syntax highlighted code |
| `DiffView` | `@earendil-works/pi-webui` | Diff renderer |
| `TerminalOutput` | `@earendil-works/pi-webui` | Terminal output |

### What Stays in the App

- `App.tsx` — layout shell with sidebar
- Sidebar components — session list, model selector, settings
- Theme provider — global Ant Design theme config
- Export logic — HTML generation

### Package Exports

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./bridge": {
      "types": "./dist/bridge.d.ts",
      "import": "./dist/bridge.js"
    }
  }
}
```

## Sidebar Design

### Session List

- Collapsible panel (Ant Design `Sider`).
- List of recent sessions with name + last message preview + timestamp.
- Context menu: Rename, Fork, Clone, Delete, Export HTML.
- "New Session" button at top.
- Search/filter input.

### Model Configuration

- Dropdown selector for model (populated via `get_available_models`).
- Thinking level toggle: off / minimal / low / medium / high / xhigh.
- Steering mode: all / one-at-a-time.
- Follow-up mode: all / one-at-a-time.
- Auto-compaction toggle.
- Auto-retry toggle.

### Settings

- Theme: Light / Dark / System.
- Bridge URL input (default `ws://localhost:8080`).
- pi CLI path input (for custom installations).

## Theme Switching

- Use Ant Design's `ConfigProvider` with dynamic `theme` prop.
- Store preference in `localStorage`.
- CSS variables for custom components to respect theme.

## HTML Export

- Reuse `packages/coding-agent/src/core/export-html/` logic where possible.
- Frontend triggers `export_html` RPC command, receives file path.
- Optional: download the generated HTML directly via a temporary HTTP endpoint in the bridge server.

## Component Library Build

- Vite library mode (`build.lib` in vite.config.ts).
- Externalize `react`, `react-dom`, `antd`, `@ant-design/x` as peer dependencies.
- Generate `.d.ts` declarations via `vite-plugin-dts`.

## File Structure (Final)

```
packages/webui/
├── src/
│   ├── index.ts              # library entry (exports)
│   ├── bridge/
│   │   ├── index.ts          # bridge barrel export
│   │   ├── types.ts
│   │   ├── client.ts
│   │   └── useBridge.ts
│   ├── components/
│   │   ├── index.ts          # component barrel export
│   │   ├── ChatView.tsx
│   │   ├── Composer.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── StatusBar.tsx
│   │   └── tool-renderers/
│   │       ├── index.ts
│   │       ├── ToolCallCard.tsx
│   │       ├── CodeBlock.tsx
│   │       ├── DiffView.tsx
│   │       ├── TerminalOutput.tsx
│   │       ├── InlineForm.tsx
│   │       └── FileNotice.tsx
│   ├── app/                  # standalone app only
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── Sidebar.tsx
│   │   ├── SessionList.tsx
│   │   ├── ModelConfig.tsx
│   │   ├── Settings.tsx
│   │   └── ThemeProvider.tsx
│   ├── utils/
│   │   ├── syntax-highlight.ts
│   │   └── diff-parser.ts
│   └── styles/
│       └── index.css
├── app.html                  # standalone app entry
├── lib.html                  # dev playground for library
├── bridge-server/            # unchanged from Phase 1
│   ├── index.ts
│   ├── server.ts
│   └── pi-process.ts
├── package.json              # updated exports + peerDeps
├── vite.config.ts            # dual config (app + lib)
├── tsconfig.json
└── test/
```

## Build Targets

| Target | Command | Output |
|---|---|---|
| App | `npm run build:app` | `dist/app/` |
| Library | `npm run build:lib` | `dist/lib/` |
| Bridge | `npm run build:bridge` | `dist/bridge-server/` |
| All | `npm run build` | all of above |

## Testing

- Component tests with `@testing-library/react` + vitest.
- Bridge integration tests (mock pi process).
- Theme switching test.
- Export HTML end-to-end test.
