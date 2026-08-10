import React, { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '@/components/shell/Sidebar';
import TopBar from '@/components/shell/TopBar';
import ErrorBoundary from '@/components/ErrorBoundary';
import { SkeletonPanel } from '@/components/states/StateViews';
import { findNavItem } from '@/config/navigation';

export default function AppShell() {
	const location = useLocation();
	const active = findNavItem(location.pathname);
	const title = active?.label || 'Workspace';

	return (
		<div className="flex min-h-screen bg-background text-foreground">
			<Sidebar />
			<div className="flex min-w-0 flex-1 flex-col">
				<TopBar title={title} subtitle="Brother Tours operations console" />
				<main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
					<div className="mx-auto w-full max-w-[1400px]">
						<ErrorBoundary key={location.pathname} title="This page failed to load">
							<Suspense fallback={<SkeletonPanel rows={6} />}>
								<Outlet />
							</Suspense>
						</ErrorBoundary>
					</div>
				</main>
			</div>
		</div>
	);
}
