import { useCallback, useMemo } from "react";
import { Welcome } from "@ant-design/x";
import { CommentOutlined } from "@ant-design/icons";
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

	const showWelcome = messages.length === 0 && !streamingMessage;

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				height: "100dvh",
				overflow: "hidden",
				background: "#fff",
			}}
		>
			{showWelcome ? (
				<div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
					<Welcome
						icon={<CommentOutlined style={{ fontSize: 48, color: "#1677ff" }} />}
						title="pi WebUI"
						description="Connect to bridge and start chatting with your AI agent."
					/>
				</div>
			) : (
				<ChatView messages={messages} streamingMessage={streamingMessage} />
			)}
			<Composer onSend={handleSend} disabled={!connected || isStreaming} loading={isStreaming} />
			<StatusBar connected={connected} isStreaming={isStreaming} modelName={modelName} />
		</div>
	);
}
