// Imports
// ------------
import type { LegalDocument } from '../interface';

// Cookie Policy
// ------------
// NOTE • Copy mirrors Figma "Legal / Cookie Policy". Update `Last updated`
// and the table whenever a tool is added, removed or changed.
export const cookies: LegalDocument = {
	slug: 'cookies',
	title: ['Cookie', 'Policy'],
	intro: 'This policy explains how joebentaylor.co.uk uses cookies and similar technologies, what each one does and how you can control them. We keep them to the minimum needed to run the site and understand how it’s used.',
	meta: [
		{ label: 'Last updated', value: '16 October 2026' },
		{ label: 'Applies to', value: 'joebentaylor.co.uk' },
		{ label: 'Operated by', value: 'JoeBenTaylor Ltd' },
		{ label: 'Contact', value: '[hey@joebentaylor.co.uk](mailto:hey@joebentaylor.co.uk)' },
	],
	sections: [
		{
			id: 'who-we-are',
			title: 'Who we are',
			blocks: [
				{
					type: 'paragraph',
					text: 'This website, joebentaylor.co.uk, is operated by JoeBenTaylor Ltd, a company registered in England and Wales under company number 12440735. Our registered office is 294 Askern Road, Toll Bar, Doncaster, South Yorkshire, DN5 0QN, and our VAT number is GB462499263.',
				},
				{
					type: 'paragraph',
					text: 'In this policy, “we”, “us” and “our” mean JoeBenTaylor Ltd. “You” means anyone visiting the site.',
				},
				{
					type: 'paragraph',
					text: 'This policy sits alongside the privacy section of our [Terms & Privacy](/terms-privacy) page, which explains how we handle personal data more generally.',
				},
			],
		},
		{
			id: 'what-cookies-are',
			title: 'What cookies are',
			blocks: [
				{
					type: 'paragraph',
					text: 'Cookies are small text files that a website stores on your device when you visit. Similar technologies, such as local storage, pixels and scripts, do much the same job. They let a site remember things, like whether you’ve accepted analytics, or help the site owner understand how pages are used.',
				},
				{ type: 'paragraph', text: 'In this policy we use “cookies” to mean all of these technologies.' },
			],
		},
		{
			id: 'how-we-use-cookies',
			title: 'How we use cookies',
			blocks: [
				{
					type: 'paragraph',
					text: 'We use cookies for three reasons, and only the first happens without your permission.',
				},
				{
					type: 'list',
					items: [
						'**Strictly necessary:** we remember the choice you make in our cookie banner. Without this, the site can’t respect your preferences.',
						'**Analytics:** we measure how many people visit, which pages they view and how they found the site, so we can improve it. These cookies are only set if you accept them.',
						'**Embedded content:** if you play a YouTube or Vimeo video, or use the Cal.com booking calendar, those services may set their own cookies.',
					],
				},
				{
					type: 'paragraph',
					text: 'We don’t use advertising, retargeting or social media tracking cookies, and we never sell your data.',
				},
			],
		},
		{
			id: 'cookies-we-use',
			title: 'Cookies we use',
			blocks: [
				{
					type: 'table',
					rows: [
						{
							name: 'cookie_consent',
							provider: 'JoeBenTaylor',
							purpose: 'Remembers your cookie choices. Strictly necessary.',
							duration: '12 months',
						},
						{
							name: '_ga',
							provider: 'Google Analytics',
							purpose: 'Distinguishes unique visitors. Only set with your consent.',
							duration: '2 years',
						},
						{
							name: '_ga_<container-id>',
							provider: 'Google Analytics',
							purpose: 'Keeps track of your session. Only set with your consent.',
							duration: '2 years',
						},
						{
							name: 'YSC',
							provider: 'YouTube',
							purpose: 'Tracks views of embedded videos within a session. Set when you play a video.',
							duration: 'Session',
						},
						{
							name: 'VISITOR_INFO1_LIVE',
							provider: 'YouTube',
							purpose: 'Estimates your bandwidth so videos play smoothly.',
							duration: '6 months',
						},
						{
							name: 'VISITOR_PRIVACY_METADATA',
							provider: 'YouTube',
							purpose: 'Stores your YouTube consent state for this site.',
							duration: '6 months',
						},
						{
							name: 'vuid',
							provider: 'Vimeo',
							purpose: 'Collects playback statistics for the Vimeo player.',
							duration: '2 years',
						},
					],
				},
				{
					type: 'note',
					text: 'Third-party cookie names and durations are set by each provider and can change. This table reflects the cookies in use on the date shown at the top of this page.',
				},
			],
		},
		{
			id: 'google-tag-manager-and-google-analytics',
			title: 'Google Tag Manager and Google Analytics',
			blocks: [
				{
					type: 'paragraph',
					text: 'We use Google Tag Manager to load the scripts on this site. Tag Manager doesn’t set cookies itself. It only loads Google Analytics 4 after you accept analytics cookies, using Google Consent Mode, so nothing is measured before you decide.',
				},
				{
					type: 'paragraph',
					text: 'Google Analytics 4 does not log or store IP addresses. We have not enabled Google signals or any advertising features, and Analytics is not linked to any advertising account. Analytics data is processed by Google, which may transfer it outside the UK under appropriate safeguards.',
				},
				{
					type: 'paragraph',
					text: 'You can read how Google uses data from sites that use its services at [policies.google.com/technologies/partner-sites](https://policies.google.com/technologies/partner-sites).',
				},
			],
		},
		{
			id: 'netlify-analytics',
			title: 'Netlify Analytics',
			blocks: [
				{
					type: 'paragraph',
					text: 'The site is hosted by Netlify. We use Netlify Analytics, which works from server logs rather than cookies, so it doesn’t store or read anything on your device. It gives us aggregate figures such as page views, top pages and referring sites.',
				},
				{
					type: 'paragraph',
					text: 'As part of hosting, Netlify processes technical data, including IP addresses, to deliver and secure the site.',
				},
			],
		},
		{
			id: 'embedded-videos-and-bookings',
			title: 'Embedded videos and bookings',
			blocks: [
				{
					type: 'paragraph',
					text: 'Some pages include videos hosted on YouTube or Vimeo. YouTube videos are embedded in privacy-enhanced mode (youtube-nocookie.com), so YouTube doesn’t set cookies until you press play. Once you play a video, YouTube or Vimeo may set cookies and collect data under their own privacy policies.',
				},
				{
					type: 'paragraph',
					text: 'Calls are booked through Cal.com. If you open or use the booking calendar, Cal.com may set cookies it needs for the booking to work. The details you enter, such as your name and email address, are shared with Cal.com and with us so we can arrange the call.',
				},
			],
		},
		{
			id: 'managing-your-choices',
			title: 'Managing your choices',
			blocks: [
				{
					type: 'paragraph',
					text: 'When you first visit, a banner asks whether you’re happy for us to use analytics cookies. Nothing other than strictly necessary cookies is set until you choose, and rejecting is as easy as accepting.',
				},
				{
					type: 'paragraph',
					text: 'You can change your mind at any time using the Cookie settings link in the site footer. You can also block or delete cookies in your browser settings, although blocking all cookies may stop embedded videos or the booking calendar from working.',
				},
				{
					type: 'paragraph',
					text: 'To opt out of Google Analytics on every website you visit, you can install Google’s opt-out browser add-on from [tools.google.com/dlpage/gaoptout](https://tools.google.com/dlpage/gaoptout).',
				},
			],
		},
		{
			id: 'changes-to-this-policy',
			title: 'Changes to this policy',
			blocks: [
				{
					type: 'paragraph',
					text: 'We’ll update this policy whenever we add, remove or change the tools we use. The date at the top always shows the latest version. If a change affects what we ask your consent for, we’ll ask you again.',
				},
			],
		},
		{
			id: 'contact-and-complaints',
			title: 'Contact and complaints',
			blocks: [
				{
					type: 'paragraph',
					text: 'If you have a question about cookies or how we use data, email [hey@joebentaylor.co.uk](mailto:hey@joebentaylor.co.uk) and we’ll get back to you as soon as we can.',
				},
				{
					type: 'paragraph',
					text: 'If you’re unhappy with how we’ve handled your information, please tell us first so we can put it right. You also have the right to complain to the Information Commissioner’s Office at [ico.org.uk](https://ico.org.uk).',
				},
			],
		},
	],
};
