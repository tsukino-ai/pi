import "./styles/index.css";
import { createRoot } from "react-dom/client";
import { App } from "./app/App.tsx";
import { ThemeProvider } from "./app/ThemeProvider.tsx";

const root = createRoot(document.getElementById("root")!);
root.render(
	<ThemeProvider>
		<App />
	</ThemeProvider>,
);
