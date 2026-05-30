import { RobotOutlined } from "@ant-design/icons";
import { Welcome } from "@ant-design/x";
import { Button, Space } from "antd";

export interface WelcomeScreenProps {
	onQuickStart: () => void;
	onSelectDirectory: () => void;
}

export function WelcomeScreen({ onQuickStart, onSelectDirectory }: WelcomeScreenProps) {
	return (
		<div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", padding: 48 }}>
			<Welcome
				icon={<RobotOutlined style={{ fontSize: 48 }} />}
				title="Pi AI Assistant"
				description="I can help you with coding, debugging, file operations, and more. Select a project directory to get started."
				variant="borderless"
				extra={
					<Space>
						<Button type="primary" size="large" onClick={onSelectDirectory}>
							Select Project Directory
						</Button>
						<Button size="large" onClick={onQuickStart}>
							Quick Start
						</Button>
					</Space>
				}
			/>
		</div>
	);
}
