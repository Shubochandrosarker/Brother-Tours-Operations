import React from 'react';
import { AlertTriangle, CloudOff, Inbox, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Skeleton({ className }) {
	return <div className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

export function SkeletonPanel({ rows = 4, className }) {
	return (
		<div className={cn('space-y-3 rounded-xl border border-border bg-card p-5', className)}>
			<Skeleton className="h-4 w-1/3" />
			{Array.from({ length: rows }).map((_, index) => (
				<Skeleton key={index} className="h-3 w-full" />
			))}
			<Skeleton className="h-3 w-2/3" />
		</div>
	);
}

function Shell({ icon: Icon, tone, title, description, action }) {
	return (
		<div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/60 px-6 py-10 text-center">
			<span
				className={cn(
					'flex h-11 w-11 items-center justify-center rounded-xl',
					tone === 'danger' && 'bg-destructive/10 text-destructive',
					tone === 'warn' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
					tone === 'neutral' && 'bg-secondary text-muted-foreground',
				)}
			>
				<Icon className="h-5 w-5" strokeWidth={1.75} />
			</span>
			<h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
			<p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
			{action ? <div className="mt-5">{action}</div> : null}
		</div>
	);
}

export function RetryButton({ onRetry, label = 'Retry' }) {
	if (!onRetry) return null;
	return (
		<button
			type="button"
			onClick={onRetry}
			className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary active:scale-[0.98]"
		>
			<RotateCw className="h-4 w-4" strokeWidth={1.75} />
			{label}
		</button>
	);
}

export function EmptyState({ title = 'Nothing here yet', description = 'There are no records to display for the current filters.', action }) {
	return <Shell icon={Inbox} tone="neutral" title={title} description={description} action={action} />;
}

export function ErrorState({ error, onRetry, title = 'We could not load this data' }) {
	return (
		<Shell
			icon={AlertTriangle}
			tone="danger"
			title={title}
			description={error?.message || 'The server returned an unexpected response.'}
			action={<RetryButton onRetry={onRetry} />}
		/>
	);
}

export function UnavailableState({ error, onRetry }) {
	return (
		<Shell
			icon={CloudOff}
			tone="warn"
			title="Service unavailable"
			description={
				error?.message ||
				'The Brother Tours operations API is not reachable right now. Nothing has been lost — try again in a moment.'
			}
			action={<RetryButton onRetry={onRetry} label="Reconnect" />}
		/>
	);
}

/**
 * Single switch for the five canonical resource states.
 */
export function ResourceState({ state, error, onRetry, skeleton, empty, children }) {
	switch (state) {
		case 'LOADING':
			return skeleton || <SkeletonPanel />;
		case 'UNAVAILABLE':
			return <UnavailableState error={error} onRetry={onRetry} />;
		case 'ERROR':
			return <ErrorState error={error} onRetry={onRetry} />;
		case 'EMPTY':
			return empty || <EmptyState />;
		case 'DATA':
		default:
			return children;
	}
}
