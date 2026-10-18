// Review Schema
// ------------
// NOTE • A testimonial, written once and reused in the profile panel's
// carousel and in any number of case studies.

// Imports
// ------------
import { CommentIcon } from '@sanity/icons/Comment';
import { defineField, defineType } from 'sanity';

// Exports
// ------------
export const review = defineType({
	name: 'review',
	title: 'Review',
	type: 'document',
	icon: CommentIcon,
	fields: [
		defineField({
			name: 'quote',
			title: 'Quote',
			type: 'text',
			rows: 4,
			description: 'Without surrounding quotation marks — the site adds them.',
			placeholder: 'What the client said about working together.',
			validation: rule => rule.required(),
		}),
		defineField({
			name: 'author',
			title: 'Author',
			type: 'string',
			placeholder: 'e.g. Jillian Phyllis',
			validation: rule => rule.required(),
		}),
		defineField({ name: 'role', title: 'Role', type: 'string', description: 'e.g. Founder + CEO' }),
		defineField({ name: 'company', title: 'Company', type: 'string' }),
		defineField({
			name: 'avatar',
			title: 'Portrait',
			type: 'image',
			options: { hotspot: true },
			description:
				'Square headshot on its own (no logo) — shown in a circle in the reviews carousel and case-study outros.',
			validation: rule => rule.required(),
		}),
		defineField({
			name: 'logo',
			title: 'Company logo',
			type: 'image',
			options: { hotspot: true },
			description:
				'Square logo, at least 48 × 48px. Shown as a small round badge on the portrait’s bottom-right, ringed in the panel’s background colour.',
		}),
	],
	preview: {
		select: { title: 'author', company: 'company', role: 'role', media: 'avatar' },
		prepare: ({ title, company, role, media }) => ({
			title,
			subtitle: [role, company].filter(Boolean).join(', '),
			media,
		}),
	},
});
