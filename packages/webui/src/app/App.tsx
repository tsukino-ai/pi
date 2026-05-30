import { Layout } from "antd";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { AgentMessage, Model, RpcExtensionUIRequest, SessionStats, ToolCallState } from "../bridge/types.ts";
import { useBridge } from "../bridge/useBridge.ts";
import { ChatView } from "../components/ChatView.tsx";
import { CommandPalette } from "../components/CommandPalette.tsx";
import { Composer } from "../components/Composer.tsx";
import { DirectoryPicker } from "../components/DirectoryPicker.tsx";
import { StatusBar } from "../components/StatusBar.tsx";
import type { Session } from "./SessionList.tsx";
import { Sidebar } from "./Sidebar.tsx";

interface Command {
	name: string;
	description?: string;
	source: string;
}

interface AppState {
	messages: AgentMessage[];
	streamingMessage: AgentMessage | undefined;
	isStreaming: boolean;
	modelName: string | undefined;
	currentModel: Model | undefined;
	pendingExtension: RpcExtensionUIRequest | undefined;
	toolCalls: Map<string, ToolCallState>;
	thinkingLevel: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
	steeringMode: "all" | "one-at-a-time";
	autoCompaction: boolean;
	autoRetry: boolean;
	sidebarCollapsed: boolean;
	sessionStats: SessionStats | undefined;
	availableModels: Model[];
	sessions: Session[];
	currentSessionId: string | undefined;
	bashOutput: string | undefined;
	bashIsRunning: boolean;
	commands: Command[];
}

type AppAction =
	| { type: "agent_start" }
	| { type: "agent_end" }
	| { type: "message_end"; message: AgentMessage }
	| { type: "message_update"; message: AgentMessage }
	| { type: "model_name"; name: string }
	| { type: "current_model"; model: Model }
	| { type: "extension_request"; request: RpcExtensionUIRequest }
	| { type: "extension_dismiss" }
	| { type: "tool_execution_start"; toolCallId: string; toolName: string; args: Record<string, unknown> }
	| { type: "tool_execution_end"; toolCallId: string; isError: boolean; result: ToolCallState["result"] }
	| {
			type: "state_update";
			thinkingLevel: AppState["thinkingLevel"];
			steeringMode: AppState["steeringMode"];
			autoCompaction: boolean;
			autoRetry: boolean;
	  }
	| { type: "session_stats"; stats: SessionStats }
	| { type: "available_models"; models: Model[] }
	| { type: "sessions"; sessions: Session[] }
	| { type: "current_session"; sessionId: string }
	| { type: "bash_output"; output: string; isError: boolean }
	| { type: "bash_done" }
	| { type: "commands"; commands: Command[] }
	| { type: "toggle_sidebar" };

const initialState: AppState = {
	messages: [],
	streamingMessage: undefined,
	isStreaming: false,
	modelName: undefined,
	currentModel: undefined,
	pendingExtension: undefined,
	toolCalls: new Map(),
	thinkingLevel: "off",
	steeringMode: "all",
	autoCompaction: true,
	autoRetry: true,
	sidebarCollapsed: false,
	sessionStats: undefined,
	availableModels: [],
	sessions: [],
	currentSessionId: undefined,
	bashOutput: undefined,
	bashIsRunning: false,
	commands: [],
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
		case "model_name":
			return { ...state, modelName: action.name };
		case "current_model":
			return { ...state, currentModel: action.model };
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
		case "session_stats":
			return { ...state, sessionStats: action.stats };
		case "available_models":
			return { ...state, availableModels: action.models };
		case "sessions":
			return { ...state, sessions: action.sessions };
		case "current_session":
			return { ...state, currentSessionId: action.sessionId };
		case "bash_output":
			return { ...state, bashOutput: action.output, bashIsRunning: true };
		case "bash_done":
			return { ...state, bashIsRunning: false };
		case "commands":
			return { ...state, commands: action.commands };
		case "toggle_sidebar":
			return { ...state, sidebarCollapsed: !state.sidebarCollapsed };
		default:
			return state;
	}
}

function processEvent(event: import("../bridge/client.ts").BridgeEvent, dispatch: React.Dispatch<AppAction>) {
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
			if (data.model) {
				dispatch({ type: "model_name", name: (data.model as Record<string, string>).name });
				dispatch({ type: "current_model", model: data.model as unknown as Model });
			}
			dispatch({
				type: "state_update",
				thinkingLevel: (data.thinkingLevel ?? "off") as AppState["thinkingLevel"],
				steeringMode: (data.steeringMode ?? "all") as AppState["steeringMode"],
				autoCompaction: Boolean(data.autoCompactionEnabled),
				autoRetry: Boolean(data.autoRetryEnabled),
			});
			if (data.sessionId) {
				dispatch({ type: "current_session", sessionId: String(data.sessionId) });
			}
		}
		if (resp.command === "get_session_stats" && resp.success) {
			dispatch({ type: "session_stats", stats: resp.data as SessionStats });
		}
		if (resp.command === "get_messages" && resp.success) {
			const data = resp.data as { messages: AgentMessage[] };
			if (data.messages) {
				for (const msg of data.messages) {
					dispatch({ type: "message_end", message: msg });
				}
			}
		}
		if (resp.command === "get_available_models" && resp.success) {
			const data = resp.data as { models: Model[] };
			if (data.models) {
				dispatch({ type: "available_models", models: data.models });
			}
		}
		if (resp.command === "get_commands" && resp.success) {
			const data = resp.data as { commands: Command[] };
			if (data.commands) {
				dispatch({ type: "commands", commands: data.commands });
			}
		}
		if (resp.command === "bash" && resp.success) {
			const data = resp.data as { stdout?: string; stderr?: string; exitCode?: number };
			dispatch({
				type: "bash_output",
				output: (data.stdout ?? "") + (data.stderr ? `\n${data.stderr}` : ""),
				isError: (data.exitCode ?? 0) !== 0,
			});
			dispatch({ type: "bash_done" });
		}
	}
}

