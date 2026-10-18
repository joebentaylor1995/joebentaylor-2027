// Sanity Content Import
// ------------
// NOTE • Seeds Sanity with everything the site currently renders from code:
// global settings, homepage, profile panel, reviews, every project in the
// ribbon and the Pocketchange case study — uploading each image, video and
// PDF from /public as a Sanity asset.
//
// Safe to re-run: singletons have fixed IDs, projects are matched by slug and
// reviews by author, and Sanity de-duplicates identical asset uploads.
//
// Usage: SANITY_API_WRITE_TOKEN=… bun run sanity:import
//        bun run sanity:import -- --profile-extras   (add the profile extras only)
// (an Editor token from sanity.io/manage → API → Tokens)

// Imports
// ------------
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createClient } from 'next-sanity';
import featuredJson from '../public/projects-ribbon/featured.json';
import allJson from '../public/projects-ribbon/projects.json';
import { type ProjectMedia, pocketchange } from '../src/data/projects';
import { fallbackHome, fallbackProfilePanel, fallbackReviews, fallbackSettings } from '../src/data/site';
import { toSanityColour } from './lib/colour';

// Config
// ------------
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';
const token = process.env.SANITY_API_WRITE_TOKEN;

if (!projectId || projectId === 'CHANGE_ME' || !token) {
	console.error('Set NEXT_PUBLIC_SANITY_PROJECT_ID and SANITY_API_WRITE_TOKEN first.');
	process.exit(1);
}

const client = createClient({ projectId, dataset, token, apiVersion: '2025-06-01', useCdn: false });
const PUBLIC_DIR = join(import.meta.dir, '../public');
const RIBBON_DIR = join(PUBLIC_DIR, 'projects-ribbon');

// Types
// ------------
type Reference = { _type: 'reference'; _ref: string };
type RibbonItem = { name: string; type: string; poster: string; video?: string; page?: string };

