import {
	CopyOutlined,
	DownloadOutlined,
	EditOutlined,
	FolderOpenOutlined,
	ForkOutlined,
	PlusOutlined,
} from "@ant-design/icons";
import { Conversations } from "@ant-design/x";
import { Button, Collapse, Input, Modal, Tag } from "antd";
import { useMemo, useState } from "react";
import type { RpcCommand } from "../bridge/types.ts";

export interface Session {
	sessionId: string;
	workDir: string;
	workDirHash: string;
	title: string;
	lastUpdated: number;
	turns: number;
}

export interface SessionListProps {
	sessions: Session[];
	currentSessionId?: string;
	currentCwd?: string;
	send: (command: RpcCommand) => void;
	onSwitch: (sessionPath: string) => void;
	onChangeCwd: (cwd: string) => void;
}

function shortProjectName(workDir: string): string {
	if (!workDir) return "Unknown";
	const parts = workDir.replace(/[/\\]$/, "").split(/[/\\]/);
	return parts[parts.length - 1] || workDir;
}

export function SessionList({ sessions, currentSessionId, currentCwd, send, onSwitch, onChangeCwd }: SessionListProps) {
	const [renameModalOpen, setRenameModalOpen] = useState(false);
	const [renameTarget, setRenameTarget] = useState<string | null>(null);
	const [newName, setNewName] = useState("");

	// Group sessions by workDir
	const groupedSessions = useMemo(() => {
		const groups = new Map<string, Session[]>();
		for (const session of sessions) {
			const key = session.workDir;
			if (!groups.has(key)) {
				groups.set(key, []);
			}
			groups.get(key)!.push(session);
		}
		// Sort groups by most recent session
		return Array.from(groups.entries()).sort((a, b) => {
			const maxA = Math.max(...a[1].map((s) => s.lastUpdated));
			const maxB = Math.max(...b[1].map((s) => s.lastUpdated));
			return maxB - maxA;
		});
	}, [sessions]);

	const handleMenuClick = (key: string, sessionPath: string) => {
		switch (key) {
			case "rename": {
				setRenameTarget(sessionPath);
				const session = sessions.find((s) => `${s.workDirHash}/${s.sessionId}` === sessionPath);
				setNewName(session?.title ?? "");
				setRenameModalOpen(true);
				break;
			}
			case "fork":
				send({ type: "fork", entryId: sessionPath.split("/")[1] });
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

			<Collapse
				ghost
				defaultActiveKey={groupedSessions.map(([dir]) => dir)}
				items={groupedSessions.map(([workDir, dirSessions]) => ({
					key: workDir,
					label: (
						<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
							<FolderOpenOutlined />
							<span>{shortProjectName(workDir)}</span>
							<Tag>{dirSessions.length}</Tag>
							{workDir === currentCwd && <Tag color="blue">Current</Tag>}
						</div>
					),
					extra:
						workDir !== currentCwd ? (
							<Button
								size="small"
								onClick={(e) => {
									e.stopPropagation();
									onChangeCwd(workDir);
								}}
							>
								Switch
							</Button>
						) : null,
					children: (
						<Conversations
							items={dirSessions.map((s) => ({
								key: `${s.workDirHash}/${s.sessionId}`,
								label: s.title || s.sessionId.slice(0, 8),
								description: (
									<div>
										<div>{s.turns} messages</div>
										<div style={{ fontSize: 11, color: "#bbb" }}>
											{new Date(s.lastUpdated).toLocaleDateString()}
										</div>
									</div>
								),
							}))}
							activeKey={
								currentSessionId
									? `${sessions.find((s) => s.sessionId === currentSessionId)?.workDirHash}/${currentSessionId}`
									: undefined
							}
							onActiveChange={onSwitch}
							menu={(item) => ({
								items: [
									{ key: "rename", label: "Rename", icon: <EditOutlined /> },
									{ key: "fork", label: "Fork", icon: <ForkOutlined /> },
									{ key: "clone", label: "Clone", icon: <CopyOutlined /> },
									{ type: "divider" as const },
									{
										key: "export",
										label: "Export HTML",
										icon: <DownloadOutlined />,
									},
								],
								onClick: ({ key }) => handleMenuClick(key, item.key),
							})}
						/>
					),
				}))}
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
