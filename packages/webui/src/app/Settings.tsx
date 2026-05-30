import { Radio, Space } from "antd";
import { useTheme } from "./ThemeProvider.tsx";

export function Settings() {
	const { mode, setMode } = useTheme();

	return (
		<Space direction="vertical" style={{ width: "100%" }} size="middle">
			<div>
				<label htmlFor="theme-select" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
					Theme
				</label>
				<Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
					<Radio.Button value="light">Light</Radio.Button>
					<Radio.Button value="dark">Dark</Radio.Button>
					<Radio.Button value="system">System</Radio.Button>
				</Radio.Group>
			</div>
		</Space>
	);
}
