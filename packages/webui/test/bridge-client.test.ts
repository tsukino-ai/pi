import { describe, expect, it, vi } from "vitest";
import { BridgeClient } from "../src/bridge/client.ts";

describe("BridgeClient", () => {
	it("emits connected event on open", () => {
		const client = new BridgeClient("ws://localhost:9999");
		const handler = vi.fn();
		client.subscribe(handler);

		// Simulate WebSocket open
		const mockWs = {
			readyState: 1,
			send: vi.fn(),
			close: vi.fn(),
		} as unknown as WebSocket;

		// Replace internal ws with mock
		(client as unknown as { ws: WebSocket }).ws = mockWs;
		mockWs.onopen?.({} as Event);

		expect(handler).toHaveBeenCalledWith({ type: "connected" });
	});

	it("parses rpc_response from line event", () => {
		const client = new BridgeClient("ws://localhost:9999");
		const handler = vi.fn();
		client.subscribe(handler);

		const mockWs = {
			readyState: 1,
			send: vi.fn(),
			close: vi.fn(),
		} as unknown as WebSocket;
		(client as unknown as { ws: WebSocket }).ws = mockWs;

		mockWs.onmessage?.({
			data: JSON.stringify({
				type: "line",
				data: { type: "response", command: "prompt", success: true },
			}),
		} as MessageEvent);

		expect(handler).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "rpc_response",
				payload: { type: "response", command: "prompt", success: true },
			}),
		);
	});
});
