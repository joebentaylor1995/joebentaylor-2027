/**
 * Executes a Sanity GROQ query with caching, error handling and environment config injection.
 *
 * Wraps a `next-sanity` client configured from NEXT_PUBLIC_SANITY_PROJECT_ID /
 * NEXT_PUBLIC_SANITY_DATASET. Returns `null` on failure instead of throwing so a
 * missing document never crashes a route.
 *
 * @template T - The expected shape of the response data.
 * @param {string} query - The GROQ query string to execute.
 * @param {object} [params] - Optional GROQ params (e.g., { slug }).
 * @returns {Promise<T | null>} The response data from Sanity, or `null` if the request fails.
 *
 * @example
 * ```ts
 * import { fetchContent, GET_HOME } from '@cms';
 *
 * const data = await fetchContent<{ heading: string }>(GET_HOME);
 * ```
 */

import { cacheLife, cacheTag } from 'next/cache';
import { draftMode } from 'next/headers';
// Imports
// ------------
import { createClient } from 'next-sanity';

// Constants
// ------------
// NOTE • Every Sanity read shares one tag — the publish webhook
// (app/api/revalidate) expires it, so edits go live within seconds
export const SANITY_CACHE_TAG = 'sanity';

// NOTE • Where stega-encoded strings point the Visual Editing overlays
export const STUDIO_URL = '/studio';

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const previewToken = process.env.SANITY_API_READ_TOKEN;
const isConfigured = Boolean(projectId && projectId !== 'CHANGE_ME' && projectId !== 'placeholder');

// SECTION • Client
// NOTE • useCdn is off: Next's 'use cache' layer is the cache, and reading the
// live API means a webhook-triggered revalidation never refetches a stale
// CDN copy. The 'placeholder' fallback keeps builds working before a project
// is linked — fetchContent guards against it at call time.
export const client = createClient({
	projectId: projectId || 'placeholder',
	dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
	apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2025-06-01',
	useCdn: false,
	perspective: 'published',
});

// SECTION • Draft client
// NOTE • Used only while draft mode is on (Sanity's Presentation tool turns it
// on via app/api/draft-mode/enable): reads unpublished drafts with the
// viewer token, and stega-encodes strings so each one links back to its
// field in the Studio for click-to-edit
const draftClient = client.withConfig({
	token: previewToken,
	perspective: 'drafts',
	stega: { enabled: true, studioUrl: STUDIO_URL },
});

// NOTE • draftMode() can't be read outside a request (generateStaticParams,
// the sitemap at build) — treat that as published
export const isDraftMode = async () => {
	try {
		return (await draftMode()).isEnabled && Boolean(previewToken);
	} catch {
		return false;
	}
};

// NOTE • Throws on failure so errors are never cached — fetchContent below
// turns them into null. In draft mode Next re-runs 'use cache' functions on
// every request and never stores the result, so drafts are always fresh and
// can't leak into the published cache.
// NOTE • Keep this lifetime long. The root layout reads Sanity outside any
// Suspense, so a short-lived or constantly stale entry (e.g. 'seconds', or a
// 1s revalidate) counts as uncached data and Next reports a “Blocking Route”.
// Fresh content comes from the publish webhook instead — or, locally, from
// visiting /api/revalidate/ (see app/api/revalidate/route.ts).
const cachedFetch = async <T>(query: string, params: Record<string, unknown>): Promise<T> => {
	'use cache';
	cacheTag(SANITY_CACHE_TAG);
	cacheLife('days');

	return ((await isDraftMode()) ? draftClient : client).fetch<T>(query, params);
};

// Exports
// ------------
export const fetchContent = async <T = unknown>(query: string, params?: Record<string, unknown>): Promise<T | null> => {
	// NOTE • No project linked yet — callers render their local fallback content
	if (!isConfigured) return null;

	try {
		return await cachedFetch<T>(query, params ?? {});
	} catch (error: unknown) {
		console.error('Sanity request failed:', error);

		// Return null instead of throwing to prevent app crash
		return null;
	}
};
