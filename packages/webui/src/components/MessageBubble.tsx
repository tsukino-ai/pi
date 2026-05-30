import { Bubble } from "@ant-design/x";
import type { AgentMessage, ToolCallState } from "../bridge/types.ts";
import { ToolCallCard } from "./tool-renderers/index.ts";

export interface MessageBubbleProps {
	message: AgentMessage;
	isStreaming?: boolean;
	toolCalls?: Map<string, ToolCallState>;
}

function getMessageContent(msg: AgentMessage): string {
	if (typeof msg.content === "string") return msg.content;
	if (!Array.isArray(msg.content)) return JSON.stringify(msg.content);

	return msg.content
		.filter((c) => c.type === "text")
		.map((c) => c.text ?? "")
		.join("\n");
}

export function MessageBubble({ message, isStreaming, toolCalls }: MessageBubbleProps) {
	const placement = message.role === "user" ? "end" : "start";
	const content = getMessageContent(message);

	// For assistant messages, render ToolCallCard for each tool call entry
	const toolCallCards: React.ReactNode[] = [];
	if (message.role === "assistant" && Array.isArray(message.content) && toolCalls) {
		// Collect tool call states in insertion order for index-based matching
		const toolCallStates = Array.from(toolCalls.values());
		let stateIndex = 0;

		for (const entry of message.content) {
			if (entry.type === "toolCall") {
				const tcState = toolCallStates[stateIndex];
				toolCallCards.push(
					<ToolCallCard
						key={entry.arguments ?? stateIndex}
						toolName={tcState?.toolName ?? entry.name ?? "unknown"}
						args={tcState?.args ?? {}}
						status={tcState?.status ?? "pending"}
						result={tcState?.result}
					/>,
				);
				stateIndex++;
			}
		}
	}

	return (
		<div style={{ display: "flex", flexDirection: "column", alignItems: placement === "end" ? "flex-end" : "flex-start" }}>
			<Bubble
				placement={placement}
				content={content + (isStreaming ? "▋" : "")}
				avatar={message.role === "user" ? { icon: "U" } : { icon: "AI" }}
			/>
			{toolCallCards}
		</div>
	);
}
