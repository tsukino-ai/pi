import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
	children: ReactNode;
}

interface ErrorBoundaryState {
	hasError: boolean;
	error?: Error;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	state: ErrorBoundaryState = { hasError: false };

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error("[ErrorBoundary]", error, info.componentStack);
	}

	render() {
		if (this.state.hasError) {
			return (
				<div role="alert" aria-live="assertive" style={{ padding: 40, textAlign: "center" }}>
					<h2>Something went wrong</h2>
					<p style={{ color: "#666" }}>{this.state.error?.message}</p>
					<button
						type="button"
						onClick={() => window.location.reload()}
						style={{
							marginTop: 16,
							padding: "8px 16px",
							cursor: "pointer",
						}}
					>
						Reload
					</button>
				</div>
			);
		}
		return this.props.children;
	}
}
