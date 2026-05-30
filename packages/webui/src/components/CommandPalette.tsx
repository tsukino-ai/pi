import { Prompts } from "@ant-design/x";
import { useEffect } from "react";
import type { RpcCommand } from "../bridge/types.ts";

interface Command {
	name: string;
	description?: string;
	source: string;
}

export interface CommandPaletteProps {
	visible: boolean;
	commands: Command[];
	onSelect: (command: string) => void;
	onClose: () => void;
	send: (command: RpcCommand) => void;
}

export function CommandPalette({ visible, commands, onSelect, onClose, send }: CommandPaletteProps) {
	useEffect(() => {
		if (visible && commands.length === 0) {
			send({ type: "get_commands" });
		}
	}, [visible, commands.length, send]);

	if (!visible) return null;

	return (
		<Prompts
			items={commands.map((cmd) => ({
				key: cmd.name,
				label: `/${cmd.name}`,
				description: cmd.description ?? cmd.source,
			}))}
			onItemClick={(info) => {
				onSelect(info.data.key);
				onClose();
			}}
			style={{ marginBottom: 8, padding: "0 16px" }}
		/>
	);
}
