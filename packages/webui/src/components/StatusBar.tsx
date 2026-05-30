import { Tag } from "antd";

export interface StatusBarProps {
	connected: boolean;
	isStreaming: boolean;
	modelName?: string;
}

export function StatusBar({ connected, isStreaming, modelName }: StatusBarProps) {
	return (
		<div
			style={{
				padding: "8px 16px",
				borderTop: "1px solid #f0f0f0",
				display: "flex",
				gap: 12,
				alignItems: "center",
				fontSize: 12,
			}}
		>
			<Tag color={connected ? "green" : "red"}>{connected ? "Connected" : "Disconnected"}</Tag>
			{isStreaming && <Tag color="blue">Streaming...</Tag>}
			{modelName && <span style={{ marginLeft: "auto" }}>{modelName}</span>}
		</div>
	);
}
