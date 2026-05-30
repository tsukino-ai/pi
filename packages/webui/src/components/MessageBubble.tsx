import { Bubble } from "@ant-design/x";
import { Collapse } from "antd";
import type { AgentMessage, ToolCallState } from "../bridge/types.ts";
import { ToolCallCard } from "./tool-renderers/index.ts";

export interface MessageBubbleProps {
	message: AgentMessage;
	isStreaming?: boolean;
	toolCalls?: Map<string, ToolCallState>;
}

function getThinkingContent(msg: AgentMessage): string | undefined {
	if (typeof msg.content === "string") return undefined;
	if (!Array.isArray(msg.content)) return undefined;

	const thinkingParts = msg.content
		.filter((c) => c.type === "thinking")
		.map((c) => (c as { thinking?: string }).thinking ?? "")
		.filter(Boolean);

	return thinkingParts.length > 0 ? thinkingParts.join("\n") : undefined;
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
	const thinking = message.role === "assistant" ? getThinkingContent(message) : undefined;

	// For assistant messages, render ToolCallCard for each tool call entry
	const toolCallCards: React.ReactNode[] = [];
	if (message.role === "assistant" && Array.isArray(message.content) && toolCalls) {
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
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: placement === "end" ? "flex-end" : "flex-start",
				maxWidth: "80%",
			}}
		>
			{thinking && (
				<Collapse
					size="small"
					style={{ marginBottom: 4, width: "100%", background: "#f6f6f6" }}
					items={[
						{
							key: "thinking",
							label: <span style={{ color: "#888", fontSize: 12 }}>💭 Thinking...</span>,
							children: (
								<pre
									style={{
										margin: 0,
										fontSize: 12,
										color: "#666",
										whiteSpace: "pre-wrap",
										wordBreak: "break-word",
										maxHeight: 300,
										overflow: "auto",
									}}
								>
									{thinking}
								</pre>
							),
						},
					]}
				/>
			)}
			<Bubble
				placement={placement}
				content={content}
				avatar={message.role === "user" ? { icon: "U" } : { icon: "AI" }}
				typing={isStreaming ? { step: 2, interval: 50 } : false}
				loading={isStreaming && !content}
				variant="shadow"
				shape="round"
			/>
			{toolCallCards}
		</div>
	);
}
