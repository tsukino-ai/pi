import "./styles/index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App.tsx";
import { ThemeProvider } from "./app/ThemeProvider.tsx";

const root = createRoot(document.getElementById("root")!);
root.render(
	<StrictMode>
		<ThemeProvider>
			<App />
		</ThemeProvider>
	</StrictMode>,
);
