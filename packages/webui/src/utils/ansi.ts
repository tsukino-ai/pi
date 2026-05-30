import ansiToHtml from "ansi-to-html";

const converter = new ansiToHtml({
	fg: "#d4d4d4",
	bg: "#1e1e1e",
	newline: true,
	escapeXML: true,
});

export function ansiToHtmlString(text: string): string {
	try {
		return converter.toHtml(text);
	} catch {
		return text.replace(/\x1b\[[0-9;]*m/g, "");
	}
}

export function stripAnsi(text: string): string {
	return text.replace(/\x1b\[[0-9;]*m/g, "");
}
