import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, Search, User } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarBrand, SidebarNav } from '@/components/shell/Sidebar';
import ThemeMenu from '@/components/shell/ThemeMenu';
import CommandPalette from '@/components/shell/CommandPalette';
import { useAuth } from '@/context/AuthContext';

export default function TopBar({ title, subtitle }) {
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [paletteOpen, setPaletteOpen] = useState(false);
	const { user, logout } = useAuth();
	const navigate = useNavigate();

	const initials = (user?.name || 'BT')
		.split(' ')
		.map((part) => part[0])
		.slice(0, 2)
		.join('')
		.toUpperCase();

	return (
		<header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
			<div className="flex items-center gap-3 px-4 py-3 sm:px-6">
				<Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
					<SheetTrigger asChild>
						<button
							type="button"
							aria-label="Open navigation"
							className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:bg-secondary lg:hidden"
						>
							<Menu className="h-[18px] w-[18px]" strokeWidth={1.75} />
						</button>
					</SheetTrigger>
					<SheetContent side="left" className="w-[276px] border-border bg-card p-0">
						<div className="flex h-full flex-col">
							<SidebarBrand />
							<SidebarNav onNavigate={() => setDrawerOpen(false)} />
						</div>
					</SheetContent>
				</Sheet>

				<div className="min-w-0 flex-1">
					<h1 className="truncate text-[15px] font-semibold tracking-tight text-foreground sm:text-base">
						{title}
					</h1>
					{subtitle ? (
						<p className="hidden truncate text-xs text-muted-foreground sm:block">{subtitle}</p>
					) : null}
				</div>

				<button
					type="button"
					onClick={() => setPaletteOpen(true)}
					className="hidden h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground transition hover:bg-secondary md:flex md:w-56 lg:w-72"
				>
					<Search className="h-4 w-4" strokeWidth={1.75} />
					<span className="truncate">Search workspace</span>
					<kbd className="ml-auto rounded border border-border px-1.5 py-0.5 text-[10px] font-medium">⌘K</kbd>
				</button>
				<button
					type="button"
					aria-label="Search"
					onClick={() => setPaletteOpen(true)}
					className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:bg-secondary md:hidden"
				>
					<Search className="h-[18px] w-[18px]" strokeWidth={1.75} />
				</button>

				<button
					type="button"
					aria-label="View attention items"
					onClick={() => navigate('/')}
					className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:bg-secondary hover:text-foreground active:scale-[0.98]"
				>
					<Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
				</button>

				<ThemeMenu />

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							aria-label="User menu"
							className="flex h-10 min-w-[40px] items-center gap-2 rounded-lg border border-border bg-background px-2 text-sm font-medium text-foreground transition hover:bg-secondary active:scale-[0.98]"
						>
							<span className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary text-[11px] font-semibold">
								{initials}
							</span>
							<span className="hidden max-w-[120px] truncate lg:block">{user?.name || 'Account'}</span>
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-56 rounded-xl border-border">
						<DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
							{user?.email || user?.username || 'Signed in'}
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuItem className="gap-2 rounded-lg text-sm" onSelect={() => navigate('/settings')}>
							<User className="h-4 w-4" strokeWidth={1.75} />
							Profile & settings
						</DropdownMenuItem>
						<DropdownMenuItem
							className="gap-2 rounded-lg text-sm text-destructive focus:text-destructive"
							onSelect={() => {
								logout().finally(() => navigate('/login', { replace: true }));
							}}
						>
							<LogOut className="h-4 w-4" strokeWidth={1.75} />
							Sign out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			<CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
		</header>
	);
}
