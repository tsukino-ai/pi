import { Select, Space, Switch } from "antd";
import type { RpcCommand } from "../bridge/types.ts";

export interface ModelConfigProps {
	send: (command: RpcCommand) => void;
	thinkingLevel: string;
	steeringMode: string;
	autoCompaction: boolean;
	autoRetry: boolean;
}

const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;

export function ModelConfig({ send, thinkingLevel, steeringMode, autoCompaction, autoRetry }: ModelConfigProps) {
	return (
		<Space direction="vertical" style={{ width: "100%" }} size="middle">
			<div>
				<label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Thinking Level</label>
				<Select
					style={{ width: "100%" }}
					value={thinkingLevel}
					options={THINKING_LEVELS.map((l) => ({ value: l, label: l }))}
					onChange={(v) => send({ type: "set_thinking_level", level: v })}
				/>
			</div>
			<div>
				<label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Steering Mode</label>
				<Select
					style={{ width: "100%" }}
					value={steeringMode}
					options={[
						{ value: "all", label: "All" },
						{ value: "one-at-a-time", label: "One at a time" },
					]}
					onChange={(v) => send({ type: "set_steering_mode", mode: v })}
				/>
			</div>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
				<span style={{ fontWeight: 500 }}>Auto Compaction</span>
				<Switch checked={autoCompaction} onChange={(v) => send({ type: "set_auto_compaction", enabled: v })} />
			</div>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
				<span style={{ fontWeight: 500 }}>Auto Retry</span>
				<Switch checked={autoRetry} onChange={(v) => send({ type: "set_auto_retry", enabled: v })} />
			</div>
		</Space>
	);
}
