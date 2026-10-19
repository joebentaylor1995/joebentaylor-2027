// Site Content — types + fallbacks
// ------------
// NOTE • The shapes every page renders, and the content they fall back to
// when Sanity isn't linked (or a document is missing). The GROQ queries in
// src/cms/sanity/queries project Sanity straight into these types, and
// scripts/sanity-import.ts seeds Sanity from these values.

// Imports
// ------------
import type { Logo } from '@parts/Hero/LogoMarquee/interface';
import type { ToolkitItem } from '@parts/Profile/Usps/Toolkit/interface';
import { profile } from '@/config';
import { designTools, developmentTools } from './toolkits';

// Types
// ------------
export interface Seo {
	title?: string | null;
	description?: string | null;
	image?: string | null;
}

export interface Social {
	platform: string;
	url: string;
}

export interface SiteSettings {
	name: string;
	shortName: string;
	tagline: string;
	jobTitle: string;
	description: string;
	knowsAbout: string[];
	seo: Seo | null;
	email: string;
	bookingLink: string;
	location: { locality: string; region: string; country: string };
	socials: Social[];
	businessName: string;
	companyNumber: string;
	resumeUrl: string | null;
}

// NOTE • The slice of settings client components need (contact modal, profile CTA)
export interface ContactDetails {
	email: string;
	bookingLink: string;
	socials: Social[];
	resumeUrl: string | null;
}

export interface HomeContent {
	heading: string;
	description: string;
	logos: Logo[];
	seo: Seo | null;
}

export interface Review {
	quote: string;
	author: string;
	company: string;
	/** Portrait on its own */
	image: string;
	/** Company logo, shown as a badge on the portrait */
	logo?: string | null;
}

export interface RichTextSegment {
	text: string;
	highlight: boolean;
}

export interface ProfileImage {
	src: string;
	alt: string;
}

export interface AboutImage extends ProfileImage {
	/** CSS object-position — from the Sanity hotspot */
	focus: string;
}

export interface Toolkit {
	title: string;
	tools: readonly ToolkitItem[];
}

export interface LinkedTile {
	title: string;
	linkLabel: string;
	url: string | null;
}

export interface ProfilePanelContent {
	introEyebrow: string;
	titleLines: string[];
	introduction: string[];
	about: string[];
	aboutImages: AboutImage[];
	designToolkit: Toolkit;
	developmentToolkit: Toolkit;
	keyboards: { title: string; count: number };
	featuredOn: LinkedTile & { eyebrow: string; video: string | null };
	cssda: LinkedTile & { image: string; alt: string };
	awards: ProfileImage[];
	servicesIntro: RichTextSegment[];
	services: { title: string; image: string | null }[];
	recognitionIntro: string;
	recognitionOutro: string;
	reviews: Review[];
}

export interface RibbonProject {
	id?: string;
	name: string;
	/** Case-study tiles only open when explicitly enabled in Sanity. */
	isReady?: boolean;
	tags?: string[];
	type: 'image' | 'video';
	poster: string;
	video?: string | null;
	href?: string | null;
}

export interface ProjectsPageContent {
	featured: RibbonProject[];
	all: RibbonProject[];
	seo: Seo | null;
}

// Fallbacks
// ------------
// NOTE • Stands in for any missing ribbon poster, project thumbnail or case
// study hero, so the ribbon and heroes never render empty. Square, so it
// crops cleanly to every tile and hero ratio; it sends CORS headers, which
// the ribbon needs to use it as a WebGL texture.
export const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/1440x1440';

const platformOf = (url: string) => new URL(url).hostname.replace('www.', '').split('.')[0];

export const fallbackSettings: SiteSettings = {
	name: profile.name,
	shortName: profile.shortName,
	tagline: profile.tagline,
	jobTitle: profile.jobTitle,
	description: profile.description,
	knowsAbout: [...profile.knowsAbout],
	seo: null,
	email: profile.email,
	bookingLink: 'joebentaylor/30min',
	location: { ...profile.location },
	socials: profile.sameAs.map(url => ({ platform: platformOf(url), url })),
	businessName: profile.business.name,
	companyNumber: profile.business.companyNumber,
	resumeUrl: '/downloads/joe-ben-taylor-resume.pdf',
};

export const toContact = ({ email, bookingLink, socials, resumeUrl }: SiteSettings): ContactDetails => ({
	email,
	bookingLink,
	socials,
	resumeUrl,
});

export const fallbackContact = toContact(fallbackSettings);

