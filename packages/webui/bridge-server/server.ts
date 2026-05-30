import { mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { type WebSocket, WebSocketServer } from "ws";
import { PiProcess } from "./pi-process.ts";

export interface BridgeServerOptions {
	port: number;
	piPath?: string;
}

interface SessionInfo {
	sessionId: string;
	workDir: string;
	workDirHash: string;
	title: string;
	lastUpdated: number;
	turns: number;
}

interface ClientState {
	socket: WebSocket;
	pi: PiProcess | null;
	cwd: string | null;
}

export class BridgeServer {
	private wss: WebSocketServer;
	private clients = new Map<WebSocket, ClientState>();
	private sessionsDir: string;

	constructor(private options: BridgeServerOptions) {
		this.wss = new WebSocketServer({ port: options.port, host: "0.0.0.0" });
		this.sessionsDir = join(homedir(), ".pi", "agent", "sessions");
	}

	start(): void {
		this.wss.on("connection", (socket) => {
			console.log("[bridge] Client connected");

			const state: ClientState = { socket, pi: null, cwd: null };
			this.clients.set(socket, state);

			// Send available sessions immediately
			this.sendSessionList(socket);

			socket.on("message", (raw) => {
				try {
					const obj = JSON.parse(String(raw));

					// Handle directory selection - start/restart pi
					if (obj.type === "set_working_directory") {
						this.startPiWithCwd(state, obj.cwd || this.createTempWorkspace());
						return;
					}

					// Handle temp workspace
					if (obj.type === "use_temp_workspace") {
						this.startPiWithCwd(state, this.createTempWorkspace());
						return;
					}

					// Handle session switch (may need different cwd)
					if (obj.type === "switch_session") {
						this.handleSessionSwitch(state, obj.sessionPath);
						return;
					}

					// Handle list sessions request
					if (obj.type === "list_sessions") {
						this.sendSessionList(socket);
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

	private handleSessionSwitch(state: ClientState, sessionPath: string): void {
		// Parse work_dir_hash/session_id format
		const parts = sessionPath.split("/");
		if (parts.length === 2) {
			const [workDirHash, sessionId] = parts;
			// Find the actual work_dir from the hash
			const session = this.findSessionByHashAndId(workDirHash, sessionId);
			if (session) {
				// If different cwd, restart pi
				if (state.cwd !== session.workDir) {
					console.log(`[bridge] Switching to session in: ${session.workDir}`);
					this.startPiWithCwd(state, session.workDir);
				}
				// Send switch command to pi
				if (state.pi) {
					state.pi.send({ type: "switch_session", sessionPath: sessionId });
				}
			}
		}
	}

	private findSessionByHashAndId(workDirHash: string, sessionId: string): SessionInfo | null {
		try {
			const dirs = readdirSync(this.sessionsDir);
			for (const dir of dirs) {
				if (this.hashDir(dir) === workDirHash) {
					const workDir = this.decodeDirName(dir);
					const sessionFile = join(this.sessionsDir, dir, `${sessionId}.jsonl`);
					try {
						statSync(sessionFile);
						return {
							sessionId,
							workDir,
							workDirHash,
							title: sessionId.slice(0, 8),
							lastUpdated: 0,
							turns: 0,
						};
					} catch {
						// File doesn't exist
					}
				}
			}
		} catch {
			// Ignore errors
		}
		return null;
	}

	private sendSessionList(socket: WebSocket): void {
		const sessions = this.listAllSessions();
		socket.send(
			JSON.stringify({
				type: "bridge_event",
				event: "session_list",
				sessions,
			}),
		);
	}

	private listAllSessions(): SessionInfo[] {
		const sessions: SessionInfo[] = [];
		try {
			const dirs = readdirSync(this.sessionsDir);
			for (const dir of dirs) {
				const dirPath = join(this.sessionsDir, dir);
				if (!statSync(dirPath).isDirectory()) continue;

				const workDir = this.decodeDirName(dir);
				const workDirHash = this.hashDir(dir);
				const files = readdirSync(dirPath).filter((f) => f.endsWith(".jsonl"));

				for (const file of files) {
					const sessionId = file.replace(".jsonl", "");
					const filePath = join(dirPath, file);
					try {
						const content = readFileSync(filePath, "utf-8");
						const lines = content.trim().split("\n").filter(Boolean);
						sessions.push({
							sessionId,
							workDir,
							workDirHash,
							title: sessionId.slice(0, 8),
							lastUpdated: statSync(filePath).mtimeMs,
							turns: lines.length,
						});
					} catch {
						// Skip unreadable files
					}
				}
			}
		} catch {
			// Ignore errors
		}
		return sessions.sort((a, b) => b.lastUpdated - a.lastUpdated);
	}

	private decodeDirName(dirName: string): string {
		// "--C--Users-65493-wxr-projects-pi--" -> "C:\Users\65493\wxr\projects\pi"
		return dirName.replace(/^--/, "").replace(/--$/, "").replace(/-/g, "\\");
	}

	private hashDir(dirName: string): string {
		// Simple hash for directory name
		let hash = 0;
		for (let i = 0; i < dirName.length; i++) {
			const char = dirName.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash |= 0;
		}
		return Math.abs(hash).toString(36);
	}

	private startPiWithCwd(state: ClientState, cwd: string): void {
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

		state.socket.send(
			JSON.stringify({
				type: "bridge_event",
				event: "pi_started",
				cwd: cwd,
			}),
		);
	}

	private createTempWorkspace(): string {
		return mkdtempSync(join(tmpdir(), "pi-webui-"));
	}

	stop(): void {
		for (const state of this.clients.values()) {
			state.pi?.kill();
		}
		this.clients.clear();
		this.wss.close();
	}
}
