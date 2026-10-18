// Global Settings Schema
// ------------
// NOTE • Site-wide identity, SEO defaults and contact details. Every field
// falls back to `profile` in src/config.ts when left empty.

// Imports
// ------------
import { CogIcon } from '@sanity/icons/Cog';
import { defineArrayMember, defineField, defineType } from 'sanity';

// Constants
// ------------
export const SOCIAL_PLATFORMS = [
	{ title: 'LinkedIn', value: 'linkedin' },
	{ title: 'Dribbble', value: 'dribbble' },
	{ title: 'GitHub', value: 'github' },
	{ title: 'Instagram', value: 'instagram' },
	{ title: 'X', value: 'x' },
	{ title: 'Behance', value: 'behance' },
];

// Exports
// ------------
export const settings = defineType({
	name: 'settings',
	title: 'Global settings',
	type: 'document',
	icon: CogIcon,
	groups: [
		{ name: 'launch', title: 'Launch', default: true },
		{ name: 'identity', title: 'Identity' },
		{ name: 'seo', title: 'SEO' },
		{ name: 'contact', title: 'Contact' },
		{ name: 'business', title: 'Business' },
	],
	fields: [
		// Launch
		defineField({
			name: 'projectsLive',
			title: 'Projects live',
			type: 'boolean',
			group: 'launch',
			initialValue: false,
			description:
				'Off: visitors can’t see /projects or any case study — the header’s Projects link goes to Dribbble with a “Coming soon” label. On: everything goes live on publish. Previewing in Presentation always shows the projects, so you can build them before launch.',
		}),

		// Identity
		defineField({ name: 'name', title: 'Name', type: 'string', group: 'identity' }),
		defineField({ name: 'shortName', title: 'Short name', type: 'string', group: 'identity' }),
		defineField({
			name: 'tagline',
			title: 'Tagline',
			type: 'string',
			group: 'identity',
			description: 'Appended to the home page title: “Name — Tagline”.',
		}),
		defineField({ name: 'jobTitle', title: 'Job title', type: 'string', group: 'identity' }),
		defineField({
			name: 'description',
			title: 'Bio',
			type: 'text',
			rows: 3,
			group: 'identity',
			description: 'One or two sentences. Used as the default meta description and in structured data.',
		}),
		defineField({
			name: 'knowsAbout',
			title: 'Expertise',
			type: 'array',
			group: 'identity',
			of: [defineArrayMember({ type: 'string' })],
			options: { layout: 'tags' },
			description: 'Topics for search engines and AI answers (structured data + keywords).',
		}),

		// SEO
		defineField({
			name: 'seo',
			title: 'Default SEO',
			type: 'seo',
			group: 'seo',
			options: { collapsed: false },
		}),

		// Contact
		defineField({
			name: 'email',
			title: 'Email',
			type: 'email',
			group: 'contact',
		}),
		defineField({
			name: 'bookingLink',
			title: 'Cal.com booking link',
			type: 'string',
			group: 'contact',
			description: 'The path after cal.com/, e.g. joebentaylor/30min. Powers the contact modal calendar.',
			validation: rule =>
				rule.regex(/^[\w-]+\/[\w-]+$/, { name: 'cal.com path' }).error('Use the form user/event-type'),
		}),
		defineField({
			name: 'location',
			title: 'Location',
			type: 'object',
			group: 'contact',
			options: { columns: 3 },
			fields: [
				defineField({ name: 'locality', title: 'Town / city', type: 'string' }),
				defineField({ name: 'region', title: 'Region', type: 'string' }),
				defineField({ name: 'country', title: 'Country code', type: 'string', description: 'e.g. GB' }),
			],
		}),
		defineField({
			name: 'socials',
			title: 'Social links',
			type: 'array',
			group: 'contact',
			of: [
				defineArrayMember({
					type: 'object',
					name: 'social',
					fields: [
						defineField({
							name: 'platform',
							title: 'Platform',
							type: 'string',
							options: { list: SOCIAL_PLATFORMS },
							validation: rule => rule.required(),
						}),
						defineField({
							name: 'url',
							title: 'URL',
							type: 'url',
							validation: rule => rule.required(),
						}),
					],
					preview: { select: { title: 'platform', subtitle: 'url' } },
				}),
			],
		}),

		// Business
		defineField({ name: 'businessName', title: 'Business name', type: 'string', group: 'business' }),
		defineField({ name: 'companyNumber', title: 'Company number', type: 'string', group: 'business' }),
		defineField({
			name: 'resume',
			title: 'Résumé (PDF)',
			type: 'file',
			group: 'business',
			options: { accept: 'application/pdf' },
		}),
	],
	preview: { prepare: () => ({ title: 'Global settings' }) },
});
