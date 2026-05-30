import { Sender } from "@ant-design/x";

export interface ComposerProps {
	onSend: (message: string) => void;
	disabled?: boolean;
	loading?: boolean;
}

export function Composer({ onSend, disabled, loading }: ComposerProps) {
	return (
		<div
			style={{
				padding: "0 16px",
				paddingBottom: "max(12px, env(safe-area-inset-bottom))",
				background: "#fff",
			}}
		>
			<Sender
				onSubmit={onSend}
				disabled={disabled}
				loading={loading}
				submitType="shiftEnter"
				placeholder="Shift + Enter to send"
			/>
		</div>
	);
}
