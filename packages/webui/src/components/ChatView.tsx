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
			{messages.map((msg, i) => (
				<MessageBubble key={i} message={msg} />
			))}
			{streamingMessage && (
				<MessageBubble message={streamingMessage} isStreaming />
			)}
		</div>
	);
}
