import { Welcome } from "@ant-design/x";
import { CommentOutlined } from "@ant-design/icons";
import { usePiChat } from "./hooks/usePiChat.ts";
import { ChatView } from "./components/ChatView.tsx";
import { Composer } from "./components/Composer.tsx";
import { StatusBar } from "./components/StatusBar.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";

export function App() {
	const {
		messages,
		streamingMessage,
		status,
		connected,
		onRequest,
		onAbort,
	} = usePiChat();

	const showWelcome = messages.length === 0 && !streamingMessage;

	return (
		<ErrorBoundary>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					height: "100dvh",
					overflow: "hidden",
					background: "#fff",
				}}
			>
				{showWelcome ? (
					<div
						style={{
							flex: 1,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							padding: 24,
						}}
					>
						<Welcome
							icon={
								<CommentOutlined style={{ fontSize: 48, color: "#1677ff" }} />
							}
							title="pi WebUI"
							description="Connect to bridge and start chatting with your AI agent."
						/>
					</div>
				) : (
					<ChatView
						messages={messages}
						streamingMessage={streamingMessage}
						status={status}
					/>
				)}
				<Composer
					onSend={onRequest}
					onAbort={onAbort}
					disabled={!connected || status === "loading"}
					loading={status === "loading"}
				/>
				<StatusBar
					connected={connected}
					isStreaming={status === "loading"}
				/>
			</div>
		</ErrorBoundary>
	);
}
