// Award Organisation Schema
// ------------
// NOTE • An awarding body and the awards it gives, added once and picked in
// any case study's Awards — the award dropdown only offers this list.

// Imports
// ------------
import { StarIcon } from '@sanity/icons/Star';
import { defineArrayMember, defineField, defineType } from 'sanity';

// Exports
// ------------
export const awardBody = defineType({
	name: 'awardBody',
	title: 'Award organisation',
	type: 'document',
	icon: StarIcon,
	fields: [
		defineField({
			name: 'name',
			title: 'Name',
			type: 'string',
			placeholder: 'e.g. Awwwards',
			validation: rule => rule.required(),
		}),
		defineField({
			name: 'awards',
			title: 'Awards',
			type: 'array',
			of: [defineArrayMember({ type: 'string' })],
			options: { layout: 'tags' },
			description: 'Type an award and press Enter, e.g. SOTD, Honors. These are the choices in a case study.',
			validation: rule => rule.required().min(1).unique(),
		}),
	],
	orderings: [{ title: 'Name', name: 'nameAsc', by: [{ field: 'name', direction: 'asc' }] }],
	preview: {
		select: { title: 'name', awards: 'awards' },
		prepare: ({ title, awards }) => ({ title, subtitle: (awards as string[] | undefined)?.join(', ') }),
	},
});
