// Imports
// ------------
import { profile, siteUrl } from '@/config';

// llms.txt
// ------------
// NOTE • Served at /llms.txt — a Markdown map of the site for AI agents and
// LLMs (https://llmstxt.org). Lighthouse's Agentic Browsing category checks
// it has an H1, at least one link and some substance. Keep the summary and
// links in step with the site; with a CMS, fetch the pages and list them.
const content = `# ${profile.name}

> ${profile.description}

${profile.name} (${profile.tagline}) designs brand identities and websites and builds them himself, combining strategy, visual design, motion and front-end development in one process. He trades as ${profile.business.name} and is open to new projects — email [${profile.email}](mailto:${profile.email}).

## Pages

- [Home](${siteUrl}/): Joe's work, profile, skills and how to get in touch.
- [Cookie Policy](${siteUrl}/cookies): How the site uses cookies and how to control them.
- [Terms & Privacy](${siteUrl}/terms-privacy): Terms of use and how personal data is handled.
- [AI & LLMs](${siteUrl}/llms): Guidance for AI assistants and LLMs — who Joe is, how to cite the site, and crawler and training permissions.

## Optional

- [Sitemap](${siteUrl}/sitemap.xml): Every page on the site.
${profile.sameAs.map(url => `- [${new URL(url).hostname.replace('www.', '')}](${url}): Elsewhere online.`).join('\n')}
`;

export const GET = () =>
	new Response(content, {
		headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
	});
