import { useCallback, useState } from "react";
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
	const { connected } = useBridge();
	const [status] = useState<ChatStatus>("idle");

	const onRequest = useCallback(() => {}, []);
	const onAbort = useCallback(() => {}, []);

	return {
		messages: [],
		streamingMessage: undefined,
		status,
		connected,
		onRequest,
		onAbort,
	};
}
