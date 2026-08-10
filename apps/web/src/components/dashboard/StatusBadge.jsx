import React from 'react';
import { cn } from '@/lib/utils';

const toneMap = {
	critical: 'bg-destructive/10 text-destructive border-destructive/20',
	warning: 'bg-amber-500/10 text-amber-700 border-amber-400/30 dark:text-amber-400',
	info: 'bg-accent text-accent-foreground border-accent-foreground/10',
	success: 'bg-emerald-500/10 text-emerald-700 border-emerald-400/30 dark:text-emerald-400',
	neutral: 'bg-secondary text-muted-foreground border-border',
};

/**
 * @param {{ tone?: 'critical'|'warning'|'info'|'success'|'neutral', label: string, className?: string }} props
 */
export function StatusBadge({ tone = 'neutral', label, className }) {
	return (
		<span
			className={cn(
				'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none',
				toneMap[tone] || toneMap.neutral,
				className,
			)}
		>
			{label}
		</span>
	);
}