/** Extract working directory from session file path */
function extractCwd(sessionFile?: string): string | undefined {
	if (!sessionFile) return undefined;
	const parts = sessionFile.replace(/\\/g, "/").split("/");
	const sessionsIdx = parts.indexOf("sessions");
	if (sessionsIdx >= 0 && sessionsIdx + 1 < parts.length - 1) {
		const encoded = parts[sessionsIdx + 1];
		return encoded.replace(/^--/, "").replace(/--$/, "").replace(/-/g, "\\");
	}
	return undefined;
}

export function App() {
	const { connected, events, send, waitingForDirectory, currentCwd, setWorkingDirectory, useTempWorkspace } =
		useBridge();
	const [state, dispatch] = useReducer(appReducer, initialState);
	const processedCountRef = useRef(0);
	const [commandPaletteVisible, setCommandPaletteVisible] = useState(false);

	// Process ALL new events since last render
	useEffect(() => {
		const newEvents = events.slice(processedCountRef.current);
		processedCountRef.current = events.length;
		for (const event of newEvents) {
			processEvent(event, dispatch);
		}
	}, [events]);

	// Fetch session stats periodically
	useEffect(() => {
		if (!connected) return;
		try {
			send({ type: "get_session_stats" });
		} catch {
			/* ignore */
		}
		const interval = setInterval(() => {
			try {
				send({ type: "get_session_stats" });
			} catch {
				/* ignore */
			}
		}, 10_000);
		return () => clearInterval(interval);
	}, [connected, send]);

	const handleAbort = useCallback(() => {
		try {
			send({ type: "abort" });
		} catch {
			/* ignore */
		}
	}, [send]);

	const handleSend = useCallback(
		(message: string) => {
			try {
				// Check for slash commands
				if (message.startsWith("/")) {
					const parts = message.slice(1).split(" ");
					const cmd = parts[0];
					const rest = parts.slice(1).join(" ");
					// Handle known commands
					if (cmd === "compact") {
						send({ type: "compact" });
						return;
					}
					if (cmd === "bash" && rest) {
						send({ type: "bash", command: rest });
						return;
					}
				}
				send({ type: "prompt", message });
			} catch {
				// Send failed
			}
		},
		[send],
	);

	const handleCommandSelect = useCallback(
		(command: string) => {
			setCommandPaletteVisible(false);
			// Insert command into composer or execute
			if (command === "compact") {
				try {
					send({ type: "compact" });
				} catch {
					/* ignore */
				}
			}
		},
		[send],
	);

	const handleSessionSwitch = useCallback(
		(sessionId: string) => {
			try {
				send({ type: "switch_session", sessionPath: sessionId });
			} catch {
				/* ignore */
			}
		},
		[send],
	);

	const cwd = currentCwd || extractCwd(state.sessionStats?.sessionFile);

	return (
		<Layout style={{ height: "100vh" }}>
			<DirectoryPicker visible={waitingForDirectory} onSelect={setWorkingDirectory} onUseTemp={useTempWorkspace} />
			{!state.sidebarCollapsed && (
				<Sidebar
					send={send}
					thinkingLevel={state.thinkingLevel}
					steeringMode={state.steeringMode}
					autoCompaction={state.autoCompaction}
					autoRetry={state.autoRetry}
					sessions={state.sessions}
					currentSessionId={state.currentSessionId}
					onSessionSwitch={handleSessionSwitch}
					currentModel={state.currentModel}
					availableModels={state.availableModels}
					bashOutput={state.bashOutput}
					bashIsRunning={state.bashIsRunning}
				/>
			)}
			<Layout>
				<CommandPalette
					visible={commandPaletteVisible}
					commands={state.commands}
					onSelect={handleCommandSelect}
					onClose={() => setCommandPaletteVisible(false)}
					send={send}
				/>
				<ChatView messages={state.messages} streamingMessage={state.streamingMessage} toolCalls={state.toolCalls} />
				<Composer onSend={handleSend} onCancel={handleAbort} disabled={!connected} loading={state.isStreaming} />
				<StatusBar
					connected={connected}
					isStreaming={state.isStreaming}
					modelName={state.modelName}
					onToggleSidebar={() => dispatch({ type: "toggle_sidebar" })}
					sessionStats={state.sessionStats}
					cwd={cwd}
					send={send}
				/>
			</Layout>
		</Layout>
	);
}
