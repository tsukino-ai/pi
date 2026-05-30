import { CompressOutlined, MenuOutlined } from "@ant-design/icons";
import { Button, Tag, Tooltip } from "antd";
import type { RpcCommand, SessionStats } from "../bridge/types.ts";

export interface StatusBarProps {
	connected: boolean;
	isStreaming: boolean;
	modelName?: string;
	onToggleSidebar?: () => void;
	sessionStats?: SessionStats;
	cwd?: string;
	send?: (command: RpcCommand) => void;
}

function formatTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
	return String(n);
}

export function StatusBar({
	connected,
	isStreaming,
	modelName,
	onToggleSidebar,
	sessionStats,
	cwd,
	send,
}: StatusBarProps) {
	const tokens = sessionStats?.tokens;

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
			{modelName && <span>{modelName}</span>}
			{tokens && (
				<Tooltip
					title={`Input: ${formatTokens(tokens.input)} | Output: ${formatTokens(tokens.output)} | Cache: ${formatTokens(tokens.cacheRead)}`}
				>
					<span style={{ color: "#888" }}>{formatTokens(tokens.total)} tokens</span>
				</Tooltip>
			)}
			{sessionStats && sessionStats.cost > 0 && (
				<span style={{ color: "#888" }}>${sessionStats.cost.toFixed(4)}</span>
			)}
			{send && (
				<Tooltip title="Compact context">
					<Button size="small" type="text" icon={<CompressOutlined />} onClick={() => send({ type: "compact" })} />
				</Tooltip>
			)}
			{cwd && (
				<Tooltip title={cwd}>
					<span
						style={{
							marginLeft: "auto",
							color: "#888",
							maxWidth: 200,
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
						}}
					>
						📁 {cwd}
					</span>
				</Tooltip>
			)}
			{!cwd && <span style={{ marginLeft: "auto" }} />}
		</div>
	);
}
