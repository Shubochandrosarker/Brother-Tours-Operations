import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';

/**
 * Announce what is actually running. A stale bundle then identifies itself in
 * the console instead of requiring someone to grep a minified chunk.
 */
fetch('/build-info.json', { cache: 'no-store' })
	.then((response) => (response.ok ? response.json() : null))
	.then((info) => {
		if (!info) return;
		// eslint-disable-next-line no-console
		console.info(
			`[bt-ops] build ${info.commit} · built ${info.builtAt} · api ${info.apiBase}`,
		);
		if (info.apiBase && info.apiBase !== import.meta.env.VITE_BT_API_BASE) {
			// eslint-disable-next-line no-console
			console.warn(
				`[bt-ops] Served build-info.json reports ${info.apiBase} but this bundle was compiled against ${import.meta.env.VITE_BT_API_BASE}. The deployed bundle and the stamp disagree.`,
			);
		}
	})
	.catch(() => { /* the stamp is diagnostics only; never block boot on it */ });

ReactDOM.createRoot(document.getElementById('root')).render(
	<App />
);
