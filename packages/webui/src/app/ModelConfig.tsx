import { Select, Space, Switch } from "antd";
import type { Model, RpcCommand } from "../bridge/types.ts";

export interface ModelConfigProps {
	send: (command: RpcCommand) => void;
	currentModel?: Model;
	thinkingLevel: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
	steeringMode: "all" | "one-at-a-time";
	autoCompaction: boolean;
	autoRetry: boolean;
	availableModels?: Model[];
}

const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;

export function ModelConfig({
	send,
	currentModel,
	thinkingLevel,
	steeringMode,
	autoCompaction,
	autoRetry,
	availableModels = [],
}: ModelConfigProps) {
	return (
		<Space direction="vertical" style={{ width: "100%" }} size="middle">
			<div>
				<label htmlFor="model-select" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
					Model
				</label>
				<Select
					id="model-select"
					style={{ width: "100%" }}
					value={currentModel?.id}
					placeholder="Select model"
					showSearch
					optionFilterProp="label"
					onDropdownVisibleChange={(open) => {
						if (open && availableModels.length === 0) {
							send({ type: "get_available_models" });
						}
					}}
					options={availableModels.map((m) => ({
						value: m.id,
						label: m.name,
					}))}
					onChange={(value) => {
						const model = availableModels.find((m) => m.id === value);
						if (model) {
							send({ type: "set_model", provider: model.provider, modelId: model.id });
						}
					}}
				/>
			</div>
			<div>
				<label htmlFor="thinking-level" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
					Thinking Level
				</label>
				<Select
					id="thinking-level"
					style={{ width: "100%" }}
					value={thinkingLevel}
					options={THINKING_LEVELS.map((l) => ({ value: l, label: l }))}
					onChange={(v) => send({ type: "set_thinking_level", level: v })}
				/>
			</div>
			<div>
				<label htmlFor="steering-mode" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
					Steering Mode
				</label>
				<Select
					id="steering-mode"
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
