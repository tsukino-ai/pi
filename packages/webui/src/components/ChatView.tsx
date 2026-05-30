import { Bubble } from "@ant-design/x";
import type { AgentMessage, ToolCallState } from "../bridge/types.ts";
import { MessageBubble } from "./MessageBubble.tsx";

export interface ChatViewProps {
	messages: AgentMessage[];
	streamingMessage?: AgentMessage;
	toolCalls?: Map<string, ToolCallState>;
}

function getMessageContent(msg: AgentMessage): string {
	if (typeof msg.content === "string") return msg.content;
	if (!Array.isArray(msg.content)) return "";
	return msg.content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
}

export function ChatView({ messages, streamingMessage, toolCalls }: ChatViewProps) {
	const allMessages = streamingMessage
		? [...messages, streamingMessage]
		: messages;

	return (
		<Bubble.List
			items={allMessages.map((msg, i) => ({
				key: `${msg.role}-${msg.timestamp ?? i}`,
				content: msg,
				placement: msg.role === "user" ? "end" : "start",
				avatar: msg.role === "user" ? { icon: "U" } : { icon: "AI" },
				loading: i === allMessages.length - 1 && streamingMessage !== undefined && !getMessageContent(msg),
				messageRender: (content) => (
					<MessageBubble
						message={content as AgentMessage}
						isStreaming={i === allMessages.length - 1 && streamingMessage !== undefined}
						toolCalls={toolCalls}
					/>
				),
			}))}
			style={{ flex: 1, overflow: "auto", padding: 16 }}
		/>
	);
}
