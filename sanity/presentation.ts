// Presentation — document locations
// ------------
// NOTE • Tells the Presentation tool which page(s) each document appears on
// (the “Used on” list in the editor) and which document a page is mainly
// about, so opening a URL in Presentation opens the right form beside it.

// Imports
// ------------
import { defineDocuments, defineLocations, type PresentationPluginOptions } from 'sanity/presentation';
// NOTE • Relative, not '@utils' — the Sanity CLI doesn't resolve the site's path aliases
import { PROFILE_PATH } from '../src/utils/profileRoute';

// Constants
// ------------
const HOME = { title: 'Homepage', href: '/' };
const PROJECTS = { title: 'Projects', href: '/projects/' };
// NOTE • The profile panel slides over every page. Opening it in the preview
// reports PROFILE_PATH, so Presentation switches to the Profile panel document;
// following this location opens the panel
const PROFILE_PANEL = { title: 'Profile panel', href: PROFILE_PATH };

const caseStudyHref = (slug?: string) => `/projects/${slug}/`;

// Exports
// ------------
export const resolve: PresentationPluginOptions['resolve'] = {
	mainDocuments: defineDocuments([
		{ route: '/', filter: `_id == "homePage"` },
		{ route: '/projects/', filter: `_id == "projectsPage"` },
		{ route: [PROFILE_PATH, PROFILE_PATH.replace(/\/$/, '')], filter: `_id == "profilePanel"` },
		{ route: '/projects/:slug/', filter: `_type == "project" && slug.current == $slug` },
	]),
	locations: {
		settings: defineLocations({
			message: 'Global settings apply to every page',
			tone: 'positive',
			locations: [HOME, PROJECTS],
		}),
		homePage: defineLocations({ locations: [HOME] }),
		profilePanel: defineLocations({ locations: [PROFILE_PANEL] }),
		projectsPage: defineLocations({ locations: [PROJECTS] }),
		project: defineLocations({
			select: { title: 'title', slug: 'slug.current', hasCaseStudy: 'hasCaseStudy' },
			resolve: doc => ({
				locations: [
					...(doc?.hasCaseStudy && doc.slug
						? [{ title: doc.title || 'Untitled case study', href: caseStudyHref(doc.slug) }]
						: []),
					PROJECTS,
				],
			}),
		}),
		review: defineLocations({ locations: [PROFILE_PANEL] }),
	},
};
