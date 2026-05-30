import { FolderOpenOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Button, Input, Modal, Space } from "antd";
import { useEffect, useState } from "react";

export interface DirectoryPickerProps {
	visible: boolean;
	onSelect: (cwd: string) => void;
	onUseTemp: () => void;
}

const RECENT_DIRS_KEY = "pi-webui-recent-dirs";

function getRecentDirs(): string[] {
	try {
		const saved = localStorage.getItem(RECENT_DIRS_KEY);
		return saved ? JSON.parse(saved) : [];
	} catch {
		return [];
	}
}

function saveRecentDir(dir: string) {
	const recent = getRecentDirs();
	const updated = [dir, ...recent.filter((d) => d !== dir)].slice(0, 10);
	localStorage.setItem(RECENT_DIRS_KEY, JSON.stringify(updated));
}

export function DirectoryPicker({ visible, onSelect, onUseTemp }: DirectoryPickerProps) {
	const [recentDirs, setRecentDirs] = useState<string[]>([]);
	const [inputValue, setInputValue] = useState("");

	useEffect(() => {
		if (visible) {
			setRecentDirs(getRecentDirs());
		}
	}, [visible]);

	const handleSelect = (dir: string) => {
		if (!dir.trim()) return;
		saveRecentDir(dir.trim());
		onSelect(dir.trim());
	};

	return (
		<Modal title="选择工作目录" open={visible} closable={false} maskClosable={false} footer={null} width={500}>
			<div style={{ marginBottom: 16 }}>
				<p style={{ color: "#666", marginBottom: 12 }}>选择一个项目目录作为工作空间，或使用临时目录快速开始。</p>

				<Button
					type="primary"
					icon={<ThunderboltOutlined />}
					block
					size="large"
					onClick={onUseTemp}
					style={{ marginBottom: 16 }}
				>
					快速开始（临时工作空间）
				</Button>
			</div>

			{recentDirs.length > 0 && (
				<div style={{ marginBottom: 16 }}>
					<h4 style={{ marginBottom: 8 }}>最近使用</h4>
					<Space direction="vertical" style={{ width: "100%" }}>
						{recentDirs.map((dir) => (
							<Button
								key={dir}
								block
								icon={<FolderOpenOutlined />}
								style={{ textAlign: "left" }}
								onClick={() => handleSelect(dir)}
							>
								{dir}
							</Button>
						))}
					</Space>
				</div>
			)}

			<div>
				<h4 style={{ marginBottom: 8 }}>输入目录路径</h4>
				<Input.Search
					placeholder="例如: C:\Users\you\projects\my-app"
					value={inputValue}
					onChange={(e) => setInputValue(e.target.value)}
					onSearch={handleSelect}
					enterButton="打开"
				/>
			</div>
		</Modal>
	);
}