// Helpers
// ------------
const key = () => randomUUID().replaceAll('-', '').slice(0, 12);
const ref = (id: string): Reference => ({ _type: 'reference', _ref: id });
const withKey = <T extends object>(item: T) => ({ _key: key(), ...item });
const slugify = (value: string) =>
	value
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
// NOTE • Quotes are stored bare; the site adds the curly marks
const stripQuotes = (quote: string) =>
	quote
		.trim()
		.replace(/^[“"]\s*/, '')
		.replace(/\s*[”"]$/, '');

// NOTE • Uploads are large and the API occasionally resets connections —
// retry each request with a growing pause before giving up
const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = 2000;
const withRetry = async <T>(label: string, request: () => Promise<T>): Promise<T> => {
	for (let attempt = 1; ; attempt++) {
		try {
			return await request();
		} catch (error: unknown) {
			if (attempt >= MAX_ATTEMPTS) throw error;
			console.warn(`  ↻ ${label} (attempt ${attempt} failed, retrying)`);
			await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
		}
	}
};

const uploads = new Map<string, Promise<string>>();
const upload = (kind: 'image' | 'file', path: string) => {
	if (!uploads.has(path)) {
		uploads.set(
			path,
			withRetry(basename(path), () =>
				client.assets.upload(kind, readFileSync(path), { filename: basename(path) })
			).then(asset => {
				console.log(`  ↑ ${basename(path)}`);
				return asset._id;
			})
		);
	}
	return uploads.get(path) as Promise<string>;
};

// NOTE • Site paths (/images/…) live in /public; ribbon paths are relative to it
const publicPath = (src: string) => join(PUBLIC_DIR, src);
const ribbonPath = (src: string) => join(RIBBON_DIR, src);

const image = async (path: string, alt?: string) => ({
	_type: 'image' as const,
	asset: ref(await upload('image', path)),
	...(alt && { alt }),
});
const file = async (path: string) => ({ _type: 'file' as const, asset: ref(await upload('file', path)) });

const findId = (query: string, params: Record<string, string>) =>
	withRetry('lookup', () => client.fetch<string | null>(query, params));
const save = (doc: { _id: string; _type: string } & Record<string, unknown>) =>
	withRetry(doc._id, () => client.createOrReplace(doc));

// NOTE • Ordinary documents keep Sanity-generated IDs; a re-run updates the
// existing match instead of creating a duplicate
const upsert = async (match: string | null, doc: { _type: string } & Record<string, unknown>) => {
	if (match) {
		await save({ ...doc, _id: match });
		return match;
	}
	return (await withRetry(doc._type, () => client.create(doc)))._id;
};

// Reviews
// ------------
const importReviews = async () => {
	console.log('Reviews');
	const ids = new Map<string, string>();
	const outro = pocketchange.review;

	for (const review of fallbackReviews) {
		const isOutroReview = outro?.author === review.author;
		const id = await upsert(await findId('*[_type == "review" && author == $author][0]._id', review), {
			_type: 'review',
			quote: stripQuotes(review.quote),
			author: review.author,
			company: review.company,
			...(isOutroReview && { role: outro.role }),
			avatar: await image(publicPath(review.image)),
			...(review.logo && { logo: await image(publicPath(review.logo)) }),
			...(isOutroReview && {
				cutout: await image(publicPath(outro.image)),
				...(outro.imageBase && { cutoutBase: await image(publicPath(outro.imageBase)) }),
			}),
		});
		ids.set(review.author, id);
	}
	return ids;
};

// Projects
// ------------
const mediaItem = async (item: ProjectMedia) =>
	item.type === 'video'
		? {
				_type: 'mediaItem',
				kind: 'video',
				alt: item.alt,
				video: await file(publicPath(item.src)),
				...(item.poster && { poster: await image(publicPath(item.poster)) }),
			}
		: { _type: 'mediaItem', kind: 'image', alt: item.alt, image: await image(publicPath(item.src)) };

const importCaseStudy = async (reviewIds: Map<string, string>) => {
	console.log('Case study — Pocketchange');
	const project = pocketchange;
	const reviewId = project.review && reviewIds.get(project.review.author);

	const caseBuilder = [];
	for (const block of project.caseBuilder) {
		caseBuilder.push(
			block.type === 'single'
				? { _key: key(), _type: 'caseSingle', media: await mediaItem(block.media) }
				: {
						_key: key(),
						_type: 'caseDual',
						media: [withKey(await mediaItem(block.media[0])), withKey(await mediaItem(block.media[1]))],
					}
		);
	}

	const credits = [];
	for (const credit of project.overview.credits) {
		credits.push(
			withKey({
				name: credit.name,
				role: credit.role,
				...(credit.image && { image: await image(publicPath(credit.image)) }),
			})
		);
	}

	return upsert(await findId('*[_type == "project" && slug.current == $slug][0]._id', { slug: project.slug }), {
		_type: 'project',
		title: project.title,
		slug: { _type: 'slug', current: project.slug },
		thumbnailType: 'image',
		thumbnail: await image(publicPath(project.hero.src), project.hero.alt),
		hasCaseStudy: true,
		heroImage: await image(publicPath(project.hero.src), project.hero.alt),
		introduction: project.description,
		objectives: project.overview.objectives,
		deliverables: project.overview.deliverables,
		website: project.overview.website ?? undefined,
		credits,
		recognition: project.overview.recognition.map(award => withKey(award)),
		reviews: reviewId ? [withKey(ref(reviewId))] : [],
		caseBuilder,
	});
};

const importRibbonProject = async (item: RibbonItem) => {
	const slug = slugify(item.name);
	return upsert(await findId('*[_type == "project" && slug.current == $slug][0]._id', { slug }), {
		_type: 'project',
		title: item.name,
		slug: { _type: 'slug', current: slug },
		// NOTE • A tile is an image or a video loop (with its poster as the still)
		...(item.video
			? {
					thumbnailType: 'video',
					previewVideo: await file(ribbonPath(item.video)),
					videoPoster: await image(ribbonPath(item.poster)),
				}
			: { thumbnailType: 'image', thumbnail: await image(ribbonPath(item.poster)) }),
		hasCaseStudy: false,
		...(item.page && { externalUrl: item.page }),
	});
};

// Singletons
// ------------
const importSettings = async () => {
	console.log('Global settings');
	const settings = fallbackSettings;
	await save({
		_id: 'settings',
		_type: 'settings',
		name: settings.name,
		shortName: settings.shortName,
		tagline: settings.tagline,
		jobTitle: settings.jobTitle,
		description: settings.description,
		knowsAbout: settings.knowsAbout,
		email: settings.email,
		bookingLink: settings.bookingLink,
		location: settings.location,
		socials: settings.socials.map(social => withKey({ _type: 'social', ...social })),
		businessName: settings.businessName,
		companyNumber: settings.companyNumber,
		...(settings.resumeUrl && { resume: await file(publicPath(settings.resumeUrl)) }),
	});
};

const importHome = async () => {
	console.log('Homepage');
	const logos = [];
	for (const logo of fallbackHome.logos) {
		logos.push(withKey({ _type: 'clientLogo', name: logo.name, logo: await image(publicPath(logo.image)) }));
	}
	await save({
		_id: 'homePage',
		_type: 'homePage',
		heading: fallbackHome.heading,
		description: fallbackHome.description,
		clientLogos: logos,
	});
};

// NOTE • Sanity hotspots are the photo's focus point; the fallback's
// 'center bottom' portraits become a focus near the bottom edge
const PORTRAIT_HOTSPOT = { _type: 'sanity.imageHotspot', x: 0.5, y: 0.95, width: 0.6, height: 0.1 };

const toolkitField = async (toolkit: (typeof fallbackProfilePanel)['designToolkit']) => {
	const tools = [];
	for (const tool of toolkit.tools) {
		const layers = [];
		for (const layer of tool.layers) {
			layers.push(
				withKey({
					_type: 'toolLayer',
					image: await image(publicPath(layer.src)),
					...(layer.mask && { mask: await image(publicPath(layer.mask)) }),
					x: layer.x,
					y: layer.y,
					width: layer.width,
					height: layer.height,
					...(layer.angle !== undefined && { angle: layer.angle }),
				})
			);
		}
		tools.push(withKey({ _type: 'tool', label: tool.label, background: toSanityColour(tool.background), layers }));
	}
	return { _type: 'toolkit', title: toolkit.title, tools };
};

// NOTE • The title, photos, award posters and highlight tiles
const profileExtras = async () => {
	const panel = fallbackProfilePanel;
	const aboutImages = [];
	for (const photo of panel.aboutImages) {
		aboutImages.push(
			withKey({
				...(await image(publicPath(photo.src))),
				...(photo.focus === 'center bottom' && { hotspot: PORTRAIT_HOTSPOT }),
			})
		);
	}
	const awards = [];
	for (const award of panel.awards) awards.push(withKey(await image(publicPath(award.src))));

	return {
		titleLines: panel.titleLines,
		aboutImages,
		awards,
		designToolkit: await toolkitField(panel.designToolkit),
		developmentToolkit: await toolkitField(panel.developmentToolkit),
		keyboards: panel.keyboards,
		featuredOn: {
			eyebrow: panel.featuredOn.eyebrow,
			title: panel.featuredOn.title,
			linkLabel: panel.featuredOn.linkLabel,
			url: panel.featuredOn.url,
			...(panel.featuredOn.video && { video: await file(publicPath(panel.featuredOn.video)) }),
		},
		cssda: {
			title: panel.cssda.title,
			linkLabel: panel.cssda.linkLabel,
			url: panel.cssda.url,
			image: await image(publicPath(panel.cssda.image), panel.cssda.alt),
		},
	};
};

const importProfilePanel = async (reviewIds: Map<string, string>) => {
	console.log('Profile panel');
	const panel = fallbackProfilePanel;
	const services = [];
	for (const service of panel.services) {
		services.push(
			withKey({
				_type: 'service',
				title: service.title,
				...(service.image && { image: await image(publicPath(service.image)) }),
			})
		);
	}
	await save({
		_id: 'profilePanel',
		_type: 'profilePanel',
		introEyebrow: panel.introEyebrow,
		introduction: panel.introduction,
		about: panel.about,
		servicesIntro: [
			{
				_key: key(),
				_type: 'block',
				style: 'normal',
				markDefs: [],
				children: panel.servicesIntro.map(({ text, highlight }) => ({
					_key: key(),
					_type: 'span',
					text,
					marks: highlight ? ['highlight'] : [],
				})),
			},
		],
		services,
		recognitionIntro: panel.recognitionIntro,
		recognitionOutro: panel.recognitionOutro,
		...(await profileExtras()),
		reviews: panel.reviews.flatMap(({ author }) => {
			const id = reviewIds.get(author);
			return id ? [withKey(ref(id))] : [];
		}),
	});
};

const importProjectsPage = async (caseStudyId: string) => {
	console.log('Projects');
	const featuredNames = new Set(featuredJson.map(({ name }) => name));
	const featured = [caseStudyId];
	for (const item of featuredJson) featured.push(await importRibbonProject(item));

	const rest = [];
	for (const item of (allJson as RibbonItem[]).filter(({ name }) => !featuredNames.has(name))) {
		rest.push(await importRibbonProject(item));
	}

	await save({
		_id: 'projectsPage',
		_type: 'projectsPage',
		featured: featured.map(id => withKey(ref(id))),
		allProjects: rest.map(id => withKey(ref(id))),
	});
};

// Run
// ------------
// NOTE • --profile-extras adds just the title, photos, posters and highlight
// tiles to an existing profile panel, filling only fields that are still
// empty so edits made in the Studio are kept
const addProfileExtras = async () => {
	console.log('Profile panel — title, photos, award posters, highlights');
	const extras = await profileExtras();
	await withRetry('profilePanel', () =>
		client.patch('profilePanel').setIfMissing(extras).commit({ autoGenerateArrayKeys: true })
	);
	console.log(`\nDone — ${uploads.size} assets.`);
};

const run = async () => {
	console.log(`Importing into ${projectId}/${dataset}\n`);
	const reviewIds = await importReviews();
	const caseStudyId = await importCaseStudy(reviewIds);
	await importSettings();
	await importHome();
	await importProfilePanel(reviewIds);
	await importProjectsPage(caseStudyId);
	console.log(`\nDone — ${uploads.size} assets. Open /studio to edit.`);
};

(process.argv.includes('--profile-extras') ? addProfileExtras() : run()).catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
