import type { RpcCommand, RpcResponse } from "./types.ts";

export type BridgeEvent =
	| { type: "rpc_response"; payload: RpcResponse }
	| { type: "rpc_event"; payload: unknown }
	| { type: "bridge_error"; message: string }
	| { type: "connected" }
	| { type: "disconnected" };

export class BridgeClient {
	private ws: WebSocket | undefined;
	private callbacks = new Set<(event: BridgeEvent) => void>();
	private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
	private url: string;
	private shouldReconnect = true;

	constructor(url = "ws://localhost:8080") {
		this.url = url;
	}

	connect(): void {
		this.shouldReconnect = true;
		this.ws = new WebSocket(this.url);

		this.ws.onopen = () => {
			this.emit({ type: "connected" });
			if (this.reconnectTimer) {
				clearTimeout(this.reconnectTimer);
				this.reconnectTimer = undefined;
			}
		};

		this.ws.onmessage = (ev) => {
			try {
				const data = JSON.parse(String(ev.data));
				if (data.type === "line") {
					const payload = data.data;
					if (payload && typeof payload === "object") {
						if (payload.type === "response") {
							this.emit({ type: "rpc_response", payload: payload as RpcResponse });
						} else {
							this.emit({ type: "rpc_event", payload });
						}
					}
				} else if (data.type === "bridge_error") {
					this.emit({ type: "bridge_error", message: data.message });
				} else {
					this.emit({ type: "rpc_event", payload: data });
				}
			} catch {
				// Ignore non-JSON
			}
		};

		this.ws.onclose = () => {
			this.emit({ type: "disconnected" });
			if (this.shouldReconnect) {
				this.reconnectTimer = setTimeout(() => this.connect(), 2000);
			}
		};

		this.ws.onerror = () => {
			this.emit({ type: "bridge_error", message: "WebSocket error" });
		};
	}

	disconnect(): void {
		this.shouldReconnect = false;
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
		}
		this.ws?.close();
	}

	send(command: RpcCommand): void {
		if (this.ws?.readyState !== WebSocket.OPEN) {
			throw new Error("WebSocket not connected");
		}
		this.ws.send(JSON.stringify(command));
	}

	subscribe(callback: (event: BridgeEvent) => void): () => void {
		this.callbacks.add(callback);
		return () => this.callbacks.delete(callback);
	}

	private emit(event: BridgeEvent): void {
		for (const cb of this.callbacks) {
			cb(event);
		}
	}
}
