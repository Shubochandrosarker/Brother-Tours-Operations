import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

/**
 * Reusable error boundary. Use once globally and again around individual
 * routes/panels so a single failure never blanks the whole workspace.
 */
class ErrorBoundary extends React.Component {
	constructor(props) {
		super(props);
		this.state = { error: null };
		this.reset = this.reset.bind(this);
	}

	static getDerivedStateFromError(error) {
		return { error };
	}

	componentDidCatch(error, info) {
		if (typeof this.props.onError === 'function') {
			this.props.onError(error, info);
		}
	}

	reset() {
		this.setState({ error: null });
	}

	render() {
		const { error } = this.state;
		if (!error) return this.props.children;

		return (
			<div className="flex min-h-[240px] w-full items-center justify-center p-6">
				<div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-[0_1px_2px_hsl(var(--foreground)/0.06)]">
					<div className="flex items-start gap-3">
						<span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
							<AlertTriangle className="h-5 w-5" strokeWidth={1.75} />
						</span>
						<div className="min-w-0">
							<h2 className="text-sm font-semibold text-foreground">
								{this.props.title || 'This area failed to render'}
							</h2>
							<p className="mt-1 break-words text-sm text-muted-foreground">
								{error?.message || 'An unexpected client-side error occurred.'}
							</p>
							<button
								type="button"
								onClick={this.reset}
								className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary active:scale-[0.98]"
							>
								<RotateCw className="h-4 w-4" strokeWidth={1.75} />
								Try again
							</button>
						</div>
					</div>
				</div>
			</div>
		);
	}
}

export default ErrorBoundary;
