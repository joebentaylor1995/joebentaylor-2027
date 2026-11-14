// Draft Mode — Sanity
// ------------
// NOTE • Lets Sanity's Presentation tool (and editors) turn on Next.js
// draft mode so pages render draft content. Requires a viewer token in
// SANITY_API_READ_TOKEN (server-only env, never NEXT_PUBLIC_) — without
// one this route responds 503 and the site simply stays on published
// content.

// Imports
// ------------
import { defineEnableDraftMode } from 'next-sanity/draft-mode';
import { client } from './client';

// Constants
// ------------
const previewToken = process.env.SANITY_API_READ_TOKEN;

// NOTE • next-sanity throws (a bare 500) when the client has no token, which
// hides the cause — answer with a 503 that names the missing variable instead
const missingToken = () => new Response('Draft mode unavailable: SANITY_API_READ_TOKEN is not set', { status: 503 });

const enableDraftMode = previewToken
	? defineEnableDraftMode({ client: client.withConfig({ token: previewToken }) }).GET
	: missingToken;

// Exports
// ------------
export const GET = enableDraftMode;
