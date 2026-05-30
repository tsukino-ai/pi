# Pi WebUI Complete Feature Implementation Design

## Goal

Implement ALL remaining pi RPC capabilities in the web UI, leveraging Ant Design X components for a polished chat experience.

## Ant Design X Component Mapping

| Feature | Ant Design X Component | Usage |
|---------|----------------------|-------|
| Message composer | `Sender` | Replace custom `Composer` with built-in Sender (supports loading, cancel, speech) |
| Message list | `Bubble.List` | Replace custom list with Bubble.List for better streaming support |
| Session list | `Conversations` | Replace custom list with built-in conversation switcher |
| Thinking process | `ThoughtChain` | Visualize thinking steps with collapsible chain |
| Stop generation | `Sender` loading state | Built-in cancel button when loading |
| Suggestions | `Prompts` | Show command suggestions |

## Feature List (All RPC Capabilities)

### Phase 1: Core Chat Experience

#### 1.1 Replace Composer with `Sender`

**Current:** Custom `Input.TextArea` + Button
**New:** Ant Design X `Sender` component

Benefits:
- Built-in loading state with cancel button
- Speech input support
- Paste file support
- Better keyboard handling

```tsx
<Sender
  value={text}
  onChange={setText}
  onSubmit={handleSend}
  onCancel={handleAbort}
  loading={isStreaming}
  placeholder="Type a message..."
/>
```

#### 1.2 Add Abort Command

**RPC:** `{ type: "abort" }`
**UI:** Cancel button appears when streaming (built into Sender)

#### 1.3 Replace MessageBubble with `Bubble.List`

**Current:** Custom message rendering
**New:** `Bubble.List` with `messageRender` for custom content

```tsx
<Bubble.List
  items={messages.map(msg => ({
    key: msg.id,
    content: msg.content,
    placement: msg.role === 'user' ? 'end' : 'start',
    avatar: msg.role === 'user' ? { icon: 'U' } : { icon: 'AI' },
    messageRender: (content) => <MessageRenderer message={msg} />,
  }))}
/>
```

#### 1.4 Thinking Process with `ThoughtChain`

**Data:** `thinking_start/thinking_delta/thinking_end` events
**UI:** Collapsible ThoughtChain component

```tsx
<ThoughtChain
  items={thinkingSteps.map(step => ({
    key: step.id,
    title: step.title,
    description: step.content,
    status: step.status, // 'pending' | 'success' | 'error'
  }))}
  collapsible
/>
```

### Phase 2: Session Management

#### 2.1 Replace SessionList with `Conversations`

**Current:** Custom List with Dropdown
**New:** Ant Design X `Conversations` component

```tsx
<Conversations
  items={sessions.map(s => ({
    key: s.id,
    label: s.name,
    description: s.lastMessage,
    timestamp: s.timestamp,
  }))}
  activeKey={currentSessionId}
  onActiveChange={handleSessionSwitch}
  menu={(item) => ({
    items: [
      { key: 'rename', label: 'Rename', icon: <EditOutlined /> },
      { key: 'fork', label: 'Fork', icon: <ForkOutlined /> },
      { key: 'export', label: 'Export HTML', icon: <DownloadOutlined /> },
    ],
    onClick: ({ key }) => handleSessionAction(key, item.key),
  })}
  groupable  // Group by date
/>
```

#### 2.2 Session Operations

| Operation | RPC Command | UI Location |
|-----------|-------------|-------------|
| New session | `new_session` | Header button |
| Switch session | `switch_session` | Click on conversation item |
| Rename | `set_session_name` | Context menu → inline edit |
| Fork | `fork` | Context menu |
| Clone | `clone` | Context menu |
| Export HTML | `export_html` | Context menu → download |

#### 2.3 Session Loading

**Current:** Only fetches from current directory
**New:** Load all sessions from `~/.pi/agent/sessions/`

**Bridge server change:** Add `list_sessions` command that scans session directory.

### Phase 3: Model & Configuration

#### 3.1 Available Models Dropdown

**RPC:** `get_available_models` → `{ models: Model[] }`
**UI:** Select dropdown in ModelConfig

```tsx
<Select
  value={currentModel?.id}
  options={availableModels.map(m => ({
    value: m.id,
    label: m.name,
  }))}
  onChange={(value) => send({ type: 'set_model', provider: '...', modelId: value })}
  onDropdownVisibleChange={(open) => {
    if (open) send({ type: 'get_available_models' });
  }}
/>
```

