import React from 'react';
import { cn } from '@/lib/utils';

const STATUS_MAP = {
	new: { label: 'New', classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
	reviewed: { label: 'Reviewed', classes: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
	sent: { label: 'Sent', classes: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300' },
	closed: { label: 'Closed', classes: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
	open: { label: 'Open', classes: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
	pending: { label: 'Pending', classes: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
	cancelled: { label: 'Cancelled', classes: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
};

export default function InquiryStatusBadge({ status, className }) {
	const raw = String(status || '').toLowerCase();
	const cfg = STATUS_MAP[raw] || {
		label: status || 'Unknown',
		classes: 'bg-secondary text-secondary-foreground',
	};
	return (
		<span
			className={cn(
				'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
				cfg.classes,
				className,
			)}
		>
			{cfg.label}
		</span>
	);
}
