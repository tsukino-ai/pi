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
				padding: "6px 12px",
				borderTop: "1px solid #f0f0f0",
				display: "flex",
				gap: 8,
				alignItems: "center",
				fontSize: 12,
				background: "#fff",
				minHeight: 32,
				overflow: "hidden",
			}}
		>
			<Tag color={connected ? "green" : "red"} style={{ fontSize: 12, margin: 0 }}>
				{connected ? "Connected" : "Disconnected"}
			</Tag>
			{isStreaming && (
				<Tag color="blue" style={{ fontSize: 12, margin: 0 }}>
					Streaming...
				</Tag>
			)}
			{modelName && (
				<span
					style={{
						marginLeft: "auto",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						maxWidth: "50%",
						opacity: 0.7,
					}}
				>
					{modelName}
				</span>
			)}
		</div>
	);
}
