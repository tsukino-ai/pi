import { Sender } from "@ant-design/x";
import { Tag } from "antd";
import type { SessionStats } from "../bridge/types.ts";

export interface ComposerProps {
	onSend: (message: string) => void;
	onCancel?: () => void;
	disabled?: boolean;
	loading?: boolean;
	sessionName?: string;
	sessionStats?: SessionStats;
}

export function Composer({ onSend, onCancel, disabled, loading, sessionName, sessionStats }: ComposerProps) {
	return (
		<Sender
			onSubmit={onSend}
			onCancel={onCancel}
			loading={loading}
			disabled={disabled}
			placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
			style={{ margin: 12 }}
			header={
				sessionName ? (
					<div style={{ padding: "4px 12px", borderBottom: "1px solid #f0f0f0", fontSize: 12, color: "#888" }}>
						📁 {sessionName}
						{sessionStats && (
							<Tag style={{ marginLeft: 8 }} color="blue">
								{sessionStats.totalMessages} messages
							</Tag>
						)}
					</div>
				) : undefined
			}
			footer={
				<div style={{ padding: "4px 12px", fontSize: 11, color: "#bbb" }}>
					Press / for commands • Ctrl+Enter to send
				</div>
			}
		/>
	);
}
