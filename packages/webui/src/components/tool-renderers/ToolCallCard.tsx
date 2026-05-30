import { CodeOutlined, EditOutlined, FileTextOutlined } from "@ant-design/icons";
import { Card, Collapse, Spin, Tag } from "antd";
import type { ToolCallState } from "../../bridge/types.ts";
import { CodeBlock } from "./CodeBlock.tsx";
import { DiffView } from "./DiffView.tsx";
import { FileNotice } from "./FileNotice.tsx";
import { TerminalOutput } from "./TerminalOutput.tsx";

export interface ToolCallCardProps {
	toolName: string;
	args: Record<string, unknown>;
	status: ToolCallState["status"];
	result?: ToolCallState["result"];
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
	read: <FileTextOutlined />,
	edit: <EditOutlined />,
	bash: <CodeOutlined />,
	write: <CodeOutlined />,
};

function getArgSummary(toolName: string, args: Record<string, unknown>): string {
	switch (toolName) {
		case "read":
		case "edit":
		case "write":
			return String(args.path ?? args.filePath ?? "");
		case "bash":
			return String(args.command ?? "");
		default:
			return "";
	}
}

function ToolResultBody({
	toolName,
	args,
	result,
}: {
	toolName: string;
	args: Record<string, unknown>;
	result?: ToolCallState["result"];
}) {
	if (!result) return null;

	const textContent = result.content
		.filter((c) => c.type === "text" && c.text)
		.map((c) => c.text!)
		.join("\n");

	switch (toolName) {
		case "read": {
			const filePath = String(args.path ?? args.filePath ?? "");
			return <CodeBlock content={textContent} filePath={filePath} />;
		}
		case "edit": {
			const details = result.details as { diff?: string; patch?: string } | undefined;
			const filePath = String(args.path ?? args.filePath ?? "");
			const diff = details?.diff ?? textContent;
			return <DiffView diff={diff} filePath={filePath} />;
		}
		case "bash": {
			const command = String(args.command ?? "");
			return <TerminalOutput command={command} output={textContent} isError={false} />;
		}
		case "write": {
			const filePath = String(args.path ?? args.filePath ?? "");
			return <FileNotice filePath={filePath} content={textContent} />;
		}
		default:
			return <CodeBlock content={textContent} />;
	}
}

export function ToolCallCard({ toolName, args, status, result }: ToolCallCardProps) {
	const icon = TOOL_ICONS[toolName] ?? <CodeOutlined />;
	const summary = getArgSummary(toolName, args);
	const isError = status === "error";

	return (
		<Card size="small" style={{ marginTop: 8, borderColor: isError ? "#ff4d4f" : undefined }}>
			<Collapse
				ghost
				defaultActiveKey={status === "pending" ? undefined : ["body"]}
				items={[
					{
						key: "body",
						label: (
							<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
								{icon}
								<span style={{ fontWeight: 500 }}>{toolName}</span>
								<span style={{ color: "#888", fontSize: 12 }}>{summary}</span>
								{status === "pending" && <Spin size="small" />}
								{status === "success" && <Tag color="green">Done</Tag>}
								{isError && <Tag color="red">Error</Tag>}
							</div>
						),
						children: <ToolResultBody toolName={toolName} args={args} result={result} />,
					},
				]}
			/>
		</Card>
	);
}
