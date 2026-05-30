import type { AgentMessage } from "../bridge/types.ts";
import { MessageBubble } from "./MessageBubble.tsx";

export interface ChatViewProps {
	messages: AgentMessage[];
	streamingMessage?: AgentMessage;
}

export function ChatView({ messages, streamingMessage }: ChatViewProps) {
	return (
		<div
			style={{
				flex: 1,
				overflowY: "auto",
				padding: 16,
				display: "flex",
				flexDirection: "column",
				gap: 12,
			}}
		>
			{messages.map((msg) => (
				<MessageBubble
					key={`${msg.role}-${msg.timestamp ?? ""}-${typeof msg.content === "string" ? msg.content.slice(0, 32) : ""}`}
					message={msg}
				/>
			))}
			{streamingMessage && <MessageBubble message={streamingMessage} isStreaming />}
		</div>
	);
}
