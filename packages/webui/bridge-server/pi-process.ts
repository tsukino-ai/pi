import { type ChildProcess, spawn } from "node:child_process";
import { createInterface } from "node:readline";

export interface PiProcessOptions {
	/** Absolute path to pi CLI executable. Defaults to `pi` in PATH. */
	piPath?: string;
	/** Working directory for the pi process. */
	cwd?: string;
	/** Environment variables. */
	env?: NodeJS.ProcessEnv;
}

export type PiProcessEvent =
	| { type: "line"; data: unknown }
	| { type: "error"; error: Error }
	| { type: "exit"; code: number | null };

/**
 * Spawn `pi --mode rpc` and provide a typed interface over its stdin/stdout.
 */
export class PiProcess {
	private child: ChildProcess | undefined;
	private callbacks = new Set<(event: PiProcessEvent) => void>();
	private rl: ReturnType<typeof createInterface> | undefined;

	constructor(private options: PiProcessOptions = {}) {}

	start(): void {
		const piPath = this.options.piPath ?? "pi";
		this.child = spawn(piPath, ["--mode", "rpc"], {
			stdio: ["pipe", "pipe", "inherit"],
			cwd: this.options.cwd,
			env: { ...process.env, ...this.options.env },
			shell: process.platform === "win32",
		});

		this.rl = createInterface({ input: this.child.stdout! });

		this.rl.on("line", (line) => {
			try {
				const data = JSON.parse(line);
				this.emit({ type: "line", data });
			} catch {
				// Ignore non-JSON lines (e.g., stray stdout)
			}
		});

		this.child.on("error", (error) => {
			this.emit({ type: "error", error });
		});

		this.child.on("exit", (code) => {
			this.emit({ type: "exit", code });
		});
	}

	/**
	 * Send a JSON object to pi's stdin.
	 */
	send(obj: unknown): void {
		if (!this.child?.stdin) {
			throw new Error("Pi process not started or stdin unavailable");
		}
		this.child.stdin.write(`${JSON.stringify(obj)}\n`);
	}

	/**
	 * Subscribe to events from the pi process.
	 */
	subscribe(callback: (event: PiProcessEvent) => void): () => void {
		this.callbacks.add(callback);
		return () => {
			this.callbacks.delete(callback);
		};
	}

	/**
	 * Kill the pi process.
	 */
	kill(signal: NodeJS.Signals = "SIGTERM"): void {
		this.rl?.close();
		this.child?.kill(signal);
	}

	private emit(event: PiProcessEvent): void {
		for (const cb of this.callbacks) {
			cb(event);
		}
	}
}
