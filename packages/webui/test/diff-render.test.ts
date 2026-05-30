import { describe, expect, it } from "vitest";
import { parseDiffLines } from "../src/utils/diff-render.ts";

describe("parseDiffLines", () => {
	it("parses header lines", () => {
		const lines = parseDiffLines("@@ -1,3 +1,4 @@\n context\n+added\n-removed");
		expect(lines[0].type).toBe("header");
		expect(lines[0].content).toContain("@@");
	});

	it("parses added lines", () => {
		const lines = parseDiffLines("+new line");
		expect(lines).toHaveLength(1);
		expect(lines[0].type).toBe("add");
		expect(lines[0].content).toBe("new line");
	});

	it("parses removed lines", () => {
		const lines = parseDiffLines("-old line");
		expect(lines).toHaveLength(1);
		expect(lines[0].type).toBe("remove");
		expect(lines[0].content).toBe("old line");
	});

	it("parses context lines", () => {
		const lines = parseDiffLines(" unchanged");
		expect(lines).toHaveLength(1);
		expect(lines[0].type).toBe("context");
		expect(lines[0].content).toBe("unchanged");
	});

	it("handles mixed diff", () => {
		const diff = "@@ -1,3 +1,4 @@\n keep\n-remove\n+add1\n+add2";
		const lines = parseDiffLines(diff);
		expect(lines).toHaveLength(5);
		expect(lines.map((l) => l.type)).toEqual(["header", "context", "remove", "add", "add"]);
	});
});
