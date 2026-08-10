import React from 'react';
import { NavLink } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { navGroups } from '@/config/navigation';
import { cn } from '@/lib/utils';

export function SidebarBrand() {
	return (
		<div className="flex items-center gap-2.5 px-5 py-5">
			<span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
				<Compass className="h-5 w-5" strokeWidth={1.75} />
			</span>
			<div className="leading-tight">
				<p className="text-sm font-semibold tracking-tight text-foreground">Brother Tours</p>
				<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Operations</p>
			</div>
		</div>
	);
}

export function SidebarNav({ onNavigate }) {
	return (
		<nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
			{navGroups.map((group) => (
				<div key={group.id}>
					<p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
						{group.label}
					</p>
					<ul className="space-y-0.5">
						{group.items.map((item) => (
							<li key={item.to}>
								<NavLink
									to={item.to}
									end={item.end}
									onClick={onNavigate}
									className={({ isActive }) =>
										cn(
											'group flex min-h-[44px] items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
											isActive
												? 'bg-secondary text-foreground'
												: 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
										)
									}
								>
									{({ isActive }) => (
										<>
											<item.icon
												className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-primary' : 'opacity-80')}
												strokeWidth={1.75}
											/>
											<span className="truncate">{item.label}</span>
										</>
									)}
								</NavLink>
							</li>
						))}
					</ul>
				</div>
			))}
		</nav>
	);
}

export default function Sidebar() {
	return (
		<aside className="hidden w-[264px] shrink-0 flex-col border-r border-border bg-card lg:flex">
			<SidebarBrand />
			<SidebarNav />
			<div className="border-t border-border px-5 py-4">
				<p className="text-[11px] leading-relaxed text-muted-foreground">
					Brother Tours · Operations Hub
				</p>
			</div>
		</aside>
	);
}
