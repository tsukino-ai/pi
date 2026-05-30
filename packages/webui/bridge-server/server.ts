import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type WebSocket, WebSocketServer } from "ws";
import { PiProcess } from "./pi-process.ts";

export interface BridgeServerOptions {
	port: number;
	piPath?: string;
}

interface ClientState {
	socket: WebSocket;
	pi: PiProcess | null;
	cwd: string | null;
}

export class BridgeServer {
	private wss: WebSocketServer;
	private clients = new Map<WebSocket, ClientState>();

	constructor(private options: BridgeServerOptions) {
		this.wss = new WebSocketServer({ port: options.port, host: "0.0.0.0" });
	}

	start(): void {
		this.wss.on("connection", (socket) => {
			console.log("[bridge] Client connected (waiting for directory selection)");

			const state: ClientState = { socket, pi: null, cwd: null };
			this.clients.set(socket, state);

			// Notify client that we're waiting for directory selection
			socket.send(
				JSON.stringify({
					type: "bridge_event",
					event: "waiting_for_directory",
				}),
			);

			socket.on("message", (raw) => {
				try {
					const obj = JSON.parse(String(raw));

					// Handle directory selection
					if (obj.type === "set_working_directory") {
						this.startPiWithCwd(state, obj.cwd || this.createTempWorkspace());
						return;
					}

					// Handle quick start with temp workspace
					if (obj.type === "use_temp_workspace") {
						this.startPiWithCwd(state, this.createTempWorkspace());
						return;
					}

					// Forward to pi process
					if (state.pi) {
						state.pi.send(obj);
					} else {
						socket.send(
							JSON.stringify({
								type: "bridge_error",
								message: "Please select a working directory first",
							}),
						);
					}
				} catch {
					socket.send(
						JSON.stringify({
							type: "bridge_error",
							message: "Invalid JSON from client",
						}),
					);
				}
			});

			socket.on("close", () => {
				console.log("[bridge] Client disconnected");
				state.pi?.kill();
				this.clients.delete(socket);
			});

			socket.on("error", (err) => {
				console.error("[bridge] WebSocket error:", err);
				state.pi?.kill();
				this.clients.delete(socket);
			});
		});

		console.log(`[bridge] Listening on ws://${this.wss.options.host ?? "0.0.0.0"}:${this.options.port}`);
	}

	private startPiWithCwd(state: ClientState, cwd: string): void {
		// Kill existing pi process if any
		state.pi?.kill();

		console.log(`[bridge] Starting pi in: ${cwd}`);
		state.cwd = cwd;

		const pi = new PiProcess({
			piPath: this.options.piPath,
			cwd: cwd,
		});

		pi.subscribe((event) => {
			if (state.socket.readyState === state.socket.OPEN) {
				state.socket.send(JSON.stringify(event));
			}
		});

		pi.start();
		state.pi = pi;

		// Notify client that pi is ready
		state.socket.send(
			JSON.stringify({
				type: "bridge_event",
				event: "pi_started",
				cwd: cwd,
			}),
		);
	}

	private createTempWorkspace(): string {
		const tempDir = mkdtempSync(join(tmpdir(), "pi-webui-"));
		console.log(`[bridge] Created temp workspace: ${tempDir}`);
		return tempDir;
	}

	stop(): void {
		for (const state of this.clients.values()) {
			state.pi?.kill();
		}
		this.clients.clear();
		this.wss.close();
	}
}
