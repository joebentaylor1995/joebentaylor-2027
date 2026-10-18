// Revalidate — Sanity webhook
// ------------
// NOTE • Point a Sanity webhook (sanity.io/manage → API → Webhooks) at
// POST /api/revalidate with the secret in SANITY_REVALIDATE_SECRET. Any
// publish, unpublish or delete expires the shared Sanity cache tag.
//
// The webhook can't reach localhost, so in development a plain visit to
// /api/revalidate/ (GET) clears the cache too and returns you to the site —
// add ?redirect=/projects/ to land somewhere else. GET is a 404 in production.

// Imports
// ------------
import { SANITY_CACHE_TAG } from '@cms';
import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { type NextRequest, NextResponse } from 'next/server';
import { parseBody } from 'next-sanity/webhook';

// Constants
// ------------
// NOTE • expire: 0 rather than 'max' — an editor who just hit Publish expects
// the very next page load to show it, not a stale copy
const EXPIRE_NOW = { expire: 0 };

// Exports
// ------------
export const GET = async (request: NextRequest) => {
	if (process.env.NODE_ENV !== 'development') return new NextResponse(null, { status: 404 });

	revalidateTag(SANITY_CACHE_TAG, EXPIRE_NOW);

	// NOTE • Relative paths only — never an open redirect
	const target = request.nextUrl.searchParams.get('redirect') || '/';
	redirect(target.startsWith('/') && !target.startsWith('//') ? target : '/');
};

export const POST = async (request: NextRequest) => {
	const secret = process.env.SANITY_REVALIDATE_SECRET;
	if (!secret) return NextResponse.json({ message: 'Revalidation is not configured' }, { status: 503 });

	try {
		// NOTE • true = wait for Sanity's query API to catch up with the publish
		// (it's eventually consistent), so the refetch below never reads the old value
		const { isValidSignature, body } = await parseBody<{ _type?: string }>(request, secret, true);
		if (!isValidSignature) return NextResponse.json({ message: 'Invalid signature' }, { status: 401 });

		revalidateTag(SANITY_CACHE_TAG, EXPIRE_NOW);
		return NextResponse.json({ revalidated: true, type: body?._type ?? null });
	} catch (error: unknown) {
		console.error('Revalidation failed:', error);
		return NextResponse.json({ message: 'Revalidation failed' }, { status: 500 });
	}
};
