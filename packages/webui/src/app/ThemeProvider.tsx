import { ConfigProvider, theme } from "antd";
import { createContext, useContext, useEffect, useState } from "react";

type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
	mode: ThemeMode;
	setMode: (mode: ThemeMode) => void;
	isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
	mode: "light",
	setMode: () => {},
	isDark: false,
});

export function useTheme() {
	return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [mode, setModeState] = useState<ThemeMode>(() => {
		const stored = localStorage.getItem("pi-webui-theme");
		if (stored === "light" || stored === "dark" || stored === "system") return stored;
		return "system";
	});

	const [isDark, setIsDark] = useState(false);

	useEffect(() => {
		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const update = () => {
			setIsDark(mode === "dark" || (mode === "system" && media.matches));
		};
		update();
		media.addEventListener("change", update);
		return () => media.removeEventListener("change", update);
	}, [mode]);

	const setMode = (m: ThemeMode) => {
		localStorage.setItem("pi-webui-theme", m);
		setModeState(m);
	};

	return (
		<ThemeContext.Provider value={{ mode, setMode, isDark }}>
			<ConfigProvider theme={{ algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm }}>
				{children}
			</ConfigProvider>
		</ThemeContext.Provider>
	);
}
