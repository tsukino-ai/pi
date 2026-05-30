import { CodeOutlined, MessageOutlined, SettingOutlined, SlidersOutlined } from "@ant-design/icons";
import { Layout, Menu } from "antd";
import { useState } from "react";
import type { Model, RpcCommand } from "../bridge/types.ts";
import { BashTerminal } from "../components/BashTerminal.tsx";
import { ModelConfig } from "./ModelConfig.tsx";
import { type Session, SessionList } from "./SessionList.tsx";
import { Settings } from "./Settings.tsx";

const { Sider } = Layout;

type SidebarTab = "sessions" | "models" | "bash" | "settings";

export interface SidebarProps {
	send: (command: RpcCommand) => void;
	thinkingLevel: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
	steeringMode: "all" | "one-at-a-time";
	autoCompaction: boolean;
	autoRetry: boolean;
	sessions?: Session[];
	currentSessionId?: string;
	onSessionSwitch?: (sessionId: string) => void;
	currentModel?: Model;
	availableModels?: Model[];
	bashOutput?: string;
	bashIsRunning?: boolean;
}

export function Sidebar({
	send,
	thinkingLevel,
	steeringMode,
	autoCompaction,
	autoRetry,
	sessions = [],
	currentSessionId,
	onSessionSwitch,
	currentModel,
	availableModels = [],
	bashOutput,
	bashIsRunning = false,
}: SidebarProps) {
	const [activeTab, setActiveTab] = useState<SidebarTab>("sessions");

	return (
		<Sider width={280} theme="light" style={{ borderRight: "1px solid #f0f0f0", overflow: "auto" }}>
			<Menu
				mode="horizontal"
				selectedKeys={[activeTab]}
				onClick={(e) => setActiveTab(e.key as SidebarTab)}
				items={[
					{ key: "sessions", icon: <MessageOutlined />, label: "Sessions" },
					{ key: "models", icon: <SlidersOutlined />, label: "Models" },
					{ key: "bash", icon: <CodeOutlined />, label: "Bash" },
					{ key: "settings", icon: <SettingOutlined />, label: "Settings" },
				]}
			/>
			<div style={{ padding: 12 }}>
				{activeTab === "sessions" && (
					<SessionList
						sessions={sessions}
						currentSessionId={currentSessionId}
						send={send}
						onSwitch={onSessionSwitch ?? (() => {})}
					/>
				)}
				{activeTab === "models" && (
					<ModelConfig
						send={send}
						currentModel={currentModel}
						thinkingLevel={thinkingLevel}
						steeringMode={steeringMode}
						autoCompaction={autoCompaction}
						autoRetry={autoRetry}
						availableModels={availableModels}
					/>
				)}
				{activeTab === "bash" && <BashTerminal send={send} isRunning={bashIsRunning} output={bashOutput} />}
				{activeTab === "settings" && <Settings />}
			</div>
		</Sider>
	);
}
