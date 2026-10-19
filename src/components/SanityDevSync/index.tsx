'use client';

// Imports
// ------------
import { useRouter } from 'next/navigation';
import { createClient } from 'next-sanity';
import { useEffect } from 'react';

// Constants
// ------------
// NOTE • Every published (non-draft) document — the same content the site caches
const PUBLISHED_DOCUMENTS = '*[!(_id in path("drafts.**"))]';
// NOTE • A publish can touch several documents at once — refresh once for the batch
const SETTLE_MS = 400;

// Component
// ------------
// NOTE • Development only (mounted from app/(site)/layout.tsx). Sanity's publish
// webhook can't reach localhost, so without this a publish never clears the
// local cache. This listens for published changes and does the webhook's job:
// clears the Sanity cache tag via /api/revalidate/ (dev-only GET) and refreshes
// the page — so edits to page copy show up straight away.
const SanityDevSync = () => {
	// Context
	const router = useRouter();

	// Effects
	useEffect(() => {
		const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
		if (!projectId) return;

		const client = createClient({
			projectId,
			dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
			apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2025-06-01',
			useCdn: false,
		});

		let timer: ReturnType<typeof setTimeout> | undefined;
		const sync = async () => {
			await fetch('/api/revalidate/', { redirect: 'manual' });
			// NOTE • The dev server answers the first request after a cache clear with
			// the old render once — take that hit here so the refresh gets fresh content
			await fetch(window.location.href, { cache: 'no-store' });
			router.refresh();
		};

		// NOTE • 'query' visibility waits until the change can be read, so the
		// refetch never sees the old value
		const subscription = client
			.listen(PUBLISHED_DOCUMENTS, {}, { visibility: 'query', includeResult: false, events: ['mutation'] })
			.subscribe(() => {
				clearTimeout(timer);
				timer = setTimeout(() => void sync(), SETTLE_MS);
			});

		return () => {
			clearTimeout(timer);
			subscription.unsubscribe();
		};
	}, [router]);

	return null;
};

// Exports
// ------------
SanityDevSync.displayName = 'SanityDevSync';
export default SanityDevSync;
