// Content Getters
// ------------
// NOTE • The one place pages and layouts read content from. Each getter asks
// Sanity (through the '@cms' seam — cached, never throws) and falls back to
// the local content in ./site and ./projects, so the site renders in full
// before Sanity is linked and can never render blank if it's unreachable.
//
// In draft mode (Visual Editing) strings arrive stega-encoded — invisible
// characters that map each one to its Studio field. Rendered text keeps them
// so it stays click-to-edit; anything used as logic, a link or metadata is
// cleaned here with stegaClean first.

// Imports
// ------------
import {
	fetchContent,
	GET_GLOBAL,
	GET_HOME,
	GET_PROFILE_PANEL,
	GET_PROJECT,
	GET_PROJECT_SLUGS,
	GET_PROJECTS_PAGE,
	isDraftMode,
} from '@cms';
import type { ToolkitItem, ToolkitLayer } from '@parts/Profile/Usps/Toolkit/interface';
import ribbonFeatured from '@public/projects-ribbon/featured.json';
import ribbonAll from '@public/projects-ribbon/projects.json';
import { stegaClean } from 'next-sanity';
import { fallbackProjects, type Project, type ProjectMedia, projectDummy } from './projects';
import {
	type AboutImage,
	fallbackHome,
	fallbackProfilePanel,
	fallbackSettings,
	type HomeContent,
	PLACEHOLDER_IMAGE,
	type ProfileImage,
	type ProfilePanelContent,
	type ProjectsLink,
	type ProjectsPageContent,
	type Review,
	type RibbonProject,
	type SiteSettings,
	type Toolkit,
} from './site';

// Helpers
// ------------
type Nullable<T> = { [K in keyof T]?: T[K] | null };

// NOTE • A field left empty in Sanity comes back as null — fall back per
// field, but respect values an editor set deliberately (including empty lists)
const withFallback = <T extends object>(data: Nullable<T> | null, fallback: T): T => {
	if (!data) return fallback;
	const merged = { ...fallback };
	for (const key of Object.keys(fallback) as (keyof T)[]) {
		const value = data[key];
		if (value !== null && value !== undefined) merged[key] = value as T[keyof T];
	}
	return merged;
};

// NOTE • Quotes are stored bare in Sanity; the curly marks are added here
// (around any stega characters, so the quote stays click-to-edit)
const withQuoteMarks = <T extends { quote: string }>(review: T): T => ({ ...review, quote: `“${review.quote}”` });

// NOTE • `type` drives the image/video branch, so it must compare cleanly
const cleanMediaType = <T extends ProjectMedia>(media: T): T => ({ ...media, type: stegaClean(media.type) });
const cleanBlock = (block: Project['caseBuilder'][number]): Project['caseBuilder'][number] =>
	block.type === 'single'
		? { ...block, media: cleanMediaType(block.media) }
		: { ...block, media: [cleanMediaType(block.media[0]), cleanMediaType(block.media[1])] };

// SECTION • Profile panel normalisers
type Hotspot = { x?: number; y?: number } | null | undefined;
type RawImage = { src: string; alt?: string | null; hotspot?: Hotspot };
type RawLayer = Nullable<ToolkitLayer> & { src: string };
// NOTE • @sanity/color-input value — rgb.a carries the transparency slider
type RawColour = { hex?: string | null; rgb?: { r: number; g: number; b: number; a?: number } | null };
type RawTool = Nullable<Omit<ToolkitItem, 'layers' | 'background'>> & {
	background?: RawColour | string | null;
	layers?: RawLayer[] | null;
};
type RawToolkit = { title?: string | null; tools?: RawTool[] | null };

// NOTE • A layer with no position is centred at 50 × 50px in the 98px tile
const DEFAULT_LAYER = { x: 24, y: 24, width: 50, height: 50 };
// NOTE • Award cards are 420 × 595 posters; 2× for the focused, scaled-up card
const POSTER_SIZE = { width: 840, height: 1190 };
const CENTRE = 0.5;
const toPercent = (value: number) => `${Math.round(value * 100)}%`;

const toFocus = (hotspot: Hotspot) =>
	typeof hotspot?.x === 'number' && typeof hotspot.y === 'number'
		? `${toPercent(hotspot.x)} ${toPercent(hotspot.y)}`
		: 'center';

const toAboutImage = ({ src, alt, hotspot }: RawImage): AboutImage => ({
	src,
	alt: alt ?? '',
	focus: toFocus(hotspot),
});

