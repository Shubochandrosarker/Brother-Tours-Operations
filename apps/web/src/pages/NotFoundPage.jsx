import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export default function NotFoundPage() {
	return (
		<div className="flex min-h-[60vh] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
			<Helmet>
				<title>Page not found · Brother Tours Operations</title>
				<meta name="description" content="The requested page does not exist in the Brother Tours operations console." />
			</Helmet>
			<span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
				<Compass className="h-5 w-5" strokeWidth={1.75} />
			</span>
			<h2 className="mt-4 text-base font-semibold text-foreground">This route does not exist</h2>
			<p className="mt-2 max-w-sm text-sm text-muted-foreground">
				The address you opened is not part of the operations console.
			</p>
			<Link
				to="/"
				className="mt-5 inline-flex min-h-[44px] items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 active:scale-[0.98]"
			>
				Back to dashboard
			</Link>
		</div>
	);
}
