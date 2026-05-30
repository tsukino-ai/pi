import { Bubble } from "@ant-design/x";
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
	const placement = message.role === "user" ? "end" : "start";
	const content = getMessageContent(message);

	return (
		<Bubble
			placement={placement}
			content={content + (isStreaming ? "▋" : "")}
			avatar={message.role === "user" ? { icon: "U" } : { icon: "AI" }}
		/>
	);
}
