import React from 'react';
import { useTheme } from 'next-themes';
import { Laptop, Moon, Sun } from 'lucide-react';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const options = [
	{ value: 'light', label: 'Light', icon: Sun },
	{ value: 'dark', label: 'Dark', icon: Moon },
	{ value: 'system', label: 'System', icon: Laptop },
];

export default function ThemeMenu() {
	const { theme, setTheme, resolvedTheme } = useTheme();
	const Current = resolvedTheme === 'dark' ? Moon : Sun;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					aria-label="Theme"
					className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:bg-secondary hover:text-foreground active:scale-[0.98]"
				>
					<Current className="h-[18px] w-[18px]" strokeWidth={1.75} />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-40 rounded-xl border-border">
				{options.map((option) => (
					<DropdownMenuItem
						key={option.value}
						onSelect={() => setTheme(option.value)}
						className="gap-2 rounded-lg text-sm"
					>
						<option.icon className="h-4 w-4" strokeWidth={1.75} />
						{option.label}
						{theme === option.value ? <span className="ml-auto text-xs text-muted-foreground">Active</span> : null}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
