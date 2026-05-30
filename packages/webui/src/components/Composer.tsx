import { Sender } from "@ant-design/x";

export interface ComposerProps {
	onSend: (message: string) => void;
	onCancel?: () => void;
	disabled?: boolean;
	loading?: boolean;
}

export function Composer({ onSend, onCancel, disabled, loading }: ComposerProps) {
	return (
		<Sender
			onSubmit={onSend}
			onCancel={onCancel}
			loading={loading}
			disabled={disabled}
			placeholder="Type a message... (Enter to send)"
			style={{ margin: 12 }}
		/>
	);
}
