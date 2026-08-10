import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { SkeletonPanel, UnavailableState, ErrorState } from '@/components/states/StateViews';

export default function RequireAuth({ children }) {
	const { status, isAuthenticated, error, refresh } = useAuth();
	const location = useLocation();

	if (status === 'LOADING') {
		return (
			<div className="mx-auto w-full max-w-3xl px-6 py-16">
				<SkeletonPanel rows={5} />
			</div>
		);
	}

	if (status === 'UNAVAILABLE') {
		return (
			<div className="mx-auto w-full max-w-2xl px-6 py-16">
				<UnavailableState error={error} onRetry={refresh} />
			</div>
		);
	}

	if (status === 'ERROR') {
		// 403 or unexpected server error — show the message (not the generic service-unavailable screen)
		return (
			<div className="mx-auto w-full max-w-2xl px-6 py-16">
				<ErrorState error={error} onRetry={refresh} title={error?.status === 403 ? 'Access denied' : 'Unable to verify session'} />
			</div>
		);
	}

	if (!isAuthenticated) {
		return <Navigate to="/login" replace state={{ from: location.pathname }} />;
	}

	return children;
}
