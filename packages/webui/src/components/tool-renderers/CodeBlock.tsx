import { CopyOutlined } from "@ant-design/icons";
import { Button, Card } from "antd";
import hljs from "highlight.js";
import { useMemo } from "react";

const EXT_TO_LANG: Record<string, string> = {
	ts: "typescript",
	tsx: "typescript",
	js: "javascript",
	jsx: "javascript",
	py: "python",
	rs: "rust",
	go: "go",
	java: "java",
	md: "markdown",
	json: "json",
	yaml: "yaml",
	yml: "yaml",
	sh: "bash",
	bash: "bash",
	css: "css",
	html: "html",
	sql: "sql",
};

function detectLanguage(filePath?: string): string | undefined {
	if (!filePath) return undefined;
	const ext = filePath.split(".").pop()?.toLowerCase();
	return EXT_TO_LANG[ext ?? ""];
}

export interface CodeBlockProps {
	content: string;
	filePath?: string;
}

export function CodeBlock({ content, filePath }: CodeBlockProps) {
	const language = detectLanguage(filePath);

	const highlighted = useMemo(() => {
		if (!language) return hljs.highlightAuto(content).value;
		try {
			return hljs.highlight(content, { language }).value;
		} catch {
			return hljs.highlightAuto(content).value;
		}
	}, [content, language]);

	const handleCopy = () => {
		navigator.clipboard.writeText(content);
	};

	return (
		<Card
			size="small"
			title={filePath ?? "Code"}
			extra={
				<Button size="small" icon={<CopyOutlined />} onClick={handleCopy}>
					Copy
				</Button>
			}
			style={{ marginTop: 8 }}
		>
			<pre style={{ margin: 0, overflowX: "auto", fontSize: 13, lineHeight: 1.5 }}>
				<code
					/* biome-ignore lint/security/noDangerouslySetInnerHtml: syntax highlighted HTML from highlight.js */
					dangerouslySetInnerHTML={{ __html: highlighted }}
				/>
			</pre>
		</Card>
	);
}
