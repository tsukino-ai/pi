import { Card, Tag } from "antd";
import { useState } from "react";
import { ansiToHtmlString } from "../../utils/ansi.ts";

export interface TerminalOutputProps {
	command: string;
	output: string;
	isError: boolean;
}

export function TerminalOutput({ command, output, isError }: TerminalOutputProps) {
	const [expanded, setExpanded] = useState(false);
	const lines = output.split("\n");
	const isLong = lines.length > 20;
	const displayOutput = isLong && !expanded ? lines.slice(0, 20).join("\n") : output;

	return (
		<Card
			size="small"
			title={
				<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
					<span style={{ fontFamily: "monospace", fontSize: 13 }}>$ {command}</span>
					<Tag color={isError ? "red" : "green"}>{isError ? "Error" : "OK"}</Tag>
				</div>
			}
			style={{ marginTop: 8, background: "#1e1e1e", color: "#d4d4d4" }}
			styles={{ body: { padding: "8px 12px" } }}
		>
			<pre
				style={{
					margin: 0,
					fontFamily: "monospace",
					fontSize: 13,
					lineHeight: 1.5,
					whiteSpace: "pre-wrap",
					wordBreak: "break-all",
					color: "#d4d4d4",
					maxHeight: expanded ? "none" : "400px",
					overflow: "auto",
				}}
				dangerouslySetInnerHTML={{ __html: ansiToHtmlString(displayOutput) }}
			/>
			{isLong && (
				<div style={{ textAlign: "center", paddingTop: 8 }}>
					<a
						onClick={() => setExpanded(!expanded)}
						style={{ color: "#1890ff", cursor: "pointer", fontSize: 12 }}
					>
						{expanded ? "Show less" : `Show ${lines.length - 20} more lines`}
					</a>
				</div>
			)}
		</Card>
	);
}
