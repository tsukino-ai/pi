import { useCallback, useEffect, useRef, useState } from "react";
import { BridgeClient, type BridgeEvent } from "./client.ts";
import type { RpcCommand } from "./types.ts";

export interface UseBridgeState {
	connected: boolean;
	events: BridgeEvent[];
	send: (command: RpcCommand) => void;
	clearEvents: () => void;
}

export function useBridge(url = "ws://localhost:8080"): UseBridgeState {
	const clientRef = useRef<BridgeClient>(new BridgeClient(url));
	const [connected, setConnected] = useState(false);
	const [events, setEvents] = useState<BridgeEvent[]>([]);

	useEffect(() => {
		const client = clientRef.current;
		client.connect();

		const unsubscribe = client.subscribe((event) => {
			if (event.type === "connected") {
				setConnected(true);
				// Request initial state so StatusBar can display model name
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
			unsubscribe();
			client.disconnect();
		};
	}, [url]);

	const send = useCallback((command: RpcCommand) => {
		clientRef.current.send(command);
	}, []);

	const clearEvents = useCallback(() => {
		setEvents([]);
	}, []);

	return { connected, events, send, clearEvents };
}
