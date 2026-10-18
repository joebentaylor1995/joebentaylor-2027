// Imports
// ------------
import type { MetadataRoute } from 'next';
import { siteUrl } from '@/config';
import { getProjectSlugs, getSettings } from '@/data/content';

// Sitemap
// ------------
// NOTE • Served at /sitemap.xml. Static routes are listed by hand; case
// studies come from Sanity (or the local fallback) via getProjectSlugs.
const sitemap = async (): Promise<MetadataRoute.Sitemap> => {
	// NOTE • With `cacheComponents` on, uncached I/O (`new Date()` here) makes a
	// route dynamic. `use cache` keeps /sitemap.xml prerendered, pinning
	// lastModified to build time — swap it for a CMS timestamp when you wire
	// slugs in above, or drop the directive to regenerate per request.
	'use cache';

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
