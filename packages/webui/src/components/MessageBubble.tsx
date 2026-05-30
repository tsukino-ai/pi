import type { AgentMessage } from "../bridge/types.ts";

export interface MessageBubbleProps {
	message: AgentMessage;
	isStreaming?: boolean;
}

function getMessageContent(msg: AgentMessage): string {
	if (msg.role === "user") {
		return typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
	}
	if (msg.role === "assistant") {
		if (!Array.isArray(msg.content)) return String(msg.content);
		return msg.content
			.map((c) => {
				if (c.type === "text") return c.text ?? "";
				if (c.type === "toolCall") return `Tool call: ${c.name ?? "unknown"}`;
				return "";
			})
			.join("\n");
	}
	if (msg.role === "toolResult") {
		if (!Array.isArray(msg.content)) return String(msg.content);
		return msg.content.map((c) => (c.type === "text" ? c.text ?? "" : "")).join("\n");
	}
	return "";
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
	const isUser = message.role === "user";
	const content = getMessageContent(message);

	return (
		<div
			style={{
				display: "flex",
				justifyContent: isUser ? "flex-end" : "flex-start",
				marginBottom: 8,
			}}
		>
			<div
				style={{
					maxWidth: "85%",
					padding: "10px 14px",
					borderRadius: 12,
					background: isUser ? "#1677ff" : "#f0f0f0",
					color: isUser ? "#fff" : "#333",
					whiteSpace: "pre-wrap",
					wordBreak: "break-word",
					fontSize: 15,
					lineHeight: 1.5,
				}}
			>
				{content + (isStreaming ? "▋" : "")}
			</div>
		</div>
	);
}
