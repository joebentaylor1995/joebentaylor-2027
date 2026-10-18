import { PLACEHOLDER_IMAGE, type Seo } from './site';

export type ProjectMedia =
	| { type: 'image'; src: string; alt: string }
	| { type: 'video'; src: string; alt: string; poster?: string | null };

export type ProjectCaseBlock =
	| { id: string; type: 'single'; media: ProjectMedia }
	| { id: string; type: 'dual'; media: [ProjectMedia, ProjectMedia] };

export interface Project {
	slug: string;
	title: string;
	description: string;
	hero: { src: string; alt: string };
	caseBuilder: ProjectCaseBlock[];
	review: ProjectReview | null;
	overview: {
		objectives: string[];
		deliverables: string[];
		credits: { name: string; role: string; image?: string | null }[];
		recognition: { name: string; organisation: string }[];
		website?: string | null;
	};
	seo?: Seo | null;
}

export interface NextProject {
	href: string;
	title: string;
}

export interface ProjectReview {
	quote: string;
	author: string;
	role: string;
	image: string;
}

// Fallback Content
// ------------
// NOTE • Rendered when Sanity isn't linked or the project isn't published
// there yet — and the source the import script (scripts/sanity-import.ts)
// seeds Sanity from.

export const pocketchange: Project = {
	slug: 'pocketchange',
	title: 'Pocketchange',
	review: {
		quote: '“Exceeded every expectation, combining care and genius execution that few in the industry can match.”',
		author: 'Jillian Phyllis',
		role: 'Founder + CEO',
		image: '/images/reviews/people/jillian-phyllis.png',
	},
	description:
		'Pocketchange entrusted me with shaping their brand and digital ecosystem from the ground up, creating a distinctive identity, mobile experience, and launch platform designed to generate demand and establish a scalable foundation for national rollout and future global growth.',
	hero: {
		src: '/images/projects/pocketchange/hero.png',
		alt: 'A woman using her phone against a warm orange background.',
	},
	caseBuilder: [
		{
			id: 'identity',
			type: 'single',
			media: {
				type: 'image',
				src: '/images/projects/pocketchange/logo.jpg',
				alt: 'The white Pocketchange wordmark on vivid red.',
			},
		},
		{
			id: 'palette-and-app',
			type: 'dual',
			media: [
				{
					type: 'image',
					src: '/images/projects/pocketchange/palette.jpg',
					alt: 'Pocketchange colour palette: vivid red, traditional yellow, warm coffee and pale pink.',
				},
				{
					type: 'image',
					src: '/images/projects/pocketchange/app-store.jpg',
					alt: 'The Pocketchange App Store page on a phone.',
				},
			],
		},
		{
			id: 'typography',
			type: 'single',
			media: {
				type: 'image',
				src: '/images/projects/pocketchange/typography.jpg',
				alt: 'Cera Round Pro typography specimen.',
			},
		},
		{
			id: 'icons-and-symbol',
			type: 'dual',
			media: [
				{
					type: 'image',
					src: '/images/projects/pocketchange/icons.jpg',
					alt: 'White line icons for the Pocketchange app on red.',
				},
				{
					type: 'image',
					src: '/images/projects/pocketchange/symbol.jpg',
					alt: 'Pocketchange’s red P symbol on white.',
				},
			],
		},
		{
			id: 'sketches',
			type: 'single',
			media: {
				type: 'image',
				src: '/images/projects/pocketchange/sketches.png',
				alt: 'Pencil sketches exploring the Pocketchange identity.',
			},
		},
		{
			id: 'download',
			type: 'single',
			media: {
				type: 'image',
				src: '/images/projects/pocketchange/download.jpg',
				alt: 'Glass Download the app button over a warm gradient.',
			},
		},
		{
			id: 'chat-and-lifestyle',
			type: 'dual',
			media: [
				{
					type: 'image',
					src: '/images/projects/pocketchange/chat.jpg',
					alt: 'Red Let’s Chat button on white.',
				},
				{
					type: 'image',
					src: '/images/projects/pocketchange/lifestyle.jpg',
					alt: 'A woman using her phone against warm orange light.',
				},
			],
		},
		{
			id: 'coin',
			type: 'single',
			media: {
				type: 'image',
				src: '/images/projects/pocketchange/coin.jpg',
				alt: 'Gold coin embossed with the Pocketchange symbol.',
			},
		},
		{
			id: 'website',
			type: 'single',
			media: {
				type: 'image',
				src: '/images/projects/pocketchange/website.jpg',
				alt: 'Pocketchange website presented on a tablet.',
			},
		},
	],
	overview: {
		website: 'https://www.pocketchangethe.world',
		objectives: [
			'Aiming to become the platform at the heart of the local economy, connecting its mission with a digital experience that builds belief in the product and the opportunity behind it.',
			'The objective was to establish credibility with investors and press, create momentum around the launch, and turn early interest into adoption across iOS and Android.',
			'The result was a unified brand and digital foundation built for launch, giving Pocketchange a clear identity, a compelling product story, and a scalable platform capable of supporting its next stage of growth.',
		],
		deliverables: ['Branding', 'Website', 'App'],
		credits: [{ name: 'Adam Roberts', role: '3D', image: '/images/projects/pocketchange/adam-roberts.png' }],
		recognition: [
			{ name: 'SOTD', organisation: 'CSSDA' },
			{ name: 'SOTD', organisation: 'BestCSS' },
			{ name: 'SOTD', organisation: 'Mindsparkle' },
			{ name: 'SOTD', organisation: 'Orpetron' },
			{ name: 'OWDA', organisation: 'Orpetron' },
			{ name: 'Honors', organisation: 'Awwwards' },
			{ name: 'Favourite', organisation: 'WD Awards' },
			{ name: 'Star', organisation: 'CSS Winner' },
			{ name: 'UI', organisation: 'CSSDA' },
			{ name: 'UX', organisation: 'CSSDA' },
			{ name: 'Innovation', organisation: 'CSSDA' },
		],
	},
};

export const fallbackProjects: Project[] = [pocketchange];

// Dummy Content
// ------------
// NOTE • Stand-ins for a case study's required sections while they're still
// empty in Sanity, so a half-built page never renders blank. Sanity flags each
// missing field, so these never need to ship. Optional sections (credits,
// awards) are hidden instead of filled.
const LOREM =
	'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua, ut enim ad minim veniam.';

export const projectDummy = {
	description: `${LOREM} Quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.`,
	objectives: [
		`${LOREM} Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore.`,
		'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
	],
	deliverables: ['Branding', 'Website'],
	review: {
		quote: '“Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt.”',
		author: 'Client name',
		role: 'Role, Company',
		image: PLACEHOLDER_IMAGE,
	} satisfies ProjectReview,
	caseBuilder: [
		{ id: 'placeholder', type: 'single', media: { type: 'image', src: PLACEHOLDER_IMAGE, alt: '' } },
	] satisfies ProjectCaseBlock[],
};
