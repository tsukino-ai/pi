import { CodeOutlined, StopOutlined } from "@ant-design/icons";
import { Button, Card, Input, Tag } from "antd";
import { useState } from "react";
import type { RpcCommand } from "../bridge/types.ts";
import { ansiToHtmlString } from "../utils/ansi.ts";

export interface BashTerminalProps {
	send: (command: RpcCommand) => void;
	isRunning: boolean;
	output?: string;
	isError?: boolean;
}

export function BashTerminal({ send, isRunning, output }: BashTerminalProps) {
	const [command, setCommand] = useState("");

	const handleRun = () => {
		if (command.trim()) {
			send({ type: "bash", command: command.trim() });
		}
	};

	return (
		<Card
			size="small"
			title={
				<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
					<CodeOutlined />
					<span>Bash</span>
					{isRunning && <Tag color="blue">Running</Tag>}
				</div>
			}
			extra={
				isRunning ? (
					<Button size="small" danger icon={<StopOutlined />} onClick={() => send({ type: "abort_bash" })}>
						Stop
					</Button>
				) : null
			}
		>
			<Input.Search
				value={command}
				onChange={(e) => setCommand(e.target.value)}
				placeholder="Enter bash command..."
				onSearch={handleRun}
				disabled={isRunning}
				enterButton="Run"
			/>
			{output && (
				<pre
					style={{
						margin: 8,
						padding: 8,
						background: "#1e1e1e",
						color: "#d4d4d4",
						borderRadius: 4,
						maxHeight: 300,
						overflow: "auto",
						fontSize: 12,
						whiteSpace: "pre-wrap",
						wordBreak: "break-all",
					}}
					/* biome-ignore lint/security/noDangerouslySetInnerHtml: ANSI-converted HTML */
					dangerouslySetInnerHTML={{ __html: ansiToHtmlString(output) }}
				/>
			)}
		</Card>
	);
}
