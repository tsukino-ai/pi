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
	const htmlContent = ansiToHtmlString(displayOutput);

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
				/* biome-ignore lint/security/noDangerouslySetInnerHtml: ANSI-converted HTML from trusted agent output */
				dangerouslySetInnerHTML={{ __html: htmlContent }}
			/>
			{isLong && (
				<div style={{ textAlign: "center", paddingTop: 8 }}>
					<button
						type="button"
						onClick={() => setExpanded(!expanded)}
						style={{
							color: "#1890ff",
							cursor: "pointer",
							fontSize: 12,
							background: "none",
							border: "none",
							padding: 0,
						}}
					>
						{expanded ? "Show less" : `Show ${lines.length - 20} more lines`}
					</button>
				</div>
			)}
		</Card>
	);
}
