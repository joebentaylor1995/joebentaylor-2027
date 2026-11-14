// Person Schema
// ------------
// NOTE • A collaborator, added once and picked from the pool in any case
// study's Credits — the role (and, optionally, a link) is written per project.

// Imports
// ------------
import { UsersIcon } from '@sanity/icons/Users';
import { defineField, defineType } from 'sanity';

// Exports
// ------------
export const person = defineType({
	name: 'person',
	title: 'Person',
	type: 'document',
	icon: UsersIcon,
	fields: [
		defineField({
			name: 'name',
			title: 'Name',
			type: 'string',
			placeholder: 'e.g. Adam Roberts',
			validation: rule => rule.required(),
		}),
		defineField({
			name: 'image',
			title: 'Photo',
			type: 'image',
			options: { hotspot: true },
			description: 'Square headshot — shown as a small circle beside the name.',
		}),
		defineField({
			name: 'url',
			title: 'Link (optional)',
			type: 'url',
			placeholder: 'https://',
			description: 'Their website or profile. Their name links here in every case study they’re credited in.',
			validation: rule => rule.uri({ scheme: ['https', 'http'] }),
		}),
	],
	orderings: [{ title: 'Name', name: 'nameAsc', by: [{ field: 'name', direction: 'asc' }] }],
	preview: { select: { title: 'name', media: 'image' } },
});