const logo = (name: string, file: string, width: number, height: number): Logo => ({
	name,
	image: `/images/logos/${file}.png`,
	width,
	height,
});

export const fallbackHome: HomeContent = {
	heading: 'Digital Narrative Architect',
	description:
		'Building brands and digital worlds where logic meets emotion, craft meets code, and meaningful stories are made to be felt, not just seen.',
	logos: [
		logo('Google', 'google', 230, 72),
		logo('Hilton', 'hilton', 192, 132),
		logo('Durst', 'durst', 204, 86),
		logo('Global Citizen', 'globalcitizen', 248, 98),
		logo('Game', 'game', 204, 64),
		logo('Missguided', 'missguided', 270, 62),
		logo('Meta', 'meta', 238, 48),
		logo('Estee Lauder', 'esteelauder', 200, 118),
		logo('Nationwide', 'nationwide', 308, 40),
		logo('Halfords', 'halfords', 248, 52),
		logo('Spireworks', 'spireworks', 278, 32),
		logo('Polypipe', 'polypipe', 276, 62),
		logo('Uswitch', 'uswitch', 290, 74),
		logo('Symphony', 'symphony', 288, 64),
		logo('Footprint', 'footprint', 280, 76),
		logo('BLLA', 'blla', 225, 58),
		logo('Ideal Heating', 'ideaheating', 200, 108),
	],
	seo: null,
};

export const fallbackReviews: Review[] = [
	{
		quote: '“An exceptional professional whose unique blend of design and programming skills sets him apart in every project. His ability to conceptualise, design, and implement innovative solutions is truly impressive.”',
		author: 'Adam Roberts',
		company: 'Grilled Pixels',
		image: '/images/reviews/people/adam-roberts.png',
		logo: '/images/reviews/logos/grilled-pixels.png',
	},
	{
		quote: '“Exceeded every expectation, combining care and genius execution that few in the industry can match.”',
		author: 'Jillian Phyllis',
		company: 'Pocketchange',
		image: '/images/reviews/people/jillian-phyllis.png',
		logo: '/images/reviews/logos/pocketchange.png',
	},
	{
		quote: "“A talented, passionate, ambitious designer who gets stuck in. He was in-house for us for some time and we've brought him since when we needed a capable pair of hands.”",
		author: 'Greg Clark',
		company: 'Über',
		image: '/images/reviews/people/greg-clark.png',
		logo: '/images/reviews/logos/uber.png',
	},
	{
		quote: '“Incredibly easy to work with and always brings great ideas to the table. Appreciate all of the hard work and dedication he brings to each site! ”',
		author: 'Devon O’Toole',
		company: 'Durst',
		image: '/images/reviews/people/devon-otoole.png',
		logo: '/images/reviews/logos/durst.png',
	},
	{
		quote: "“A clear understanding of our business and objective's.  I highly recommend Joe for any future projects; his skill set and dedication make him an invaluable asset to any team.”",
		author: 'Alessio Villanacci',
		company: 'Sirio Strategies',
		image: '/images/reviews/people/alessio-villanacci.png',
		logo: '/images/reviews/logos/sirio.png',
	},
	{
		quote: '“One of the rare people who can deliver creative digital work whilst also having the ability to present, listen and communicate with the client along the way. An asset to any team!”',
		author: 'Tom Storer',
		company: 'Black Eye Project',
		image: '/images/reviews/people/tom-storer.png',
		logo: '/images/reviews/logos/black-eye-project.png',
	},
	{
		quote: '“Strategic, meticulous, and endlessly creative; Joe’s impact on every project is immediate and undeniable.”',
		author: 'Chris Martine',
		company: 'Levin Riegner',
		image: '/images/reviews/people/chris-martine.png',
		logo: '/images/reviews/logos/levin-riegner.png',
	},
	{
		quote: "“Extremely passionate about his craft. It's rare to meet someone who knows so much about the current trends as well as trying to push them further. ”",
		author: 'Jake Scales',
		company: 'Rare Creative',
		image: '/images/reviews/people/jake-scales.png',
		logo: '/images/reviews/logos/rare-creative.png',
	},
	{
		quote: "“Joe's pleasant 'can-do' attitude is just another one of his many attributes that would make him a valuable asset to anyone that is lucky enough to work with him.”",
		author: 'Craig Howard',
		company: 'SourceFlow',
		image: '/images/reviews/people/craig-howard.png',
		logo: '/images/reviews/logos/sourceflow.png',
	},
	{
		quote: "“I couldn't be happier with Joe's work. His creative ideas and ability to problem solve helped us create something powerful and unique that has helped us stand out in our market.”",
		author: 'Jamar Demorin',
		company: 'ONYX',
		image: '/images/reviews/people/jamar-demorin.png',
		logo: '/images/reviews/logos/onyx.png',
	},
];

