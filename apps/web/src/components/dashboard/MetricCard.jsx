import React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/states/StateViews';

/**
 * Single KPI tile used in the Business Snapshot grid.
 * @param {{ label: string, value: string|number, icon: React.ElementType, trend?: string, trendUp?: boolean, className?: string }} props
 */
export function MetricCard({ label, value, icon: Icon, trend, trendUp, className }) {
	return (
		<div className={cn('rounded-xl border border-border bg-card p-5', className)}>
			<div className="flex items-start justify-between gap-3">
				<p className="text-xs font-medium uppercase tracking-[0.13em] text-muted-foreground">{label}</p>
				{Icon && (
					<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent">
						<Icon className="h-4 w-4 text-accent-foreground" strokeWidth={1.75} />
					</span>
				)}
			</div>
			<p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
			{trend && (
				<p
					className={cn(
						'mt-1.5 text-xs font-medium',
						trendUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
					)}
				>
					{trend}
				</p>
			)}
		</div>
	);
}

export function MetricCardSkeleton() {
	return (
		<div className="rounded-xl border border-border bg-card p-5">
			<div className="flex items-start justify-between">
				<Skeleton className="h-3 w-28" />
				<Skeleton className="h-8 w-8 rounded-lg" />
			</div>
			<Skeleton className="mt-3 h-7 w-16" />
			<Skeleton className="mt-2 h-3 w-24" />
		</div>
	);
}
