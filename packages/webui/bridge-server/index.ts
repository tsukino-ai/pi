import { BridgeServer } from "./server.ts";

const PORT = Number(process.env.PI_WEBUI_BRIDGE_PORT ?? "8080");
const PI_PATH = process.env.PI_WEBUI_PI_PATH;
const CWD = process.env.PI_WEBUI_CWD;

const server = new BridgeServer({
	port: PORT,
	piPath: PI_PATH,
	cwd: CWD,
});

server.start();

process.on("SIGINT", () => {
	console.log("[bridge] Shutting down...");
	server.stop();
	process.exit(0);
});

process.on("SIGTERM", () => {
	server.stop();
	process.exit(0);
});
