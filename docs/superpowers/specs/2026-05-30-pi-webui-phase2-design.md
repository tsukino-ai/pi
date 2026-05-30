# Pi WebUI Phase 2 Design Spec — Rich Tool Rendering

## Goal

Add rich, contextual renderers for pi agent tool results inside the chat stream. Instead of plain text fallback, `read`, `edit`, `bash`, and `write` tool calls get dedicated UI components with syntax highlighting, diff views, and terminal styling.

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
                 └─ WriteResult   → File creation notice
```

## Tech Stack Additions

- **Syntax highlighting**: `highlight.js` (already in coding-agent deps, reuse)
- **Diff rendering**: `EditToolDetails.diff` is already a pre-formatted string from the agent; render it in a styled `<pre>` with diff coloring. For richer rendering, use the `diff` npm package to parse the patch.
- **Terminal ANSI**: `ansi-to-html` for ANSI escape code rendering
- **Tool icon mapping**: Ant Design icons (`FileTextOutlined`, `CodeOutlined`, `TerminalOutlined`, `EditOutlined`)

## RPC Event Flow

Tool calls arrive as three lifecycle events, forwarded from `AgentSessionEvent` through the RPC protocol:

```
tool_execution_start  → { toolCallId, toolName, args }
tool_execution_update → { toolCallId, toolName, args, partialResult }
tool_execution_end    → { toolCallId, toolName, result, isError }
```

Where `result` is `AgentToolResult<T>`:
```typescript
interface AgentToolResult<T> {
  content: (TextContent | ImageContent)[];  // text/image returned to model
  details: T;                                // tool-specific structured data
  terminate?: boolean;                       // early termination hint
}
```

Tool-specific `details` types:

| Tool | `details` type | Key fields |
|------|---------------|------------|
| `read` | `ReadToolDetails` | `truncation?: TruncationResult` |
| `edit` | `EditToolDetails` | `diff: string`, `patch: string`, `firstChangedLine?: number` |
| `bash` | `BashToolDetails` | `truncation?: TruncationResult`, `fullOutputPath?: string` |
| `write` | `undefined` | (no details) |
| `grep` | `GrepToolDetails` | search results |
| `find` | `FindToolDetails` | file matches |
| `ls` | `LsToolDetails` | directory listing |

The `result.content` array contains the text sent back to the LLM. For `bash`, this is stdout/stderr. For `read`, this is the file content. For `edit`, this is a confirmation message.

## Component Design

### ToolCallCard

Props:
```typescript
interface ToolCallCardProps {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  status: "pending" | "success" | "error";
  result?: AgentToolResult<unknown>;
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

**Data source:** Extract file content from `result.content[0].text` (the text returned to the LLM). File path comes from `args.path`.

### EditResult → DiffView

Props:
```typescript
interface DiffViewProps {
  diff: string;       // from EditToolDetails.diff
  patch?: string;     // from EditToolDetails.patch (standard unified diff)
  filePath?: string;
}
```

- Render the pre-formatted `diff` string from `EditToolDetails`.
- Color coding: green background for added lines, red for removed, none for context.
- Collapse large unchanged hunks (show `...` with expand button).
- Side-by-side or unified view toggle (default: unified).

**Data source:** `result.details.diff` is already formatted by the agent. `result.details.patch` is the standard unified patch for side-by-side view.

### BashResult → TerminalOutput

Props:
```typescript
interface TerminalOutputProps {
  command: string;
  output: string;     // from result.content[0].text
  isError: boolean;   // from tool_execution_end.isError
}
```

- Monospace font, dark background (`#1e1e1e`), ANSI color support via `ansi-to-html`.
- Command line shown in a distinct header bar.
- Exit code badge: green (not error) or red (error).
- Collapse output > 20 lines by default with "Show more".

**Data source:** `args.command` for the command, `result.content[0].text` for output, `isError` from the event.

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

**Data source:** `args.path` for the file path, `result.content[0].text` for the content preview.

## Data Flow Changes

### State Management

Add tool call tracking to `App.tsx`'s `useReducer`:

```typescript
interface ToolCallState {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  status: "pending" | "success" | "error";
  result?: AgentToolResult<unknown>;
}

// Added to ChatState
toolCalls: Map<string, ToolCallState>;
```

Events update this map via new reducer actions:

| Event | Action |
|-------|--------|
| `tool_execution_start` | Add to map with status `"pending"` |
| `tool_execution_update` | Update partial result |
| `tool_execution_end` | Set status + final result |

### Event → Component Mapping

| `toolName` | Renderer |
|---|---|
| `"read"` | `ReadResult` → `CodeBlock` |
| `"edit"` | `EditResult` → `DiffView` |
| `"bash"` | `BashResult` → `TerminalOutput` |
| `"write"` | `WriteResult` → `FileNotice` |
| `"grep"` / `"find"` / `"ls"` | Plain text fallback (Phase 2.x) |
| Unknown | Plain text fallback |

### Integration with Messages

`ToolCallCard` is embedded inside `MessageBubble` for assistant messages. When an assistant message contains tool calls in its `content` array (`{ type: "toolCall", name, arguments }`), the `MessageBubble` renders a `ToolCallCard` for each, linked by `toolCallId` to the corresponding entry in the `toolCalls` map.

## Interactive Prompts (extension_ui_request)

Interactive prompts (`select`, `confirm`, `input`, `editor`) are NOT tool calls — they come through the separate `extension_ui_request` RPC event. Phase 1 already handles the `notify` and `setStatus` methods. Phase 2 adds rendering for interactive methods:

| Method | UI |
|--------|-----|
| `select` | Radio group or dropdown with options |
| `confirm` | Yes/No buttons |
| `input` | Text input + submit |
| `editor` | Textarea with prefill |

Responses are sent back as `extension_ui_response` through the bridge.

## File Structure Additions

```
packages/webui/src/
├── components/
│   ├── tool-renderers/
│   │   ├── ToolCallCard.tsx
│   │   ├── CodeBlock.tsx
│   │   ├── DiffView.tsx
│   │   ├── TerminalOutput.tsx
│   │   ├── FileNotice.tsx
│   │   └── index.ts          # barrel export
│   ├── extension-ui/
│   │   ├── SelectDialog.tsx
│   │   ├── ConfirmDialog.tsx
│   │   ├── InputDialog.tsx
│   │   └── EditorDialog.tsx
│   └── MessageBubble.tsx     # modified to embed ToolCallCard
├── utils/
│   ├── syntax-highlight.ts   # highlight.js wrapper
│   └── ansi.ts               # ansi-to-html wrapper
```

## Package.json Changes

```json
{
  "dependencies": {
    "highlight.js": "11.11.1",
    "ansi-to-html": "0.7.2"
  }
}
```

## Error Handling

- **highlight.js language not loaded**: fallback to plain `<pre>`
- **Diff too large** (>1000 lines): truncate with "Load full diff" button
- **Terminal ANSI parse failure**: strip ANSI codes, render plain text
- **Tool result format unexpected**: fallback to `JSON.stringify(result)` in a `<pre>`
- **Bridge disconnects mid-tool-call**: show tool card with "Interrupted" status

## Out of Scope (Phase 3)

- Sidebar / session management
- Model configuration panel
- Theme switching
- Component library extraction
