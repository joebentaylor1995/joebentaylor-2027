// SEO Object
// ------------
// NOTE • Per-page overrides. Anything left empty falls back to the page's own
// content (e.g. a project's introduction), then to Global settings.

// Imports
// ------------
import { SearchIcon } from '@sanity/icons/Search';
import { defineField, defineType } from 'sanity';

// Constants
// ------------
const TITLE_MAX = 60;
const DESCRIPTION_MAX = 160;

// Exports
// ------------
export const seo = defineType({
	name: 'seo',
	title: 'SEO',
	type: 'object',
	icon: SearchIcon,
	options: { collapsible: true, collapsed: true },
	fields: [
		defineField({
			name: 'title',
			title: 'Meta title',
			type: 'string',
			description: 'Shown in search results and browser tabs. Leave empty to use the page title.',
			validation: rule => rule.max(TITLE_MAX).warning(`Keep it under ${TITLE_MAX} characters.`),
		}),
		defineField({
			name: 'description',
			title: 'Meta description',
			type: 'text',
			rows: 3,
			validation: rule => rule.max(DESCRIPTION_MAX).warning(`Keep it under ${DESCRIPTION_MAX} characters.`),
		}),
		defineField({
			name: 'image',
			title: 'Share image',
			type: 'image',
			description: 'Social share card — 1200 × 630. Leave empty to use the default card.',
		}),
	],
});
