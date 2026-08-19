import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from '@/components/ui/command';
import { visibleNavGroups } from '@/config/navigation';
import { useAuth } from '@/context/AuthContext';

export default function CommandPalette({ open, onOpenChange }) {
	const navigate = useNavigate();
	const { user } = useAuth();
	// Filtered against the same capability list as the sidebar — a page hidden
	// from the nav must not be reachable by typing its name here.
	const groups = visibleNavGroups(user?.capabilities);

	useEffect(() => {
		function onKeyDown(event) {
			if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				onOpenChange(!open);
			}
		}
		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	}, [open, onOpenChange]);

	return (
		<CommandDialog open={open} onOpenChange={onOpenChange}>
			<CommandInput placeholder="Search pages — record search arrives with the operations modules" />
			<CommandList>
				<CommandEmpty>No matching pages in this workspace yet.</CommandEmpty>
				{groups.map((group) => (
					<CommandGroup key={group.id} heading={group.label}>
						{group.items.map((item) => (
							<CommandItem
								key={item.to}
								value={`${group.label} ${item.label}`}
								onSelect={() => {
									onOpenChange(false);
									navigate(item.to);
								}}
							>
								<item.icon className="mr-2 h-4 w-4" strokeWidth={1.75} />
								{item.label}
							</CommandItem>
						))}
					</CommandGroup>
				))}
			</CommandList>
		</CommandDialog>
	);
}
