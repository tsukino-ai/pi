import { useCallback, useEffect, useRef, useState } from "react";
import { BridgeClient, type BridgeEvent } from "./client.ts";
import type { RpcCommand, Session } from "./types.ts";

export interface UseBridgeState {
	connected: boolean;
	events: BridgeEvent[];
	send: (command: RpcCommand) => void;
	clearEvents: () => void;
	waitingForDirectory: boolean;
	currentCwd: string | null;
	sessions: Session[];
	setWorkingDirectory: (cwd: string) => void;
	useTempWorkspace: () => void;
}

function getDefaultUrl(): string {
	return "ws://localhost:8080";
}

export function useBridge(url?: string): UseBridgeState {
	const resolvedUrl = url ?? getDefaultUrl();
	const clientRef = useRef<BridgeClient | null>(null);
	const [connected, setConnected] = useState(false);
	const [events, setEvents] = useState<BridgeEvent[]>([]);
	const [waitingForDirectory, setWaitingForDirectory] = useState(false);
	const [currentCwd, setCurrentCwd] = useState<string | null>(null);
	const [sessions, setSessions] = useState<Session[]>([]);

	useEffect(() => {
		const client = new BridgeClient(resolvedUrl);
		clientRef.current = client;
		let cancelled = false;

		client.connect();

		const unsubscribe = client.subscribe((event) => {
			if (cancelled) return;

			if (event.type === "connected") {
				setConnected(true);
			} else if (event.type === "disconnected") {
				setConnected(false);
				setWaitingForDirectory(false);
			}

			// Handle bridge-specific events
			if (event.type === "rpc_event") {
				const payload = event.payload as Record<string, unknown>;
				if (payload.type === "bridge_event") {
					if (payload.event === "waiting_for_directory") {
						setWaitingForDirectory(true);
						// Request session list
						client.send({ type: "list_sessions" } as unknown as RpcCommand);
						return;
					}
					if (payload.event === "pi_started") {
						setWaitingForDirectory(false);
						setCurrentCwd(payload.cwd as string);
						// Refresh session list
						client.send({ type: "list_sessions" } as unknown as RpcCommand);
						// Fetch initial state
						try {
							client.send({ type: "get_state" });
							client.send({ type: "get_messages" });
						} catch {
							/* ignore */
						}
						return;
					}
					if (payload.event === "session_list") {
						setSessions(payload.sessions as Session[]);
						return;
					}
				}
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

	const setWorkingDirectory = useCallback((cwd: string) => {
		clientRef.current?.send({ type: "set_working_directory", cwd } as unknown as RpcCommand);
	}, []);

	const useTempWorkspace = useCallback(() => {
		clientRef.current?.send({ type: "use_temp_workspace" } as unknown as RpcCommand);
	}, []);

	return {
		connected,
		events,
		send,
		clearEvents,
		waitingForDirectory,
		currentCwd,
		sessions,
		setWorkingDirectory,
		useTempWorkspace,
	};
}
