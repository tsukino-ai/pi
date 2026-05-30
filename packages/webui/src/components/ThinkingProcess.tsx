import { BulbOutlined, CheckCircleOutlined, LoadingOutlined } from "@ant-design/icons";
import { ThoughtChain } from "@ant-design/x";

export interface ThinkingStep {
	id: string;
	title: string;
	content: string;
	status: "pending" | "success" | "error";
}

export interface ThinkingProcessProps {
	steps: ThinkingStep[];
}

const STATUS_ICONS = {
	pending: <LoadingOutlined />,
	success: <CheckCircleOutlined style={{ color: "#52c41a" }} />,
	error: <BulbOutlined style={{ color: "#ff4d4f" }} />,
};

export function ThinkingProcess({ steps }: ThinkingProcessProps) {
	if (steps.length === 0) return null;

	return (
		<ThoughtChain
			items={steps.map((step) => ({
				key: step.id,
				title: step.title,
				description: step.content,
				icon: STATUS_ICONS[step.status],
				status: step.status,
			}))}
			collapsible
			size="small"
			style={{ marginBottom: 8, padding: 8, background: "#fafafa", borderRadius: 8 }}
		/>
	);
}
