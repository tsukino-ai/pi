import { useCallback, useEffect, useRef, useState } from "react";
import { BridgeClient, type BridgeEvent } from "./client.ts";
import type { RpcCommand } from "./types.ts";

export interface UseBridgeState {
	connected: boolean;
	events: BridgeEvent[];
	send: (command: RpcCommand) => void;
	clearEvents: () => void;
}

function getDefaultUrl(): string {
	return "ws://localhost:8080";
}

export function useBridge(url?: string): UseBridgeState {
	const resolvedUrl = url ?? getDefaultUrl();
	const clientRef = useRef<BridgeClient | null>(null);
	const [connected, setConnected] = useState(false);
	const [events, setEvents] = useState<BridgeEvent[]>([]);

	useEffect(() => {
		const client = new BridgeClient(resolvedUrl);
		clientRef.current = client;
		let cancelled = false;

		client.connect();

		const unsubscribe = client.subscribe((event) => {
			if (cancelled) return;
			if (event.type === "connected") {
				setConnected(true);
				try {
					client.send({ type: "get_state" });
				} catch {
					// Will retry on next reconnect
				}
			} else if (event.type === "disconnected") {
				setConnected(false);
			}
			setEvents((prev) => [...prev, event]);
		});

		return () => {
			cancelled = true;
			unsubscribe();
			client.disconnect();
			clientRef.current = null;
		};
	}, [resolvedUrl]);

	const send = useCallback((command: RpcCommand) => {
		clientRef.current?.send(command);
	}, []);

	const clearEvents = useCallback(() => {
		setEvents([]);
	}, []);

	return { connected, events, send, clearEvents };
}
