import { Button, Dropdown, Empty, List } from "antd";
import {
	DownloadOutlined,
	EditOutlined,
	ForkOutlined,
	PlusOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { useState } from "react";
import type { RpcCommand } from "../bridge/types.ts";

export interface SessionListProps {
	send: (command: RpcCommand) => void;
}

interface SessionItem {
	id: string;
	name: string;
	lastMessage: string;
}

export function SessionList({ send }: SessionListProps) {
	const [sessions, setSessions] = useState<SessionItem[]>([]);

	const handleNew = () => {
		send({ type: "new_session" });
	};

	const getMenuItems = (session: SessionItem): MenuProps["items"] => [
		{
			key: "rename",
			icon: <EditOutlined />,
			label: "Rename",
			onClick: () => {
				const name = prompt("New name:", session.name);
				if (name) send({ type: "set_session_name", name });
			},
		},
		{
			key: "fork",
			icon: <ForkOutlined />,
			label: "Fork",
			onClick: () => send({ type: "fork", entryId: session.id }),
		},
		{
			key: "export",
			icon: <DownloadOutlined />,
			label: "Export HTML",
			onClick: () => send({ type: "export_html" }),
		},
	];

	return (
		<div>
			<Button type="primary" icon={<PlusOutlined />} block onClick={handleNew} style={{ marginBottom: 12 }}>
				New Session
			</Button>
			{sessions.length === 0 ? (
				<Empty description="No sessions yet" />
			) : (
				<List
					dataSource={sessions}
					renderItem={(s) => (
						<List.Item
							actions={[
								<Dropdown key="menu" menu={{ items: getMenuItems(s) }} placement="bottomRight">
									<Button size="small">...</Button>
								</Dropdown>,
							]}
						>
							<List.Item.Meta title={s.name} description={s.lastMessage} />
						</List.Item>
					)}
				/>
			)}
		</div>
	);
}
