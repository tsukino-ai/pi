import { CopyOutlined, DownloadOutlined, EditOutlined, ForkOutlined, PlusOutlined } from "@ant-design/icons";
import { Conversations } from "@ant-design/x";
import { Button, Input, Modal } from "antd";
import { useState } from "react";
import type { RpcCommand } from "../bridge/types.ts";

export interface Session {
	id: string;
	name: string;
	lastMessage: string;
	timestamp: number;
}

export interface SessionListProps {
	sessions: Session[];
	currentSessionId?: string;
	send: (command: RpcCommand) => void;
	onSwitch: (sessionId: string) => void;
}

export function SessionList({ sessions, currentSessionId, send, onSwitch }: SessionListProps) {
	const [renameModalOpen, setRenameModalOpen] = useState(false);
	const [renameTarget, setRenameTarget] = useState<string | null>(null);
	const [newName, setNewName] = useState("");

	const handleMenuClick = (key: string, sessionId: string) => {
		switch (key) {
			case "rename":
				setRenameTarget(sessionId);
				setNewName(sessions.find((s) => s.id === sessionId)?.name ?? "");
				setRenameModalOpen(true);
				break;
			case "fork":
				send({ type: "fork", entryId: sessionId });
				break;
			case "clone":
				send({ type: "clone" });
				break;
			case "export":
				send({ type: "export_html" });
				break;
		}
	};

	const handleRename = () => {
		if (renameTarget && newName) {
			send({ type: "set_session_name", name: newName });
			setRenameModalOpen(false);
		}
	};

	return (
		<div>
			<Button
				type="primary"
				icon={<PlusOutlined />}
				block
				onClick={() => send({ type: "new_session" })}
				style={{ marginBottom: 12 }}
			>
				New Session
			</Button>

			<Conversations
				items={sessions.map((s) => ({
					key: s.id,
					label: s.name || "Untitled",
					description: s.lastMessage?.slice(0, 50),
				}))}
				activeKey={currentSessionId}
				onActiveChange={onSwitch}
				menu={(item) => ({
					items: [
						{ key: "rename", label: "Rename", icon: <EditOutlined /> },
						{ key: "fork", label: "Fork", icon: <ForkOutlined /> },
						{ key: "clone", label: "Clone", icon: <CopyOutlined /> },
						{ type: "divider" as const },
						{ key: "export", label: "Export HTML", icon: <DownloadOutlined /> },
					],
					onClick: ({ key }) => handleMenuClick(key, item.key),
				})}
				groupable
			/>

			<Modal
				title="Rename Session"
				open={renameModalOpen}
				onOk={handleRename}
				onCancel={() => setRenameModalOpen(false)}
			>
				<Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Session name" />
			</Modal>
		</div>
	);
}
