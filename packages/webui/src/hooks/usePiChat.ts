import { useCallback, useMemo } from "react";
import type { AgentMessage, ImageContent } from "../bridge/types.ts";
import { useBridge } from "../bridge/useBridge.ts";

export type ChatStatus = "idle" | "loading" | "error";

export interface UsePiChatReturn {
	messages: AgentMessage[];
	streamingMessage?: AgentMessage;
	status: ChatStatus;
	connected: boolean;
	onRequest: (message: string, images?: ImageContent[]) => void;
	onAbort: () => void;
}

export function usePiChat(): UsePiChatReturn {
	const { connected, events } = useBridge();

	const state = useMemo(() => {
		const messages: AgentMessage[] = [];
		let streamingMessage: AgentMessage | undefined;
		let status: ChatStatus = "idle";

		for (const event of events) {
			if (event.type === "rpc_event") {
				const payload = event.payload as Record<string, unknown>;
				if (payload.type === "agent_start") status = "loading";
				if (payload.type === "agent_end") {
					status = "idle";
					streamingMessage = undefined;
				}
				if (payload.type === "message_end" && payload.message) {
					messages.push(payload.message as AgentMessage);
					streamingMessage = undefined;
				}
				if (payload.type === "message_update" && payload.message)
					streamingMessage = payload.message as AgentMessage;
			}
			if (event.type === "rpc_response") {
				const resp = event.payload;
				if (resp.success === false) status = "error";
			}
		}

		return { messages, streamingMessage, status };
	}, [events]);

	const onRequest = useCallback(() => {}, []);
	const onAbort = useCallback(() => {}, []);

	return {
		...state,
		connected,
		onRequest,
		onAbort,
	};
}
