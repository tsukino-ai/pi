import type { AgentMessage, ToolCallState } from "../bridge/types.ts";
import { MessageBubble } from "./MessageBubble.tsx";

export interface ChatViewProps {
	messages: AgentMessage[];
	streamingMessage?: AgentMessage;
	toolCalls?: Map<string, ToolCallState>;
}

export function ChatView({ messages, streamingMessage, toolCalls }: ChatViewProps) {
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
					toolCalls={toolCalls}
				/>
			))}
			{streamingMessage && <MessageBubble message={streamingMessage} isStreaming toolCalls={toolCalls} />}
		</div>
	);
}
