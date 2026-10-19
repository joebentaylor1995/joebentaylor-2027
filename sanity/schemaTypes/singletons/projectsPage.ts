// Projects Page Schema
// ------------
// NOTE • The /projects listing, split into the ribbon's two views:
// Featured (the curved ribbon) — case studies only — and All projects (the
// grid), which can also hold listing-only projects.

// Imports
// ------------
import { ThListIcon } from '@sanity/icons/ThList';
import { defineArrayMember, defineField, defineType } from 'sanity';

// Constants
// ------------
const CASE_STUDY_FILTER = 'hasCaseStudy == true';
// NOTE • Sanity's API version for the validation lookup below
const VALIDATION_API_VERSION = '2025-06-01';

// Exports
// ------------
export const projectsPage = defineType({
	name: 'projectsPage',
	title: 'Projects page',
	type: 'document',
	icon: ThListIcon,
	groups: [
		{ name: 'featured', title: 'Featured', default: true },
		{ name: 'all', title: 'All projects' },
		{ name: 'seo', title: 'SEO' },
	],
	fields: [
		defineField({
			name: 'featured',
			title: 'Featured projects',
			type: 'array',
			group: 'featured',
			description:
				'The curved ribbon — case studies only. Drag to reorder. Video loops play here. Listing-only projects go in All projects.',
			of: [
				defineArrayMember({
					type: 'reference',
					to: [{ type: 'project' }],
					options: { filter: CASE_STUDY_FILTER },
				}),
			],
			// NOTE • The picker only offers case studies; this also catches one that was
			// switched back to listing-only after being featured
			validation: rule =>
				rule
					.required()
					.min(3)
					.unique()
					.custom(async (refs, { getClient }) => {
						const ids = (refs ?? []).flatMap(item =>
							item && typeof item === 'object' && '_ref' in item && typeof item._ref === 'string'
								? [item._ref]
								: []
						);
						if (!ids.length) return true;
						const listingOnly = await getClient({ apiVersion: VALIDATION_API_VERSION }).fetch<string[]>(
							`*[_id in $ids && !(${CASE_STUDY_FILTER})].title`,
							{ ids }
						);
						return listingOnly.length
							? `Only case studies can be featured — move ${listingOnly.join(', ')} to All projects, or switch on “Case study”.`
							: true;
					}),
		}),
		defineField({
			name: 'allProjects',
			title: 'All projects',
			type: 'array',
			group: 'all',
			description:
				'Optional — the grid already shows every published project (featured first, then the newest). Add projects here only to pin them in a set order straight after the featured ones.',
			of: [defineArrayMember({ type: 'reference', to: [{ type: 'project' }] })],
			validation: rule => rule.unique(),
		}),
		defineField({ name: 'seo', title: 'SEO', type: 'seo', group: 'seo', options: { collapsed: false } }),
	],
	preview: { prepare: () => ({ title: 'Projects page' }) },
});