// NOTE • Cropped server-side around the hotspot — the WebGL spiral can't use object-position
const toPoster = ({ src, alt, hotspot }: RawImage): ProfileImage => ({
	alt: alt ?? '',
	src: `${src}?w=${POSTER_SIZE.width}&h=${POSTER_SIZE.height}&fit=crop&crop=focalpoint&fp-x=${hotspot?.x ?? CENTRE}&fp-y=${hotspot?.y ?? CENTRE}&fm=jpg&q=85`,
});

const OPAQUE = 1;

// NOTE • The toolkit canvas needs a CSS colour: hex when solid, rgba() when
// the transparency slider is used (e.g. the frosted tiles)
const toCssColour = (colour: RawColour | string | null | undefined) => {
	if (!colour || typeof colour === 'string') return colour || null;
	const { rgb, hex } = colour;
	if (rgb && (rgb.a ?? OPAQUE) < OPAQUE) return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${rgb.a})`;
	return hex || null;
};

const toLayer = (layer: RawLayer): ToolkitLayer => ({
	src: layer.src,
	...(layer.mask && { mask: layer.mask }),
	x: layer.x ?? DEFAULT_LAYER.x,
	y: layer.y ?? DEFAULT_LAYER.y,
	width: layer.width ?? DEFAULT_LAYER.width,
	height: layer.height ?? DEFAULT_LAYER.height,
	...(typeof layer.angle === 'number' && { angle: layer.angle }),
});

// NOTE • Tools are drawn to a canvas (colours, images), so they're stega-cleaned;
// the title is rendered text and stays click-to-edit
const toToolkit = (raw: RawToolkit | null | undefined, fallback: Toolkit): Toolkit => {
	if (!raw) return fallback;
	const tools = stegaClean(raw.tools ?? []).flatMap(tool => {
		const background = toCssColour(tool.background);
		return tool.id && tool.label && background && tool.layers?.length
			? [{ id: tool.id, label: tool.label, background, layers: tool.layers.map(toLayer) }]
			: [];
	});
	return { title: raw.title || fallback.title, tools: tools.length ? tools : fallback.tools };
};

const hasSrc = (media: { src?: string | null } | null | undefined) => Boolean(media?.src);

// NOTE • A block whose asset hasn't been uploaded yet is skipped, not crashed on
const isCompleteBlock = (block: Project['caseBuilder'][number]) =>
	block.type === 'single' ? hasSrc(block.media) : block.media?.length === 2 && block.media.every(hasSrc);

// NOTE • Unpublished references come back null — drop them; a project with
// no thumbnail yet still shows, on the placeholder
const toRibbonProjects = (items: (Nullable<RibbonProject> | null)[] | null | undefined): RibbonProject[] =>
	(items ?? []).flatMap(item =>
		item?.name
			? [
					{
						id: item.id ?? undefined,
						name: item.name,
						tags: (item.tags ?? []).filter(
							(tag): tag is string => typeof tag === 'string' && tag.trim().length > 0
						),
						type: item.type ?? 'image',
						poster: item.poster || PLACEHOLDER_IMAGE,
						video: item.video,
						href: item.href,
					},
				]
			: []
	);

// Exports
// ------------
// NOTE • Settings only feed metadata, structured data and links — always clean
export const getSettings = async (): Promise<SiteSettings> =>
	stegaClean(withFallback(await fetchContent<Nullable<SiteSettings>>(GET_GLOBAL), fallbackSettings));

// SECTION • Projects launch switch
// NOTE • Where the header's Projects link points while projects aren't live
const COMING_SOON_FALLBACK_URL = 'https://dribbble.com/joebentaylor';

/**
 * Visitors only see /projects and the case studies once “Projects live” is on
 * in Global settings. Draft mode (Sanity Presentation) always sees them, so
 * they can be built and previewed on production before launch.
 */
export const areProjectsVisible = async (): Promise<boolean> =>
	(await getSettings()).projectsLive || (await isDraftMode());

export const getProjectsLink = async (): Promise<ProjectsLink> => {
	const { socials } = await getSettings();
	return {
		isLive: await areProjectsVisible(),
		comingSoonUrl: socials.find(({ platform }) => platform === 'dribbble')?.url ?? COMING_SOON_FALLBACK_URL,
	};
};

export const getHome = async (): Promise<HomeContent> =>
	withFallback(await fetchContent<Nullable<HomeContent>>(GET_HOME), fallbackHome);

type RawProfilePanel = Omit<
	Nullable<ProfilePanelContent>,
	'aboutImages' | 'awards' | 'designToolkit' | 'developmentToolkit' | 'keyboards' | 'featuredOn' | 'cssda'
> & {
	aboutImages?: RawImage[] | null;
	awards?: RawImage[] | null;
	designToolkit?: RawToolkit | null;
	developmentToolkit?: RawToolkit | null;
	keyboards?: Nullable<ProfilePanelContent['keyboards']> | null;
	featuredOn?: Nullable<ProfilePanelContent['featuredOn']> | null;
	cssda?: Nullable<ProfilePanelContent['cssda']> | null;
};

export const getProfilePanel = async (): Promise<ProfilePanelContent> => {
	const data = await fetchContent<RawProfilePanel>(GET_PROFILE_PANEL);
	if (!data) return fallbackProfilePanel;
	const fallback = fallbackProfilePanel;

	return withFallback(
		{
			...data,
			reviews: data.reviews?.filter((review): review is Review => Boolean(review?.quote)).map(withQuoteMarks),
			// NOTE • Empty lists fall back too — the sequence and spiral need images to run
			aboutImages: data.aboutImages?.length ? data.aboutImages.map(toAboutImage) : null,
			awards: data.awards?.length ? data.awards.map(toPoster) : null,
			designToolkit: toToolkit(data.designToolkit, fallback.designToolkit),
			developmentToolkit: toToolkit(data.developmentToolkit, fallback.developmentToolkit),
			// NOTE • Tiles merge per field, so a half-filled tile keeps its coded defaults
			keyboards: withFallback(data.keyboards ?? null, fallback.keyboards),
			featuredOn: withFallback(data.featuredOn ?? null, fallback.featuredOn),
			cssda: withFallback(data.cssda ?? null, fallback.cssda),
		},
		fallback
	);
};

export const getProjectsPage = async (): Promise<ProjectsPageContent> => {
	const data = await fetchContent<{
		featured: (Nullable<RibbonProject> | null)[] | null;
		all: (Nullable<RibbonProject> | null)[] | null;
		others: (Nullable<RibbonProject> | null)[] | null;
		seo: ProjectsPageContent['seo'];
	}>(GET_PROJECTS_PAGE);

	// NOTE • The ribbon runs in an iframe the overlays can't reach — send it clean data
	const featured = stegaClean(toRibbonProjects(data?.featured));
	if (!featured.length)
		return { featured: ribbonFeatured as RibbonProject[], all: ribbonAll as RibbonProject[], seo: null };

	// NOTE • The grid shows every project: featured first, then the hand-ordered
	// All projects list, then everything else newest first
	const seen = new Set(featured.map(({ id }) => id));
	const rest = stegaClean([...toRibbonProjects(data?.all), ...toRibbonProjects(data?.others)]).filter(({ id }) => {
		if (seen.has(id)) return false;
		seen.add(id);
		return true;
	});
	return { featured, all: [...featured, ...rest], seo: data?.seo ?? null };
};

export const getProjectSlugs = async (): Promise<string[]> => {
	const slugs = await fetchContent<string[]>(GET_PROJECT_SLUGS);
	return slugs?.length ? stegaClean(slugs) : fallbackProjects.map(({ slug }) => slug);
};

export const getProject = async (slug: string): Promise<Project | null> => {
	const project = await fetchContent<Nullable<Project>>(GET_PROJECT, { slug });
	if (!project?.title) return fallbackProjects.find(item => item.slug === slug) ?? null;

	// NOTE • Required sections fall back to dummy content (see projectDummy) so a
	// half-built case study never renders empty; optional credits/awards hide
	const caseBuilder = (project.caseBuilder ?? []).filter(isCompleteBlock).map(cleanBlock);
	const objectives = project.overview?.objectives?.filter(Boolean) ?? [];
	const deliverables = project.overview?.deliverables?.filter(Boolean) ?? [];

	return {
		slug,
		title: project.title,
		description: project.description || projectDummy.description,
		hero: { src: project.hero?.src || PLACEHOLDER_IMAGE, alt: project.hero?.alt || project.title },
		caseBuilder: caseBuilder.length ? caseBuilder : projectDummy.caseBuilder,
		review: project.review?.quote ? withQuoteMarks(project.review) : projectDummy.review,
		nextProject: project.nextProject ?? null,
		overview: {
			objectives: objectives.length ? objectives : projectDummy.objectives,
			deliverables: deliverables.length ? deliverables : projectDummy.deliverables,
			credits: project.overview?.credits ?? [],
			recognition: project.overview?.recognition ?? [],
			website: project.overview?.website ?? null,
		},
		seo: project.seo ?? null,
	};
};
