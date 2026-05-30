import "./styles/index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { XProvider } from "@ant-design/x";
import { App } from "./App.tsx";

const root = createRoot(document.getElementById("root")!);
root.render(
	<StrictMode>
		<XProvider>
			<App />
		</XProvider>
	</StrictMode>,
);
