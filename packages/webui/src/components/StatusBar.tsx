import { MenuOutlined } from "@ant-design/icons";
import { Button, Tag } from "antd";

export interface StatusBarProps {
	connected: boolean;
	isStreaming: boolean;
	modelName?: string;
	onToggleSidebar?: () => void;
}

export function StatusBar({ connected, isStreaming, modelName, onToggleSidebar }: StatusBarProps) {
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
			{onToggleSidebar && <Button size="small" type="text" icon={<MenuOutlined />} onClick={onToggleSidebar} />}
			<Tag color={connected ? "green" : "red"}>{connected ? "Connected" : "Disconnected"}</Tag>
			{isStreaming && <Tag color="blue">Streaming...</Tag>}
			{modelName && <span style={{ marginLeft: "auto" }}>{modelName}</span>}
		</div>
	);
}
