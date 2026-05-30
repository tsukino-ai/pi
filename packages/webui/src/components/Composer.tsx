import { Button, Input } from "antd";
import { type KeyboardEvent, useState } from "react";

export interface ComposerProps {
	onSend: (message: string) => void;
	disabled?: boolean;
}

export function Composer({ onSend, disabled }: ComposerProps) {
	const [text, setText] = useState("");

	const handleSend = () => {
		const trimmed = text.trim();
		if (!trimmed || disabled) return;
		onSend(trimmed);
		setText("");
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			handleSend();
		}
	};

	return (
		<div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid #f0f0f0" }}>
			<Input.TextArea
				value={text}
				onChange={(e) => setText(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder="Type a message... (Ctrl+Enter to send)"
				autoSize={{ minRows: 1, maxRows: 6 }}
				disabled={disabled}
				style={{ flex: 1 }}
			/>
			<Button type="primary" onClick={handleSend} disabled={disabled || !text.trim()}>
				Send
			</Button>
		</div>
	);
}
