import { Layout } from "antd";
import { useCallback, useEffect, useReducer, useRef } from "react";
import type { AgentMessage, RpcExtensionUIRequest, SessionStats, ToolCallState } from "../bridge/types.ts";
import { useBridge } from "../bridge/useBridge.ts";
import { ChatView } from "../components/ChatView.tsx";
import { Composer } from "../components/Composer.tsx";
import { StatusBar } from "../components/StatusBar.tsx";
import { Sidebar } from "./Sidebar.tsx";

interface AppState {
	messages: AgentMessage[];
	streamingMessage: AgentMessage | undefined;
	isStreaming: boolean;
	modelName: string | undefined;
	pendingExtension: RpcExtensionUIRequest | undefined;
	toolCalls: Map<string, ToolCallState>;
	thinkingLevel: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
	steeringMode: "all" | "one-at-a-time";
	autoCompaction: boolean;
	autoRetry: boolean;
	sidebarCollapsed: boolean;
	sessionStats: SessionStats | undefined;
}

type AppAction =
	| { type: "agent_start" }
	| { type: "agent_end" }
	| { type: "message_end"; message: AgentMessage }
	| { type: "message_update"; message: AgentMessage }
	| { type: "model_name"; name: string }
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
	sessionStats: undefined,
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
			if (data.model) dispatch({ type: "model_name", name: (data.model as Record<string, string>).name });
			dispatch({
				type: "state_update",
				thinkingLevel: (data.thinkingLevel ?? "off") as AppState["thinkingLevel"],
				steeringMode: (data.steeringMode ?? "all") as AppState["steeringMode"],
				autoCompaction: Boolean(data.autoCompactionEnabled),
				autoRetry: Boolean(data.autoRetryEnabled),
			});
		}
		if (resp.command === "get_session_stats" && resp.success) {
			dispatch({ type: "session_stats", stats: resp.data as SessionStats });
		}
	}
}

/** Extract working directory from session file path */
function extractCwd(sessionFile?: string): string | undefined {
	if (!sessionFile) return undefined;
	// Session file format: .../sessions/<encoded-path>/<uuid>.jsonl
	// The encoded path is the cwd with slashes replaced
	const parts = sessionFile.replace(/\\/g, "/").split("/");
	const sessionsIdx = parts.indexOf("sessions");
	if (sessionsIdx >= 0 && sessionsIdx + 1 < parts.length - 1) {
		// Decode the path: "--C--Users-65493-wxr-projects-pi--" -> "C:\Users\65493\wxr\projects\pi"
		const encoded = parts[sessionsIdx + 1];
		return encoded.replace(/^--/, "").replace(/--$/, "").replace(/-/g, "\\");
	}
	return undefined;
}

export function App() {
	const { connected, events, send } = useBridge();
	const [state, dispatch] = useReducer(appReducer, initialState);
	const processedCountRef = useRef(0);

	// Process ALL new events since last render, not just the last one
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
		// Fetch on connect
		try {
			send({ type: "get_session_stats" });
		} catch {
			/* ignore */
		}
		// Fetch every 10 seconds
		const interval = setInterval(() => {
			try {
				send({ type: "get_session_stats" });
			} catch {
				/* ignore */
			}
		}, 10_000);
		return () => clearInterval(interval);
	}, [connected, send]);

	const handleSend = useCallback(
		(message: string) => {
			try {
				send({ type: "prompt", message });
				// Don't dispatch user_message — pi echoes it back via message_end
			} catch {
				// Send failed (WebSocket not connected)
			}
		},
		[send],
	);

	const cwd = extractCwd(state.sessionStats?.sessionFile);

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
					sessionStats={state.sessionStats}
					cwd={cwd}
				/>
			</Layout>
		</Layout>
	);
}
