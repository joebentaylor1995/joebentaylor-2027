// Imports
// ------------
import type { Metadata } from 'next';
import { stegaClean } from 'next-sanity';
import type { Seo } from '@/data/site';

// Constants
// ------------
const SHARE_IMAGE = { width: 1200, height: 630 };

// Types
// ------------
interface MetadataOptions {
	/** Used when the editor left the SEO title empty */
	title?: string;
	/** Used when the editor left the SEO description empty */
	description?: string;
	/** Skip the “%s — Name” template (e.g. the home page) */
	absoluteTitle?: boolean;
}

// Exports
// ------------
/**
 * Turns a CMS `seo` object into route metadata. Only the fields that are set
 * are returned, so anything left empty inherits the site-wide defaults from
 * app/(site)/layout.tsx. A share image replaces the default card; without one
 * the route keeps its inherited opengraph-image. Everything is stega-cleaned,
 * so Visual Editing's invisible characters never reach <head>.
 */
export const toMetadata = (seo: Seo | null | undefined, options: MetadataOptions = {}): Metadata => {
	const title = stegaClean(seo?.title || options.title);
	const description = stegaClean(seo?.description || options.description);
	const image = seo?.image
		? stegaClean(`${seo.image}?w=${SHARE_IMAGE.width}&h=${SHARE_IMAGE.height}&fit=crop&fm=jpg`)
		: null;

	return {
		...(title && { title: options.absoluteTitle ? { absolute: title } : title }),
		...(description && { description }),
		...(image && {
			openGraph: { type: 'website', title, description, images: [{ url: image, ...SHARE_IMAGE }] },
			twitter: { card: 'summary_large_image', title, description, images: [image] },
		}),
	};
};
