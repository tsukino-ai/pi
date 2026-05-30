export interface DiffLine {
	type: "context" | "add" | "remove" | "header";
	content: string;
}

export function parseDiffLines(diff: string): DiffLine[] {
	const lines = diff.split("\n");
	const result: DiffLine[] = [];

	for (const line of lines) {
		if (line.startsWith("@@")) {
			result.push({ type: "header", content: line });
		} else if (line.startsWith("+")) {
			result.push({ type: "add", content: line.slice(1) });
		} else if (line.startsWith("-")) {
			result.push({ type: "remove", content: line.slice(1) });
		} else if (line.startsWith(" ")) {
			result.push({ type: "context", content: line.slice(1) });
		} else {
			result.push({ type: "context", content: line });
		}
	}

	return result;
}
