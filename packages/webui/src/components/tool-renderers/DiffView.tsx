import { Card } from "antd";
import { useMemo } from "react";
import { type DiffLine, parseDiffLines } from "../../utils/diff-render.ts";

function DiffLineComponent({ line }: { line: DiffLine }) {
	if (line.type === "header") {
		return (
			<div
				style={{ color: "#888", padding: "4px 8px", background: "#f5f5f5", fontFamily: "monospace", fontSize: 13 }}
			>
				{line.content}
			</div>
		);
	}

	const bg = line.type === "add" ? "#e6ffed" : line.type === "remove" ? "#ffeef0" : "transparent";
	const prefix = line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";

	return (
		<div
			style={{
				background: bg,
				padding: "1px 8px",
				whiteSpace: "pre",
				fontFamily: "monospace",
				fontSize: 13,
				lineHeight: 1.5,
			}}
		>
			<span style={{ color: "#999", userSelect: "none", marginRight: 8 }}>{prefix}</span>
			{line.content}
		</div>
	);
}

export interface DiffViewProps {
	diff: string;
	filePath?: string;
}

export function DiffView({ diff, filePath }: DiffViewProps) {
	const lines = useMemo(() => parseDiffLines(diff), [diff]);

	return (
		<Card size="small" title={`Diff: ${filePath ?? "unknown"}`} style={{ marginTop: 8 }}>
			<div style={{ overflowX: "auto" }}>
				{lines.map((line, i) => (
					<DiffLineComponent key={`${line.type}-${i}-${line.content.slice(0, 16)}`} line={line} />
				))}
			</div>
		</Card>
	);
}
