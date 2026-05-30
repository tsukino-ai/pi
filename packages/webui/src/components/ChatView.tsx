import { RobotOutlined, UserOutlined } from "@ant-design/icons";
import { Bubble } from "@ant-design/x";
import type { BubbleDataType } from "@ant-design/x/es/bubble/BubbleList";
import type { AgentMessage } from "../bridge/types.ts";
import type { ChatStatus } from "../hooks/usePiChat.ts";

export interface ChatViewProps {
	messages: AgentMessage[];
	streamingMessage?: AgentMessage;
	status?: ChatStatus;
}

function getContent(msg: AgentMessage): string {
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
		return msg.content.map((c) => (c.type === "text" ? (c.text ?? "") : "")).join("\n");
	}
	return "";
}

export function ChatView({ messages, streamingMessage, status }: ChatViewProps) {
	const items: BubbleDataType[] = messages.map((msg, i) => ({
		key: i,
		role: msg.role,
		placement: msg.role === "user" ? "end" : "start",
		content: getContent(msg),
		avatar:
			msg.role === "user"
				? { icon: <UserOutlined />, style: { background: "#1677ff" } }
				: { icon: <RobotOutlined />, style: { background: "#87e8de" } },
	}));

	if (streamingMessage) {
		items.push({
			key: "streaming",
			role: streamingMessage.role,
			placement: streamingMessage.role === "user" ? "end" : "start",
			content: getContent(streamingMessage),
			typing: { suffix: <span>▋</span> },
			avatar:
				streamingMessage.role === "user"
					? { icon: <UserOutlined />, style: { background: "#1677ff" } }
					: { icon: <RobotOutlined />, style: { background: "#87e8de" } },
		});
	}

	if (status === "loading" && !streamingMessage && messages.length > 0) {
		items.push({
			key: "skeleton",
			role: "assistant",
			placement: "start",
			loading: true,
			avatar: { icon: <RobotOutlined />, style: { background: "#87e8de" } },
		});
	}

	return (
		<div style={{ flex: 1, overflow: "hidden", padding: "12px 16px" }}>
			<Bubble.List
				items={items}
				autoScroll
				roles={{
					user: { placement: "end" },
					assistant: { placement: "start" },
					toolResult: { placement: "start" },
				}}
				style={{ height: "100%" }}
			/>
		</div>
	);
}