const SERVICES = [
	'Naming',
	'Visual Identity',
	'Voice and Tone',
	'Brand Strategy',
	'Brand Guidelines',
	'Packaging',
	'Art Direction',
	'User Experience',
	'Website Design',
	'Product Design',
	'E-Commerce',
	'Mobile Apps',
	'Development',
	'Motion Graphics',
	'Social Media',
];

// NOTE • The About sequence's art direction: portraits sit on their bottom edge
const aboutPhoto = (file: string, focus = 'center'): AboutImage => ({
	src: `/images/about/${file}.webp`,
	alt: '',
	focus,
});
const PORTRAIT_FOCUS = 'center bottom';

// NOTE • Award poster files are numbered; 09 and 14 were retired
const AWARD_COUNT = 54;
const RETIRED_AWARDS = new Set([9, 14]);
const fallbackAwards: ProfileImage[] = Array.from({ length: AWARD_COUNT }, (_, index) => index + 1)
	.filter(id => !RETIRED_AWARDS.has(id))
	.map(id => ({ src: `/images/recognition/award-${String(id).padStart(2, '0')}.jpg`, alt: '' }));

export const fallbackProfilePanel: ProfilePanelContent = {
	introEyebrow: 'Bringing stories to life',
	titleLines: ['Designer', 'Developer', 'Storyteller'],
	introduction: [
		'For over a decade, I’ve been designing and developing for agencies and brands across the UK and beyond — from global icons like Google and Global Citizen to the next generation of founders rewriting the rules of business with purpose and conviction.',
		'I didn’t take the conventional route into design. No degree. No shortcuts. Just obsession, curiosity, and an unshakable drive to learn, refine, and master every facet of the creative process.',
	],
	about: [
		'I’m a dad first, a drummer at heart, and someone who finds rhythm in almost everything. Whether it’s sound, light, or motion, I’m drawn to the details that make things feel alive.',
		'I live by precision but chase creativity in its purest form; from late nights gaming and tinkering with code to quiet mornings with my son and our whacky, sock-thief, golden retriever.',
		'I’m calm under pressure, curious by nature, and always trying to build balance between logic and emotion — in life, not just in work.',
	],
	aboutImages: [
		aboutPhoto('portrait-master', PORTRAIT_FOCUS),
		aboutPhoto('son-master'),
		aboutPhoto('dog-master'),
		aboutPhoto('car-2x'),
		aboutPhoto('portrait-master', PORTRAIT_FOCUS),
	],
	designToolkit: { title: 'Design Toolkit', tools: designTools },
	developmentToolkit: { title: 'Development Toolkit', tools: developmentTools },
	keyboards: { title: 'Keyboard Collector', count: 10 },
	featuredOn: {
		eyebrow: 'Featured on',
		title: 'Codrops',
		linkLabel: 'Featured on Codrops',
		url: 'https://tympanus.net/codrops/2026/05/28/the-never-ending-story-building-a-seamless-infinite-scroll-experience-with-gsap-lenis/',
		video: '/videos/codrops.mp4',
	},
	cssda: {
		title: 'CSSDA Judge',
		linkLabel: 'CSSDA Judge',
		url: 'https://www.cssdesignawards.com/judges/joe-taylor/1893/',
		image: '/images/cssda/cssda.jpeg',
		alt: 'CSS Design Awards',
	},
	awards: fallbackAwards,
	servicesIntro: [
		{ text: 'While my work is centred around three core disciplines, ', highlight: false },
		{ text: 'Digital', highlight: true },
		{ text: ', ', highlight: false },
		{ text: 'Strategy', highlight: true },
		{ text: ', and ', highlight: false },
		{ text: 'Branding', highlight: true },
		{
			text: ' — it extends far beyond those boundaries. Here’s a closer look at what I can help you achieve.',
			highlight: false,
		},
	],
	services: SERVICES.map(title => ({
		title,
		image: `/images/services/${title.toLowerCase().replaceAll(' ', '-')}.jpg`,
	})),
	recognitionIntro: 'I’ve been fortunate to earn recognition — both individually and as part of incredible teams.',
	recognitionOutro:
		'Awards aren’t everything, but they’re a reminder that the work is connecting with people in the right way.',
	reviews: fallbackReviews,
};
