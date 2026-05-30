import { type WebSocket, WebSocketServer } from "ws";
import { PiProcess } from "./pi-process.ts";

export interface BridgeServerOptions {
	port: number;
	piPath?: string;
	cwd?: string;
}

interface ClientState {
	socket: WebSocket;
	pi: PiProcess;
}

export class BridgeServer {
	private wss: WebSocketServer;
	private clients = new Map<WebSocket, ClientState>();

	constructor(private options: BridgeServerOptions) {
		this.wss = new WebSocketServer({ port: options.port });
	}

	start(): void {
		this.wss.on("connection", (socket) => {
			console.log("[bridge] Client connected");

			const pi = new PiProcess({
				piPath: this.options.piPath,
				cwd: this.options.cwd,
			});

			pi.subscribe((event) => {
				if (socket.readyState === socket.OPEN) {
					socket.send(JSON.stringify(event));
				}
			});

			pi.start();

			socket.on("message", (raw) => {
				try {
					const obj = JSON.parse(String(raw));
					pi.send(obj);
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
				pi.kill();
				this.clients.delete(socket);
			});

			socket.on("error", (err) => {
				console.error("[bridge] WebSocket error:", err);
				pi.kill();
				this.clients.delete(socket);
			});

			this.clients.set(socket, { socket, pi });
		});

		console.log(`[bridge] Listening on ws://localhost:${this.options.port}`);
	}

	stop(): void {
		for (const { pi } of this.clients.values()) {
			pi.kill();
		}
		this.clients.clear();
		this.wss.close();
	}
}
