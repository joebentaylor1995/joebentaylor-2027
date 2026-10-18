// Profile Panel Schema
// ------------
// NOTE • The slide-out “about me” panel shared by every page. Copy, photos,
// award posters and the highlight tiles' content are editable here; the
// animation and interaction of each section stays in code.

// Imports
// ------------
import { UserIcon } from '@sanity/icons/User';
import { defineArrayMember, defineField, defineType } from 'sanity';
import { CompressedVideoInput } from '../../components/CompressedVideoInput';

// Constants
// ------------
// NOTE • The About scroll sequence is choreographed for exactly five frames:
// it opens and closes on a portrait with three photos between
const ABOUT_FRAMES = 5;
// NOTE • The award spiral's cards are A-series posters (420 × 595)
const POSTER_RATIO = '420 × 595';

const linkFields = (defaultLabel: string) => [
	defineField({
		name: 'linkLabel',
		title: 'Link label',
		type: 'string',
		description: `Read by screen readers, e.g. “${defaultLabel}”.`,
	}),
	defineField({ name: 'url', title: 'Link', type: 'url' }),
];

// Exports
// ------------
export const profilePanel = defineType({
	name: 'profilePanel',
	title: 'Profile panel',
	type: 'document',
	icon: UserIcon,
	groups: [
		{ name: 'introduction', title: 'Introduction', default: true },
		{ name: 'about', title: 'About' },
		{ name: 'services', title: 'Services' },
		{ name: 'highlights', title: 'Highlights' },
		{ name: 'recognition', title: 'Recognition' },
		{ name: 'reviews', title: 'Reviews' },
	],
	fields: [
		defineField({
			name: 'introEyebrow',
			title: 'Eyebrow',
			type: 'string',
			group: 'introduction',
			description: 'Small heading above the title, e.g. “Bringing stories to life”.',
		}),
		defineField({
			name: 'titleLines',
			title: 'Title',
			type: 'array',
			group: 'introduction',
			description: 'The large fill-wave title, one line each — e.g. Designer, Developer, Storyteller.',
			of: [defineArrayMember({ type: 'string' })],
			validation: rule => rule.max(4).warning('More than four lines won’t fit the panel on mobile.'),
		}),
		defineField({
			name: 'introduction',
			title: 'Introduction',
			type: 'array',
			group: 'introduction',
			of: [defineArrayMember({ type: 'text', rows: 4 })],
			description: 'One entry per paragraph.',
		}),
		defineField({
			name: 'about',
			title: 'About',
			type: 'array',
			group: 'about',
			of: [defineArrayMember({ type: 'text', rows: 4 })],
			description: 'One entry per paragraph.',
		}),
		defineField({
			name: 'aboutImages',
			title: 'About photos',
			type: 'array',
			group: 'about',
			description: `The scroll sequence: exactly ${ABOUT_FRAMES} photos. It opens and closes on the first and last (usually the same portrait). Set each photo’s hotspot to keep the subject in frame.`,
			of: [
				defineArrayMember({
					type: 'image',
					options: { hotspot: true },
					fields: [defineField({ name: 'alt', title: 'Alternative text', type: 'string' })],
				}),
			],
			validation: rule => rule.length(ABOUT_FRAMES).warning(`The sequence is built for ${ABOUT_FRAMES} photos.`),
		}),
		defineField({
			name: 'servicesIntro',
			title: 'Services introduction',
			type: 'array',
			group: 'services',
			description: 'Use the Highlight button for the words that light up on scroll.',
			of: [
				defineArrayMember({
					type: 'block',
					styles: [{ title: 'Normal', value: 'normal' }],
					lists: [],
					marks: {
						decorators: [{ title: 'Highlight', value: 'highlight' }],
						annotations: [],
					},
				}),
			],
		}),
		defineField({
			name: 'services',
			title: 'Services',
			type: 'array',
			group: 'services',
			of: [
				defineArrayMember({
					type: 'object',
					name: 'service',
					fields: [
						defineField({
							name: 'title',
							title: 'Service',
							type: 'string',
							validation: rule => rule.required(),
						}),
						defineField({
							name: 'image',
							title: 'Thumbnail',
							type: 'image',
							options: { hotspot: true },
							description: 'Small square image revealed beside the service on scroll.',
						}),
					],
					preview: { select: { title: 'title', media: 'image' } },
				}),
			],
		}),
		// Highlights — the USP tiles
		defineField({ name: 'designToolkit', title: 'Design toolkit', type: 'toolkit', group: 'highlights' }),
		defineField({
			name: 'developmentToolkit',
			title: 'Development toolkit',
			type: 'toolkit',
			group: 'highlights',
		}),
		defineField({
			name: 'keyboards',
			title: 'Keyboard collector',
			type: 'object',
			group: 'highlights',
			options: { columns: 2 },
			fields: [
				defineField({ name: 'title', title: 'Title', type: 'string' }),
				defineField({
					name: 'count',
					title: 'Number of boards',
					type: 'number',
					validation: rule => rule.integer().min(0),
				}),
			],
		}),
		defineField({
			name: 'featuredOn',
			title: 'Featured on',
			type: 'object',
			group: 'highlights',
			fields: [
				defineField({ name: 'eyebrow', title: 'Eyebrow', type: 'string', description: 'e.g. Featured on' }),
				defineField({ name: 'title', title: 'Publication', type: 'string', description: 'e.g. Codrops' }),
				...linkFields('Featured on Codrops'),
				defineField({
					name: 'video',
					title: 'Video loop',
					type: 'file',
					options: { accept: 'video/mp4,video/webm' },
					// NOTE • Compresses in the browser before upload (H.264, ≤1280px, sound removed)
					components: { input: CompressedVideoInput },
					description: 'Muted MP4 that loops in the tile. Keep it short and small (under ~2 MB).',
				}),
			],
		}),
		defineField({
			name: 'cssda',
			title: 'Judging',
			type: 'object',
			group: 'highlights',
			fields: [
				defineField({ name: 'title', title: 'Title', type: 'string', description: 'e.g. CSSDA Judge' }),
				...linkFields('CSSDA Judge'),
				defineField({
					name: 'image',
					title: 'Image',
					type: 'image',
					options: { hotspot: true },
					fields: [defineField({ name: 'alt', title: 'Alternative text', type: 'string' })],
				}),
			],
		}),
		defineField({
			name: 'recognitionIntro',
			title: 'Recognition intro',
			type: 'text',
			rows: 2,
			group: 'recognition',
		}),
		defineField({
			name: 'recognitionOutro',
			title: 'Recognition outro',
			type: 'text',
			rows: 2,
			group: 'recognition',
		}),
		defineField({
			name: 'awards',
			title: 'Award posters',
			type: 'array',
			group: 'recognition',
			description: `The rising spiral of posters, in order (${POSTER_RATIO} portrait — other ratios are cropped around the hotspot). The first three also show if WebGL is unavailable.`,
			of: [
				defineArrayMember({
					type: 'image',
					options: { hotspot: true },
					fields: [defineField({ name: 'alt', title: 'Award', type: 'string' })],
				}),
			],
			options: { layout: 'grid' },
		}),
		defineField({
			name: 'reviews',
			title: 'Reviews',
			type: 'array',
			group: 'reviews',
			description: 'The reviews carousel, in order.',
			of: [defineArrayMember({ type: 'reference', to: [{ type: 'review' }] })],
			validation: rule => rule.unique(),
		}),
	],
	preview: { prepare: () => ({ title: 'Profile panel' }) },
});
