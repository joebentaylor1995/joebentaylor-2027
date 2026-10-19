// Homepage Schema
// ------------

// Imports
// ------------
import { HomeIcon } from '@sanity/icons/Home';
import { defineArrayMember, defineField, defineType } from 'sanity';

// Exports
// ------------
export const homePage = defineType({
	name: 'homePage',
	title: 'Homepage',
	type: 'document',
	icon: HomeIcon,
	groups: [
		{ name: 'hero', title: 'Hero', default: true },
		{ name: 'seo', title: 'SEO' },
	],
	fields: [
		defineField({
			name: 'heading',
			title: 'Heading',
			type: 'string',
			group: 'hero',
			validation: rule => rule.required(),
		}),
		defineField({
			name: 'description',
			title: 'Description',
			type: 'text',
			rows: 3,
			group: 'hero',
			validation: rule => rule.required(),
		}),
		defineField({
			name: 'clientLogos',
			title: 'Client logos',
			type: 'array',
			group: 'hero',
			description: 'The scrolling logo marquee. White transparent PNG or SVG works best. Drag to reorder.',
			of: [
				defineArrayMember({
					type: 'object',
					name: 'clientLogo',
					fields: [
						defineField({
							name: 'name',
							title: 'Client',
							type: 'string',
							validation: rule => rule.required(),
						}),
						defineField({
							name: 'logo',
							title: 'Logo',
							type: 'image',
							validation: rule => rule.required(),
						}),
					],
					preview: { select: { title: 'name', media: 'logo' } },
				}),
			],
		}),
		defineField({ name: 'seo', title: 'SEO', type: 'seo', group: 'seo', options: { collapsed: false } }),
	],
	preview: { prepare: () => ({ title: 'Homepage' }) },
});