#### 3.2 Cycle Model

**RPC:** `cycle_model`
**UI:** Button or keyboard shortcut

#### 3.3 Cycle Thinking Level

**RPC:** `cycle_thinking_level`
**UI:** Button in ModelConfig

### Phase 4: Advanced Features

#### 4.1 Compact Context

**RPC:** `compact`
**UI:** Button in StatusBar or Sidebar

#### 4.2 Run Bash Command

**RPC:** `bash` → `{ command: string }`
**UI:** Command input in Sidebar or special mode

```tsx
<Input.Search
  placeholder="Run bash command..."
  onSearch={(cmd) => send({ type: 'bash', command: cmd })}
  enterButton="Run"
/>
```

#### 4.3 Abort Bash

**RPC:** `abort_bash`
**UI:** Cancel button when bash is running

#### 4.4 Steering Messages

**RPC:** `steer` / `follow_up`
**UI:** Special input mode or button

#### 4.5 Get Commands

**RPC:** `get_commands` → `{ commands: SlashCommand[] }`
**UI:** Command palette or slash command autocomplete

```tsx
// When user types "/", show command suggestions
<Sender
  onChange={(value) => {
    if (value.startsWith('/')) {
      send({ type: 'get_commands' });
      setShowCommandPalette(true);
    }
  }}
/>
{showCommandPalette && (
  <Prompts
    items={commands.map(cmd => ({
      key: cmd.name,
      label: `/${cmd.name}`,
      description: cmd.description,
    }))}
    onItemClick={(item) => {
      setText(`/${item.key} `);
      setShowCommandPalette(false);
    }}
  />
)}
```

#### 4.6 Tool Execution Updates

**Event:** `tool_execution_update`
**UI:** Progress bar in ToolCallCard

### Phase 5: Session Info Display

#### 5.1 Extended Session Stats

**RPC:** `get_session_stats`
**Display in StatusBar:**
- Token usage (input/output/cache)
- Cost
- Message count
- Session duration

#### 5.2 Session Name

**RPC:** `set_session_name`
**UI:** Editable session name in header

## File Structure

```
packages/webui/src/
├── app/
│   ├── App.tsx                    # Main layout with sidebar
│   ├── ThemeProvider.tsx          # Theme configuration
│   ├── Sidebar.tsx                # Tab navigation
│   ├── SessionList.tsx            # → Use Conversations component
│   ├── ModelConfig.tsx            # Model/thinking/mode controls
│   └── Settings.tsx               # Theme settings
├── components/
│   ├── ChatView.tsx               # → Use Bubble.List
│   ├── Composer.tsx               # → Replace with Sender
│   ├── MessageBubble.tsx          # → Message renderer for Bubble
│   ├── StatusBar.tsx              # Session stats display
│   ├── ThinkingProcess.tsx        # NEW: ThoughtChain wrapper
│   ├── CommandPalette.tsx         # NEW: Slash command suggestions
│   ├── BashTerminal.tsx           # NEW: Bash command input/output
│   └── tool-renderers/            # Tool result renderers
├── bridge/
│   ├── types.ts                   # RPC types
│   ├── client.ts                  # WebSocket client
│   └── useBridge.ts               # React hook
└── hooks/
    ├── useSessionManager.ts       # NEW: Session CRUD operations
    └── useModelManager.ts         # NEW: Model selection/cycling
```

## Implementation Order

1. **Replace Composer with Sender** - Immediate UX improvement
2. **Add abort support** - Critical for streaming
3. **Replace message list with Bubble.List** - Better streaming
4. **Add ThoughtChain for thinking** - Visual improvement
5. **Replace SessionList with Conversations** - Better session UX
6. **Add session operations** (rename, fork, clone, export)
7. **Add model dropdown with get_available_models**
8. **Add compact button**
9. **Add bash terminal**
10. **Add command palette**

## Bridge Server Changes

Add new command handler for `list_sessions`:

```typescript
// In server.ts, handle new command:
case 'list_sessions':
  const sessionsDir = path.join(os.homedir(), '.pi', 'agent', 'sessions');
  const sessions = scanSessions(sessionsDir);
  socket.send(JSON.stringify({ type: 'response', command: 'list_sessions', success: true, data: { sessions } }));
  break;
```

## Testing Strategy

- Unit tests for each new component
- Integration tests for RPC command flow
- E2E test for complete user journey
