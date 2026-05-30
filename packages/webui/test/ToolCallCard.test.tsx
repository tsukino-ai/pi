import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToolCallCard } from "../src/components/tool-renderers/ToolCallCard.tsx";

describe("ToolCallCard", () => {
	it("renders tool name", () => {
		render(<ToolCallCard toolName="read" args={{ path: "test.ts" }} status="pending" />);
		expect(screen.getByText("read")).toBeDefined();
	});

	it("renders pending spinner", () => {
		render(<ToolCallCard toolName="bash" args={{ command: "ls" }} status="pending" />);
		expect(screen.getByText("bash")).toBeDefined();
	});

	it("renders success tag", () => {
		render(<ToolCallCard toolName="read" args={{ path: "test.ts" }} status="success" />);
		expect(screen.getByText("Done")).toBeDefined();
	});

	it("renders error tag", () => {
		render(<ToolCallCard toolName="bash" args={{ command: "false" }} status="error" />);
		expect(screen.getByText("Error")).toBeDefined();
	});
});
