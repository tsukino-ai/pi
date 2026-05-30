import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BridgeClient, type BridgeEvent } from "../src/bridge/client.ts";

// Minimal WebSocket mock that exercises the real callback paths
const MockWebSocketInstances: MockWebSocket[] = [];

class MockWebSocket {
	static instances = MockWebSocketInstances;
	static CONNECTING = 0;
	static OPEN = 1;
	static CLOSING = 2;
	static CLOSED = 3;

	readyState = 1; // OPEN
	onopen: ((ev: Event) => void) | null = null;
	onclose: ((ev: CloseEvent) => void) | null = null;
	onmessage: ((ev: MessageEvent) => void) | null = null;
	onerror: ((ev: Event) => void) | null = null;

	sent: string[] = [];

	url: string;

	constructor(url: string) {
		this.url = url;
		MockWebSocket.instances.push(this);
		// Simulate async connect
		queueMicrotask(() => this.onopen?.(new Event("open")));
	}

	send(data: string) {
		this.sent.push(data);
	}

	close() {
		this.readyState = 3; // CLOSED
		this.onclose?.(new CloseEvent("close"));
	}

	// Helper to simulate receiving a message
	receiveMessage(data: unknown) {
		this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
	}

	// Helper to simulate an error
	simulateError() {
		this.onerror?.(new Event("error"));
	}
}

describe("BridgeClient", () => {
	let originalWebSocket: typeof globalThis.WebSocket;

	beforeEach(() => {
		MockWebSocket.instances = [];
		originalWebSocket = globalThis.WebSocket;
		// @ts-expect-error Mock replacement
		globalThis.WebSocket = MockWebSocket;
	});

	afterEach(() => {
		globalThis.WebSocket = originalWebSocket;
	});

	it("emits connected event on open", async () => {
		const client = new BridgeClient("ws://localhost:9999");
		const events: BridgeEvent[] = [];
		client.subscribe((e) => events.push(e));
		client.connect();

		await vi.waitFor(() => {
			expect(events.some((e) => e.type === "connected")).toBe(true);
		});

		expect(events).toHaveLength(1);
		expect(events[0].type).toBe("connected");
		client.disconnect();
	});

	it("emits disconnected event on close", async () => {
		const client = new BridgeClient("ws://localhost:9999");
		const events: BridgeEvent[] = [];
		client.subscribe((e) => events.push(e));
		client.connect();

		await vi.waitFor(() => {
			expect(events.some((e) => e.type === "connected")).toBe(true);
		});

		const ws = MockWebSocket.instances[0]!;
		ws.close();

		expect(events.some((e) => e.type === "disconnected")).toBe(true);
	});

	it("parses rpc_response from line event", async () => {
		const client = new BridgeClient("ws://localhost:9999");
		const events: BridgeEvent[] = [];
		client.subscribe((e) => events.push(e));
		client.connect();

		await vi.waitFor(() => {
			expect(events.some((e) => e.type === "connected")).toBe(true);
		});

		const ws = MockWebSocket.instances[0]!;
		ws.receiveMessage({
			type: "line",
			data: { type: "response", command: "prompt", success: true },
		});

		const rpcEvents = events.filter((e) => e.type === "rpc_response");
		expect(rpcEvents).toHaveLength(1);
		expect(rpcEvents[0]).toEqual({
			type: "rpc_response",
			payload: { type: "response", command: "prompt", success: true },
		});

		client.disconnect();
	});

	it("emits rpc_event for non-response payloads", async () => {
		const client = new BridgeClient("ws://localhost:9999");
		const events: BridgeEvent[] = [];
		client.subscribe((e) => events.push(e));
		client.connect();

		await vi.waitFor(() => {
			expect(events.some((e) => e.type === "connected")).toBe(true);
		});

		const ws = MockWebSocket.instances[0]!;
		ws.receiveMessage({
			type: "line",
			data: { type: "agent_start" },
		});

		const rpcEvents = events.filter((e) => e.type === "rpc_event");
		expect(rpcEvents).toHaveLength(1);
		expect((rpcEvents[0] as { payload: { type: string } }).payload.type).toBe("agent_start");

		client.disconnect();
	});

	it("emits bridge_error for bridge error messages", async () => {
		const client = new BridgeClient("ws://localhost:9999");
		const events: BridgeEvent[] = [];
		client.subscribe((e) => events.push(e));
		client.connect();

		await vi.waitFor(() => {
			expect(events.some((e) => e.type === "connected")).toBe(true);
		});

		const ws = MockWebSocket.instances[0]!;
		ws.receiveMessage({ type: "bridge_error", message: "test error" });

		const errorEvents = events.filter((e) => e.type === "bridge_error");
		expect(errorEvents).toHaveLength(1);
		expect(errorEvents[0]).toEqual({ type: "bridge_error", message: "test error" });

		client.disconnect();
	});

	it("throws when sending while disconnected", () => {
		const client = new BridgeClient("ws://localhost:9999");
		expect(() => client.send({ type: "prompt", message: "test" })).toThrow("WebSocket not connected");
	});

	it("unsubscribe stops receiving events", async () => {
		const client = new BridgeClient("ws://localhost:9999");
		const events: BridgeEvent[] = [];
		const unsub = client.subscribe((e) => events.push(e));
		client.connect();

		await vi.waitFor(() => {
			expect(events.some((e) => e.type === "connected")).toBe(true);
		});

		unsub();
		events.length = 0;

		const ws = MockWebSocket.instances[0]!;
		ws.receiveMessage({ type: "line", data: { type: "agent_start" } });

		expect(events).toHaveLength(0);
		client.disconnect();
	});

	it("emits bridge_error on WebSocket error", async () => {
		const client = new BridgeClient("ws://localhost:9999");
		const events: BridgeEvent[] = [];
		client.subscribe((e) => events.push(e));
		client.connect();

		await vi.waitFor(() => {
			expect(events.some((e) => e.type === "connected")).toBe(true);
		});

		const ws = MockWebSocket.instances[0]!;
		ws.simulateError();

		const errorEvents = events.filter((e) => e.type === "bridge_error");
		expect(errorEvents).toHaveLength(1);
		expect(errorEvents[0]).toEqual({ type: "bridge_error", message: "WebSocket error" });

		client.disconnect();
	});
});
