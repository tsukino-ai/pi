import { useCallback, useMemo } from "react";
import { useBridge } from "./bridge/useBridge.ts";
import type { AgentMessage } from "./bridge/types.ts";
import { ChatView } from "./components/ChatView.tsx";
import { Composer } from "./components/Composer.tsx";
import { StatusBar } from "./components/StatusBar.tsx";

function extractMessages(events: ReturnType<typeof useBridge>["events"]): {
	messages: AgentMessage[];
	streamingMessage?: AgentMessage;
	isStreaming: boolean;
	modelName?: string;
} {
	const messages: AgentMessage[] = [];
	let streamingMessage: AgentMessage | undefined;
	let isStreaming = false;
	let modelName: string | undefined;

	for (const event of events) {
		if (event.type === "rpc_event") {
			const payload = event.payload as Record<string, unknown>;
			if (payload.type === "agent_start") {
				isStreaming = true;
			}
			if (payload.type === "agent_end") {
				isStreaming = false;
				streamingMessage = undefined;
			}
			if (payload.type === "message_end" && payload.message) {
				messages.push(payload.message as AgentMessage);
				streamingMessage = undefined;
			}
			if (payload.type === "message_update" && payload.message) {
				streamingMessage = payload.message as AgentMessage;
			}
		}
		if (event.type === "rpc_response") {
			const cmd = event.payload.command;
			if (cmd === "get_state" && event.payload.success) {
				const data = event.payload.data as { model?: { name?: string } };
				modelName = data.model?.name;
			}
		}
	}

	return { messages, streamingMessage, isStreaming, modelName };
}

export function App() {
	const { connected, events, send } = useBridge();
	const { messages, streamingMessage, isStreaming, modelName } = useMemo(
		() => extractMessages(events),
		[events],
	);

	const handleSend = useCallback(
		(message: string) => {
			send({ type: "prompt", message });
		},
		[send],
	);

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
			<ChatView messages={messages} streamingMessage={streamingMessage} />
			<Composer onSend={handleSend} disabled={!connected || isStreaming} />
			<StatusBar connected={connected} isStreaming={isStreaming} modelName={modelName} />
		</div>
	);
}
