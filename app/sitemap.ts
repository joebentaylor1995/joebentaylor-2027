// Imports
// ------------
import type { MetadataRoute } from 'next';
import { cacheTag } from 'next/cache';
import { siteUrl } from '@/config';
import { getProjectSlugs, getSettings } from '@/data/content';

// Sitemap
// ------------
// NOTE • Served at /sitemap.xml. Static routes are listed by hand; case
// studies come from Sanity (or the local fallback) via getProjectSlugs.
const sitemap = async (): Promise<MetadataRoute.Sitemap> => {
	// Next's cache key includes the build ID: every build regenerates this
	// sitemap and its CMS reads. Publishing also invalidates it between builds.
	'use cache';
	cacheTag('sanity');

	// NOTE • Projects stay out of the sitemap until “Projects live” is on
	const { projectsLive } = await getSettings();
	const projectSlugs = projectsLive ? await getProjectSlugs() : [];

	return [
		{
			url: `${siteUrl}/`,
			lastModified: new Date(),
			changeFrequency: 'monthly',
			priority: 1,
		},
		...(projectsLive
			? [
					{
						url: `${siteUrl}/projects`,
						lastModified: new Date(),
						changeFrequency: 'monthly' as const,
						priority: 0.8,
					},
				]
			: []),
		...projectSlugs.map(slug => ({
			url: `${siteUrl}/projects/${slug}`,
			lastModified: new Date(),
			changeFrequency: 'monthly' as const,
			priority: 0.7,
		})),
		...['cookies', 'terms-privacy', 'llms'].map(slug => ({
			url: `${siteUrl}/${slug}`,
			lastModified: new Date(),
			changeFrequency: 'yearly' as const,
			priority: 0.3,
		})),
	];
};

// Exports
// ------------
export default sitemap;
