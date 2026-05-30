# Pi WebUI Phase 2 Design Spec — Rich Tool Rendering

## Goal

Add rich, contextual renderers for pi agent tool results inside the chat stream. Instead of plain text fallback, `read`, `edit`, `bash`, `askUser`, and `write` tool calls get dedicated UI components with syntax highlighting, diff views, and terminal styling.

## Architecture

```
ChatView (existing)
  └─ MessageBubble (existing)
       └─ ToolCallCard (NEW)
            ├─ ToolCallHeader (collapsed by default)
            │    ├─ Tool icon + name
            │    ├─ Argument summary
            │    └─ Status spinner / done badge
            └─ ToolResultBody (expanded)
                 ├─ ReadResult    → CodeBlock with syntax highlight
                 ├─ EditResult    → DiffView (side-by-side or inline)
                 ├─ BashResult    → TerminalOutput
                 ├─ AskUserResult → Inline form / modal
                 └─ WriteResult   → File creation notice
```

## Tech Stack Additions

- **Syntax highlighting**: `highlight.js` (already in coding-agent deps, reuse)
- **Diff rendering**: Custom component using `diff` package or pure CSS
- **Tool icon mapping**: Ant Design icons (`FileTextOutlined`, `CodeOutlined`, `TerminalOutlined`, `FormOutlined`, `EditOutlined`)

## Component Design

### ToolCallCard

Props:
```typescript
interface ToolCallCardProps {
  toolCallId: string;
  toolName: string;
  args: unknown;
  status: "pending" | "success" | "error";
  result?: AgentToolResult;
  isExpanded?: boolean;
}
```

- Collapsed state: single line with tool icon, name, and a one-line arg summary.
- Expanded state: shows the appropriate renderer based on `toolName`.
- Transition: `Collapse` animation from Ant Design.

### ReadResult → CodeBlock

Props:
```typescript
interface CodeBlockProps {
  content: string;
  filePath?: string;
  language?: string; // auto-detected from file extension
}
```

- Full-width card with file path header.
- `highlight.js` for syntax highlighting (lazy load language packs as needed).
- Copy-to-clipboard button.
- Line numbers (optional).

### EditResult → DiffView

Props:
```typescript
interface DiffViewProps {
  oldContent: string;
  newContent: string;
  filePath: string;
}
```

- Render line-by-line diff with colors:
  - Green background: added lines
  - Red background: removed lines
  - No background: unchanged context lines
- Collapse large unchanged hunks (show `...` with expand button).
- Side-by-side or unified view toggle (default: unified).

### BashResult → TerminalOutput

Props:
```typescript
interface TerminalOutputProps {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}
```

- Monospace font, dark background (`#1e1e1e`), ANSI color support (using `ansi-to-html` or simple regex).
- Command line shown in a distinct header bar.
- Exit code badge: green (0) or red (non-zero).
- Collapse output > 20 lines by default with "Show more".

### AskUserResult → InlineForm

Props:
```typescript
interface InlineFormProps {
  question: string;
  options?: string[]; // if select
  onSubmit: (value: string) => void;
}
```

- Rendered inline within the message bubble.
- If `options` provided: radio group or dropdown.
- If no options: free-text input + submit button.
- Submit sends an `extension_ui_response` back through the bridge.

### WriteResult → FileNotice

Props:
```typescript
interface FileNoticeProps {
  filePath: string;
  content: string;
}
```

- Simple card: "Created `path/to/file`" with a preview of the first few lines.
- "View full" button expands into a `CodeBlock`.

## Data Flow Changes

### Event → Component Mapping

| RPC Event Field | Renderer |
|---|---|
| `toolName === "read"` | `ReadResult` |
| `toolName === "edit"` | `EditResult` |
| `toolName === "bash"` | `BashResult` |
| `toolName === "askUser"` | `InlineForm` |
| `toolName === "write"` | `WriteResult` |
| Unknown tool | Plain text fallback (existing) |

### State Management

`useBridge` needs to track active tool calls separately from messages:

```typescript
interface ToolCallState {
  toolCallId: string;
  toolName: string;
  args: unknown;
  status: "pending" | "success" | "error";
  result?: unknown;
}

// Added to UseBridgeState
toolCalls: Map<string, ToolCallState>;
```

Events update this map:
- `tool_execution_start` → add to map with status "pending"
- `tool_execution_update` → update partial result
- `tool_execution_end` → set status + final result

## File Structure Additions

```
packages/webui/src/
├── components/
│   ├── tool-renderers/
│   │   ├── ToolCallCard.tsx
│   │   ├── CodeBlock.tsx
│   │   ├── DiffView.tsx
│   │   ├── TerminalOutput.tsx
│   │   ├── InlineForm.tsx
│   │   ├── FileNotice.tsx
│   │   └── index.ts          # barrel export
│   └── MessageBubble.tsx     # modified to embed ToolCallCard
├── utils/
│   ├── syntax-highlight.ts   # highlight.js wrapper
│   └── diff-parser.ts        # parse diff into line objects
```

## Error Handling

- **highlight.js language not loaded**: fallback to plain `<pre>`
- **Diff too large**: virtualize rendering or truncate with "Load full diff"
- **Terminal ANSI parse failure**: strip ANSI codes, render plain text
- **Tool result format unexpected**: fallback to JSON.stringify in a `<pre>`

## Out of Scope (Phase 3)

- Sidebar / session management
- Model configuration panel
- Theme switching
- Component library extraction
