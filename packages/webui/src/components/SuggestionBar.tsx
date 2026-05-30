import { BulbOutlined } from "@ant-design/icons";
import { Prompts } from "@ant-design/x";

export interface Suggestion {
	id: string;
	text: string;
	description?: string;
}

export interface SuggestionBarProps {
	suggestions: Suggestion[];
	onSelect: (suggestion: Suggestion) => void;
	visible: boolean;
}

export function SuggestionBar({ suggestions, onSelect, visible }: SuggestionBarProps) {
	if (!visible || suggestions.length === 0) return null;

	return (
		<Prompts
			items={suggestions.map((s) => ({
				key: s.id,
				label: s.text,
				description: s.description,
				icon: <BulbOutlined />,
			}))}
			onItemClick={(info) => {
				const suggestion = suggestions.find((s) => s.id === info.data.key);
				if (suggestion) onSelect(suggestion);
			}}
			style={{ padding: "0 16px", marginBottom: 8 }}
		/>
	);
}

export const DEFAULT_SUGGESTIONS: Suggestion[] = [
	{ id: "help", text: "What can you help me with?", description: "Learn about capabilities" },
	{ id: "code", text: "Help me write code", description: "Start a coding task" },
	{ id: "debug", text: "Debug an issue", description: "Troubleshoot a problem" },
];
