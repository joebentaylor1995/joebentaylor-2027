// Imports
// ------------
import type { MetadataRoute } from 'next';
import { isSiteUrlConfigured, siteUrl } from '@/config';

// Constants
// ------------
// NOTE • Served at /robots.txt. Non-production deploys (Netlify sets
// CONTEXT to deploy-preview / branch-deploy) are blocked from indexing so
// staging URLs never leak into search results — as is any deploy still on
// the tackl.netlify.app fallback (NEXT_PUBLIC_SITE_URL unset).
const AI_TRAINING_CRAWLERS = [
	'GPTBot',
	'ClaudeBot',
	'Google-Extended',
	'Applebot-Extended',
	'CCBot',
	'meta-externalagent',
	'Bytespider',
];

// Helpers
// ------------
const isProduction = !process.env.CONTEXT || process.env.CONTEXT === 'production';

// Route
// ------------
const robots = (): MetadataRoute.Robots => {
	if (!isProduction || !isSiteUrlConfigured) {
		return {
			rules: { userAgent: '*', disallow: '/' },
		};
	}

	// NOTE • Mirrors the "Crawler access" section of /llms — search and AI
	// answer engines are welcome, model-training crawlers are not. Keep the
	// two in step (src/components/LegalPage/content/llms.ts).
	return {
		rules: [
			{ userAgent: '*', allow: '/' },
			{ userAgent: AI_TRAINING_CRAWLERS, disallow: '/' },
		],
		sitemap: `${siteUrl}/sitemap.xml`,
	};
};

// Exports
// ------------
export default robots;
