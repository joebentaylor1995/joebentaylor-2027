// Sanity Studio Configuration
// ------------
// NOTE • Powers the embedded Studio at /studio (see app/(studio)).
// Project id/dataset come from .env. The placeholder fallback keeps builds
// working before a project is linked. Content model: docs/Sanity/ContentModel.md

// Imports
// ------------
import { colorInput } from '@sanity/color-input';
import { defineConfig } from 'sanity';
import { presentationTool } from 'sanity/presentation';
import { structureTool } from 'sanity/structure';
import { media } from 'sanity-plugin-media';
import { StudioLogo } from './sanity/components/StudioLogo';
import { resolve } from './sanity/presentation';
import { schemaTypes, singletonTypes } from './sanity/schemaTypes';
import { structure } from './sanity/structure';

// Constants
// ------------
// NOTE • Singletons can be edited and published, never duplicated or deleted
const SINGLETON_ACTIONS = new Set(['publish', 'discardChanges', 'restore']);

// Exports
// ------------
export default defineConfig({
	name: 'default',
	title: 'Joe Ben Taylor',
	icon: StudioLogo,
	basePath: '/studio',

	projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'placeholder',
	dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',

	plugins: [
		// NOTE • Titles only — the tool names (and so /studio/structure and
		// /studio/presentation URLs) stay as Sanity's defaults
		structureTool({ structure, title: 'Editor' }),
		// NOTE • The `color` field type (swatch picker + hex + transparency) — toolkit tiles
		colorInput(),
		// NOTE • Visual Editing: previews the site (same origin as this embedded
		// Studio) with click-to-edit overlays. Draft mode is toggled by the
		// routes in app/api/draft-mode — trailing slashes match next.config.js
		presentationTool({
			title: 'Live Editor',
			resolve,
			previewUrl: {
				initial: '/',
				previewMode: {
					enable: '/api/draft-mode/enable/',
					disable: '/api/draft-mode/disable/',
				},
			},
		}),
		// NOTE • Browse, search and tag every uploaded image and file
		media(),
	],

	// NOTE • Content Releases off — edits publish directly
	releases: { enabled: false },

	schema: {
		types: schemaTypes,
		templates: templates => templates.filter(({ schemaType }) => !singletonTypes.has(schemaType)),
	},

	document: {
		actions: (input, { schemaType }) =>
			singletonTypes.has(schemaType)
				? input.filter(({ action }) => action && SINGLETON_ACTIONS.has(action))
				: input,
	},
});
