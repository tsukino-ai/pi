import { Bubble } from "@ant-design/x";
import type { AgentMessage } from "../bridge/types.ts";

export interface MessageBubbleProps {
	message: AgentMessage;
	isStreaming?: boolean;
}

function getMessageContent(msg: AgentMessage): string {
	if (typeof msg.content === "string") return msg.content;
	if (!Array.isArray(msg.content)) return JSON.stringify(msg.content);

	return msg.content
		.map((c) => {
			if (c.type === "text") return c.text ?? "";
			if (c.type === "toolCall") return `Tool call: ${c.name ?? "unknown"}`;
			// Show type for unknown content instead of silently dropping
			return `[${c.type}]`;
		})
		.join("\n");
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
