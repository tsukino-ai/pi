import { Card } from "antd";
import { FileAddOutlined } from "@ant-design/icons";

export interface FileNoticeProps {
	filePath: string;
	content: string;
}

export function FileNotice({ filePath, content }: FileNoticeProps) {
	const lines = content.split("\n");
	const preview = lines.slice(0, 3).join("\n");

	return (
		<Card size="small" style={{ marginTop: 8, background: "#f6ffed", borderColor: "#b7eb8f" }}>
			<div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
				<FileAddOutlined style={{ color: "#52c41a" }} />
				<span style={{ fontWeight: 500 }}>Created {filePath}</span>
			</div>
			<pre style={{ margin: 0, fontSize: 12, color: "#666", whiteSpace: "pre-wrap" }}>
				{preview}
				{lines.length > 3 && "\n..."}
			</pre>
		</Card>
	);
}
