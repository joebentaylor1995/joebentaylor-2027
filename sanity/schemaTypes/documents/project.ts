// Project Schema
// ------------
// NOTE • One document per piece of work. Every project appears in the
// /projects ribbon; switch on “Case study” to give it its own page.

// Imports
// ------------
import { CaseIcon } from '@sanity/icons/Case';
import {
	type ConditionalPropertyCallbackContext,
	defineArrayMember,
	defineField,
	defineType,
	type ValidationContext,
} from 'sanity';
import { AwardInput } from '../../components/AwardInput';
import { CompressedVideoInput } from '../../components/CompressedVideoInput';
import { galleryPreviewUrl } from '../objects/caseGalleries';

// Helpers
// ------------
const isListingOnly = ({ document }: ConditionalPropertyCallbackContext) => !document?.hasCaseStudy;
const requiredForCaseStudy = (message: string) => (value: unknown, context: ValidationContext) =>
	context.document?.hasCaseStudy && (value === undefined || (Array.isArray(value) && !value.length)) ? message : true;

// Exports
// ------------
export const project = defineType({
	name: 'project',
	title: 'Project',
	type: 'document',
	icon: CaseIcon,
	groups: [
		{ name: 'listing', title: 'Listing', default: true },
		{ name: 'caseStudy', title: 'Case study' },
		{ name: 'builder', title: 'Visual builder' },
		{ name: 'seo', title: 'SEO' },
	],
	fieldsets: [{ name: 'details', title: 'Overview details', options: { collapsible: true } }],
	fields: [
		// Type
		defineField({
			name: 'hasCaseStudy',
			title: 'Case study',
			type: 'boolean',
			// NOTE • First on every tab it affects — when off, the case study tabs are empty
			group: ['listing', 'caseStudy', 'builder'],
			initialValue: false,
			description:
				'On: a full case study at /projects/<slug> — only case studies can be featured in the ribbon. Off: listing-only — it appears in All projects and opens the external link below.',
		}),

		defineField({
			name: 'isReady',
			title: 'Is ready',
			type: 'boolean',
			group: ['listing', 'caseStudy'],
			initialValue: false,
			hidden: isListingOnly,
			description:
				'On: visitors can open this case study from Featured and All projects. Off: the tile stays visible with a “Coming soon” tooltip. Publish to apply changes; direct case-study links remain accessible.',
		}),

		defineField({
			name: 'externalUrl',
			title: 'External link',
			type: 'url',
			group: 'listing',
			description:
				'e.g. the Dribbble shot or an agency’s case study — opens in a new tab. Leave empty and the tile still shows in All projects with a locked “Coming soon” tooltip, but isn’t clickable.',
			hidden: ({ document }) => Boolean(document?.hasCaseStudy),
		}),

		// Listing
		defineField({
			name: 'title',
			title: 'Title',
			type: 'string',
			group: ['listing', 'caseStudy'],
			placeholder: 'e.g. Pocketchange',
			validation: rule => rule.required(),
		}),
		defineField({
			name: 'slug',
			title: 'Slug',
			type: 'slug',
			group: 'listing',
			description: 'The case study’s address: /projects/<slug>. Only case studies have one.',
			options: { source: 'title', maxLength: 96 },
			hidden: isListingOnly,
			validation: rule => rule.custom(requiredForCaseStudy('Case studies need a slug for their address')),
		}),
		defineField({
			name: 'tags',
			title: 'Tags',
			type: 'array',
			group: 'listing',
			description:
				'Choose shared project tags. Drag to order them beneath the project name in the ribbon, separated by commas.',
			of: [defineArrayMember({ type: 'reference', to: [{ type: 'projectTag' }] })],
			validation: rule => rule.unique(),
		}),
		// NOTE • A tile is an image or a video loop, never both — the radio below
		// shows only the matching field
		defineField({
			name: 'thumbnailType',
			title: 'Thumbnail type',
			type: 'string',
			group: 'listing',
			initialValue: 'image',
			options: {
				layout: 'radio',
				direction: 'horizontal',
				list: [
					{ title: 'Image', value: 'image' },
					{ title: 'Video loop', value: 'video' },
				],
			},
			validation: rule => rule.required(),
		}),
		defineField({
			name: 'thumbnail',
			title: 'Thumbnail',
			type: 'image',
			group: 'listing',
			options: { hotspot: true },
			description:
				'The ribbon and grid tile — 16:10, e.g. 1600 × 1000. Until one is added, a grey placeholder shows.',
			fields: [defineField({ name: 'alt', title: 'Alternative text', type: 'string' })],
			hidden: ({ document }) => document?.thumbnailType === 'video',
			validation: rule =>
				rule
					.custom((value, { document }) =>
						document?.thumbnailType !== 'video' && !value
							? 'No thumbnail yet — the ribbon shows a placeholder.'
							: true
					)
					.warning(),
		}),
		defineField({
			name: 'previewVideo',
			title: 'Video loop',
			type: 'file',
			group: 'listing',
			options: { accept: 'video/mp4,video/webm' },
			// NOTE • Compresses in the browser before upload (H.264, ≤1280px, sound removed)
			components: { input: CompressedVideoInput },
			description: 'Muted MP4 that loops on the tile. Keep it short, 16:10 and under ~10 MB.',
			hidden: ({ document }) => document?.thumbnailType !== 'video',
			validation: rule =>
				rule.custom((value, { document }) =>
					document?.thumbnailType === 'video' && !value ? 'Add the video loop' : true
				),
		}),
		defineField({
			name: 'videoPoster',
			title: 'Poster frame (optional)',
			type: 'image',
			group: 'listing',
			options: { hotspot: true },
			description:
				'A still of the video, 16:10. Shown in the All projects grid (which only shows stills) and while the loop loads — a grey placeholder if empty.',
			hidden: ({ document }) => document?.thumbnailType !== 'video',
		}),

		// Case study
		defineField({
			name: 'heroImage',
			title: 'Hero image',
			type: 'image',
			group: 'caseStudy',
			options: { hotspot: true },
			description: 'Until one is added, the case study shows a grey placeholder.',
			fields: [defineField({ name: 'alt', title: 'Alternative text', type: 'string' })],
			hidden: isListingOnly,
			validation: rule =>
				rule.custom(requiredForCaseStudy('No hero image yet — the case study shows a placeholder.')).warning(),
		}),
		defineField({
			name: 'introduction',
			title: 'Introduction',
			type: 'text',
			rows: 5,
			group: 'caseStudy',
			placeholder:
				'One or two sentences on the client, the brief and what you made — shown under the title in the hero.',
			hidden: isListingOnly,
			validation: rule => rule.custom(requiredForCaseStudy('Case studies need an introduction')),
		}),
		defineField({
			name: 'objectives',
			title: 'Objectives',
			type: 'array',
			group: 'caseStudy',
			of: [
				defineArrayMember({
					type: 'text',
					rows: 3,
					placeholder: 'What the project set out to achieve — one paragraph per entry.',
				}),
			],
			description: 'One entry per paragraph. At least one is required.',
			hidden: isListingOnly,
			validation: rule => rule.custom(requiredForCaseStudy('Add at least one objective paragraph')),
		}),
		defineField({
			name: 'deliverables',
			title: 'Deliverables',
			type: 'array',
			group: 'caseStudy',
			fieldset: 'details',
			of: [defineArrayMember({ type: 'string' })],
			options: { layout: 'tags' },
			description: 'Type a deliverable and press Enter, e.g. Branding, Website, App. At least one is required.',
			hidden: isListingOnly,
			validation: rule => rule.custom(requiredForCaseStudy('Add at least one deliverable')),
		}),
		defineField({
			name: 'website',
			title: 'Live website',
			type: 'url',
			group: 'caseStudy',
			fieldset: 'details',
			hidden: isListingOnly,
		}),
		defineField({
			name: 'credits',
			title: 'Credits (optional)',
			type: 'array',
			group: 'caseStudy',
			fieldset: 'details',
			description:
				'Collaborators. Pick someone from People (or create them inline) and type their role on this project. Leave empty to hide the Credits section.',
			hidden: isListingOnly,
			of: [
				defineArrayMember({
					type: 'object',
					name: 'credit',
					fields: [
						defineField({
							name: 'person',
							title: 'Person',
							type: 'reference',
							to: [{ type: 'person' }],
							validation: rule => rule.required(),
						}),
						defineField({ name: 'role', title: 'Role', type: 'string', placeholder: 'e.g. 3D' }),
					],
					preview: {
						select: { title: 'person.name', subtitle: 'role', media: 'person.image' },
					},
				}),
			],
			validation: rule =>
				rule.custom((credits?: { person?: { _ref?: string } }[]) => {
					const refs = (credits ?? []).map(credit => credit.person?._ref).filter(Boolean);
					return new Set(refs).size === refs.length ? true : 'Each person can only be credited once';
				}),
		}),
		defineField({
			name: 'recognition',
			title: 'Awards (optional)',
			type: 'array',
			group: 'caseStudy',
			fieldset: 'details',
			description:
				'Pick an organisation from Award Organisations, then one of its awards. Leave empty to hide the Recognition section.',
			hidden: isListingOnly,
			of: [
				defineArrayMember({
					type: 'object',
					name: 'award',
					fields: [
						defineField({
							name: 'body',
							title: 'Organisation',
							type: 'reference',
							to: [{ type: 'awardBody' }],
							validation: rule => rule.required(),
						}),
						defineField({
							name: 'name',
							title: 'Award',
							type: 'string',
							components: { input: AwardInput },
							validation: rule => rule.required(),
						}),
					],
					preview: { select: { title: 'name', subtitle: 'body.name' } },
				}),
			],
			validation: rule =>
				rule.custom((awards?: { body?: { _ref?: string }; name?: string }[]) => {
					const pairs = (awards ?? []).map(award => `${award.body?._ref}:${award.name}`);
					return new Set(pairs).size === pairs.length ? true : 'Each award can only be listed once';
				}),
		}),
		defineField({
			name: 'reviews',
			title: 'Reviews',
			type: 'array',
			group: 'caseStudy',
			description: 'At least one is required — the first is featured in the case study outro.',
			of: [defineArrayMember({ type: 'reference', to: [{ type: 'review' }] })],
			hidden: isListingOnly,
			validation: rule =>
				rule.unique().custom(requiredForCaseStudy('Add at least one review for the case study outro')),
		}),

		// Visual builder
		defineField({
			name: 'caseBuilder',
			title: 'Case study builder',
			type: 'array',
			group: 'builder',
			description:
				'Stack full-width, two-up and animated gallery blocks. Drag to reorder. At least one is required.',
			of: [
				defineArrayMember({ type: 'caseSingle' }),
				defineArrayMember({ type: 'caseDual' }),
				defineArrayMember({ type: 'caseGalleryScatterDrift' }),
				defineArrayMember({ type: 'caseGalleryPanorama' }),
				defineArrayMember({ type: 'caseGalleryOrbit' }),
			],
			options: {
				insertMenu: {
					groups: [
						{ name: 'media', title: 'Media', of: ['caseSingle', 'caseDual'] },
						{
							name: 'animated',
							title: 'Animated galleries',
							of: ['caseGalleryScatterDrift', 'caseGalleryPanorama', 'caseGalleryOrbit'],
						},
					],
					views: [{ name: 'list' }, { name: 'grid', previewImageUrl: galleryPreviewUrl }],
				},
			},
			hidden: isListingOnly,
			validation: rule => rule.custom(requiredForCaseStudy('Add at least one media block')),
		}),

		// SEO
		defineField({ name: 'seo', title: 'SEO', type: 'seo', group: 'seo', options: { collapsed: false } }),
	],
	orderings: [{ title: 'Title', name: 'titleAsc', by: [{ field: 'title', direction: 'asc' }] }],
	preview: {
		select: {
			title: 'title',
			thumbnail: 'thumbnail',
			poster: 'videoPoster',
			thumbnailType: 'thumbnailType',
			hasCaseStudy: 'hasCaseStudy',
		},
		prepare: ({ title, thumbnail, poster, thumbnailType, hasCaseStudy }) => ({
			title,
			subtitle: hasCaseStudy ? 'Case study' : 'Listing only',
			media: thumbnailType === 'video' ? poster : thumbnail,
		}),
	},
});
