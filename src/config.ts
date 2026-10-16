// Site Configuration
// ------------
// NOTE • The canonical site URL — single source for metadataBase (SEO),
// sitemap.xml and robots.txt. Set NEXT_PUBLIC_SITE_URL per environment;
// the fallback keeps local builds working.
export const isSiteUrlConfigured = Boolean(process.env.NEXT_PUBLIC_SITE_URL);

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://joebentaylor.co.uk').replace(/\/+$/, '');

// NOTE • A deploy that forgot NEXT_PUBLIC_SITE_URL (a preview, say) would
// publish canonical/OG URLs for the live domain — warn loudly, and the site
// layout flips robots to noindex until the URL is set.
if (!isSiteUrlConfigured && process.env.NODE_ENV === 'production') {
	console.warn(
		'⚠ NEXT_PUBLIC_SITE_URL is not set — metadata falls back to https://joebentaylor.co.uk and robots is forced to noindex. Set it per environment before going live.'
	);
}

// Profile
// ------------
// NOTE • Who the site is about — the single source for page metadata, the
// JSON-LD structured data, the share card and llms.txt. Facts mirror the
// /llms page (src/components/LegalPage/content/llms.ts); keep them in step.
export const profile = {
	name: 'Joe Ben Taylor',
	shortName: 'JBT',
	tagline: 'Designer, Developer, Storyteller',
	jobTitle: 'Independent Designer & Developer',
	description:
		'Joe Ben Taylor is an independent designer and developer in Doncaster, UK, crafting cinematic, motion-led brand identities and websites — from strategy to launch.',
	email: 'hey@joebentaylor.co.uk',
	locale: 'en_GB',
	location: { locality: 'Doncaster', region: 'South Yorkshire', country: 'GB' },
	business: { name: 'JoeBenTaylor Ltd', companyNumber: '12440735' },
	sameAs: [
		'https://www.linkedin.com/in/joebentaylor/',
		'https://dribbble.com/joebentaylor',
		'https://github.com/joebentaylor1995',
	],
	knowsAbout: [
		'Brand identity',
		'Brand strategy',
		'Website design',
		'User experience',
		'Motion design',
		'Front-end development',
		'Next.js',
		'React',
		'TypeScript',
		'GSAP',
		'WebGL',
		'Headless CMS',
	],
} as const;
