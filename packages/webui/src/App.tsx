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

	// Process only the latest event (incremental, not full scan)
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
					dispatch({
						type: "extension_request",
						request: payload as unknown as RpcExtensionUIRequest,
					});
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
			dispatch({
				type: "user_message",
				message: { role: "user", content: message, timestamp: Date.now() },
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
			<ChatView messages={state.messages} streamingMessage={state.streamingMessage} />
			<Composer onSend={handleSend} disabled={!connected || state.isStreaming} />
			<StatusBar connected={connected} isStreaming={state.isStreaming} modelName={state.modelName} />
			{state.pendingExtension && (
				<div style={{ padding: 12, background: "#fffbe6", borderTop: "1px solid #ffe58f" }}>
					<span>Extension request: {state.pendingExtension.method}</span>
					<button type="button" onClick={handleExtensionDismiss} style={{ marginLeft: 8 }}>
						Dismiss
					</button>
				</div>
			)}
		</div>
	);
}
