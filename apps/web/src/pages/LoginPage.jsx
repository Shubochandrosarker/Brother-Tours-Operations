import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Compass, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/api/client';

export default function LoginPage() {
	const { login, isAuthenticated, status } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();
	const [form, setForm] = useState({ username: '', password: '' });
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState(null);

	if (isAuthenticated) {
		return <Navigate to={location.state?.from || '/'} replace />;
	}

	async function onSubmit(event) {
		event.preventDefault();
		setSubmitting(true);
		setError(null);
		try {
			await login(form);
			navigate(location.state?.from || '/', { replace: true });
		} catch (err) {
			if (err instanceof ApiError && err.isUnavailable) {
				setError('The authentication service is unreachable. Please check the connection to the operations API and try again.');
			} else if (err instanceof ApiError && (err.isUnauthorized || err.isForbidden || err.status === 401 || err.status === 403)) {
				setError('Those credentials were rejected by the server. Check your username and password.');
			} else {
				setError(err?.message || 'Sign-in failed for an unexpected reason.');
			}
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="grid min-h-[100dvh] bg-background lg:grid-cols-[1.05fr_1fr]">
			<Helmet>
				<title>Sign in · Brother Tours Operations</title>
				<meta
					name="description"
					content="Secure sign-in to the Brother Tours operations console. Server-authoritative sessions with HttpOnly cookies."
				/>
			</Helmet>

			<div className="relative hidden overflow-hidden border-r border-border bg-secondary/40 lg:block">
				<div className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(hsl(var(--border))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border))_1px,transparent_1px)] [background-size:56px_56px]" />
				<div className="relative flex h-full flex-col justify-between p-12">
					<div className="flex items-center gap-2.5">
						<span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
							<Compass className="h-5 w-5" strokeWidth={1.75} />
						</span>
						<span className="text-sm font-semibold tracking-tight">Brother Tours Operations</span>
					</div>
					<div className="max-w-md">
						<h2 className="text-[2.4rem] font-semibold leading-[1.1] tracking-tight text-foreground">
							One calm console for every departure you run.
						</h2>
						<p className="mt-4 text-sm leading-relaxed text-muted-foreground">
							Tours, inquiries, departures and customer operations — unified behind one secure workspace.
						</p>
					</div>
					<p className="flex items-center gap-2 text-xs text-muted-foreground">
						<ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
						Sessions are issued and validated server-side.
					</p>
				</div>
			</div>

			<div className="flex items-center justify-center px-5 py-12 sm:px-8">
				<div className="w-full max-w-[380px]">
					<div className="mb-8 flex items-center gap-2.5 lg:hidden">
						<span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
							<Compass className="h-5 w-5" strokeWidth={1.75} />
						</span>
						<span className="text-sm font-semibold tracking-tight">Brother Tours Operations</span>
					</div>

					<h1 className="text-2xl font-semibold tracking-tight text-foreground">Sign in</h1>
					<p className="mt-1.5 text-sm text-muted-foreground">
						Use your Brother Tours operations account.
					</p>

					<form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
						<div className="flex flex-col gap-2">
							<label htmlFor="username" className="text-sm font-medium text-foreground">
								Username or email
							</label>
							<input
								id="username"
								name="username"
								type="text"
								autoComplete="username"
								required
								value={form.username}
								onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
								className="h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
								placeholder="you@brothertours.com"
							/>
						</div>

						<div className="flex flex-col gap-2">
							<label htmlFor="password" className="text-sm font-medium text-foreground">
								Password
							</label>
							<input
								id="password"
								name="password"
								type="password"
								autoComplete="current-password"
								required
								value={form.password}
								onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
								className="h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
								placeholder="••••••••"
							/>
						</div>


						{error ? (
							<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
								{error}
							</p>
						) : null}

						<button
							type="submit"
							disabled={submitting || status === 'LOADING'}
							className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
						>
							{submitting ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <LockKeyhole className="h-4 w-4" strokeWidth={1.75} />}
							{submitting ? 'Signing in…' : 'Sign in'}
						</button>
					</form>

					<p className="mt-6 text-xs leading-relaxed text-muted-foreground">
						Credentials are sent once over HTTPS and exchanged for an HttpOnly session cookie. Nothing is stored in the browser.
					</p>
				</div>
			</div>
		</div>
	);
}
