// Imports
// ------------
import type { LegalDocument } from '../interface';

// Terms & Privacy
// ------------
// NOTE • Copy mirrors Figma "Legal / Terms & Privacy". Update `Last updated`
// whenever the terms, providers or retention periods change.
export const termsPrivacy: LegalDocument = {
	slug: 'terms-privacy',
	title: ['Terms &', 'Privacy'],
	intro: 'These terms set out the rules for using joebentaylor.co.uk, and the privacy section explains how we handle your personal data. By using the site you agree to the terms, so please read them carefully. If you don’t agree, please don’t use the site.',
	meta: [
		{ label: 'Last updated', value: '16 October 2026' },
		{ label: 'Applies to', value: 'joebentaylor.co.uk' },
		{ label: 'Operated by', value: 'JoeBenTaylor Ltd' },
		{ label: 'Contact', value: '[hey@joebentaylor.co.uk](mailto:hey@joebentaylor.co.uk)' },
	],
	sections: [
		{
			id: 'about-us',
			title: 'About us',
			blocks: [
				{
					type: 'paragraph',
					text: 'joebentaylor.co.uk is operated by JoeBenTaylor Ltd, a company registered in England and Wales under company number 12440735. Our registered office is 294 Askern Road, Toll Bar, Doncaster, South Yorkshire, DN5 0QN, and our VAT number is GB462499263.',
				},
				{
					type: 'paragraph',
					text: 'On this page, “we”, “us” and “our” mean JoeBenTaylor Ltd, and “you” means anyone using the site.',
				},
			],
		},
		{
			id: 'using-this-site',
			title: 'Using this site',
			blocks: [
				{
					type: 'paragraph',
					text: 'This is a portfolio and enquiry site. It shows examples of our work and lets you get in touch or book a call. We don’t sell goods or services through it, and nothing on it is an offer capable of forming a contract.',
				},
				{
					type: 'paragraph',
					text: 'You may use the site for your own information and to contact us. We may update, suspend or withdraw any part of it at any time without notice, and we don’t guarantee that it will always be available or free from errors.',
				},
				{
					type: 'paragraph',
					text: 'The content is general information about our work. Case study results, timings and figures describe specific projects and aren’t a promise of future results, and you shouldn’t rely on anything here as professional advice.',
				},
			],
		},
		{
			id: 'working-with-us',
			title: 'Working with us',
			blocks: [
				{
					type: 'paragraph',
					text: 'Booking a call or sending an enquiry doesn’t create a contract between us. Any project, retainer or other engagement is governed by a separate written agreement, which we’ll share with you before any work starts. If that agreement conflicts with these terms, the agreement takes priority.',
				},
			],
		},
		{
			id: 'intellectual-property',
			title: 'Intellectual property',
			blocks: [
				{
					type: 'paragraph',
					text: 'Unless we say otherwise, the content on this site, including text, design, code, graphics, motion, video and the JoeBenTaylor name and logo, is owned by or licensed to JoeBenTaylor Ltd and protected by copyright and other intellectual property laws. All rights are reserved.',
				},
				{
					type: 'paragraph',
					text: 'Client work shown in case studies is included with permission. Client names, logos, trade marks and brand assets belong to their respective owners, and showing them here doesn’t mean they endorse this site.',
				},
				{
					type: 'paragraph',
					text: 'You may view the site and share links to it. You may not copy, reproduce, republish, sell or create derivative works from any part of it, or use it to train or develop AI models, without our written permission.',
				},
				{
					type: 'paragraph',
					text: 'You’re welcome to link to our home page or any case study, as long as you do it fairly and don’t suggest an association or endorsement that doesn’t exist. Please don’t frame the site within another website.',
				},
			],
		},
		{
			id: 'acceptable-use',
			title: 'Acceptable use',
			blocks: [
				{ type: 'paragraph', text: 'You must not:' },
				{
					type: 'list',
					items: [
						'Use the site in any way that breaks the law or is fraudulent.',
						'Try to gain unauthorised access to the site, the server it’s stored on or any connected system.',
						'Introduce viruses, malware or any other harmful code.',
						'Attack the site through a denial-of-service attack or similar.',
						'Scrape, harvest or bulk download content, except where permitted on our [AI & LLMs](/llms) page.',
						'Use our work, name or brand in a way that suggests a connection with or endorsement of you.',
					],
				},
				{
					type: 'paragraph',
					text: 'Breaching this section may be a criminal offence under the Computer Misuse Act 1990. We’ll report any such breach to the relevant authorities and cooperate with them, and your right to use the site will end immediately.',
				},
			],
		},
		{
			id: 'ai-and-automated-access',
			title: 'AI and automated access',
			blocks: [
				{
					type: 'paragraph',
					text: 'Search engines and AI assistants may crawl and index this site so they can answer questions about us and link back to it. Content from this site must not be used to train, fine-tune or otherwise develop AI models, whether it’s collected directly or through a third party.',
				},
				{
					type: 'paragraph',
					text: 'Our [robots.txt](/robots.txt) file and our [AI & LLMs](/llms) page set out which crawlers are permitted. We reserve all rights over text and data mining of this site.',
				},
			],
		},
		{
			id: 'third-party-services',
			title: 'Third-party services',
			blocks: [
				{
					type: 'paragraph',
					text: 'The site links to and embeds services run by others, including Cal.com, YouTube, Vimeo, LinkedIn, Dribbble and GitHub. We don’t control those services and aren’t responsible for their content. Their own terms and privacy policies apply when you use them.',
				},
			],
		},
		{
			id: 'our-liability',
			title: 'Our liability',
			blocks: [
				{
					type: 'paragraph',
					text: 'Nothing on this page limits or excludes our liability for death or personal injury caused by our negligence, for fraud or fraudulent misrepresentation, or for anything else that can’t be limited or excluded under the law of England and Wales.',
				},
				{
					type: 'paragraph',
					text: 'If you use the site as a business, we exclude all implied conditions, warranties and representations to the extent the law allows. We won’t be liable for any loss of profit, revenue, business, goodwill or data, or for any indirect or consequential loss, arising from your use of, or inability to use, the site or your reliance on its content.',
				},
				{
					type: 'paragraph',
					text: 'If you’re a consumer, the site is for private use only. We won’t be liable for losses that weren’t reasonably foreseeable, or for any business losses. We don’t guarantee that the site is free from viruses, so please use your own virus protection.',
				},
			],
		},
		{
			id: 'your-privacy-at-a-glance',
			title: 'Your privacy at a glance',
			blocks: [
				{
					type: 'paragraph',
					text: 'JoeBenTaylor Ltd is the controller of the personal data collected through this site. We collect as little as we can. There’s no contact form, we don’t sell data and we don’t use it for advertising.',
				},
				{
					type: 'paragraph',
					text: 'The sections below explain what we collect, why we collect it and the rights you have under UK data protection law, including the UK GDPR and the Data Protection Act 2018. Our [Cookie Policy](/cookies) explains the cookies we use in more detail.',
				},
			],
		},
		{
			id: 'information-we-collect',
			title: 'Information we collect',
			blocks: [
				{
					type: 'list',
					items: [
						'**When you book a call:** your name, email address, the time you choose and anything you add to the Cal.com booking form.',
						'**When you email us:** your name, email address and anything you include in your message.',
						'**When you browse:** Netlify records server logs, including IP addresses, for every visit. If you accept analytics cookies, Google Analytics also collects information such as pages viewed, approximate location, device, browser and how you found the site.',
						'**When you play a video:** YouTube or Vimeo collect data under their own privacy policies.',
					],
				},
				{
					type: 'paragraph',
					text: 'We don’t collect special category data, such as health information, and the site isn’t aimed at children.',
				},
			],
		},
		{
			id: 'how-and-why-we-use-it',
			title: 'How and why we use it',
			blocks: [
				{
					type: 'paragraph',
					text: 'We only use personal data when the law gives us a reason to. For each purpose, that reason is:',
				},
				{
					type: 'list',
					items: [
						'**Replying to enquiries and arranging calls:** our legitimate interest in responding to people who contact us, or taking steps you’ve asked for before entering into a contract.',
						'**Understanding how the site is used:** your consent, given through the cookie banner. You can withdraw it at any time.',
						'**Keeping the site secure and working:** our legitimate interest in running a safe, reliable website.',
						'**Meeting our legal obligations:** such as keeping business and tax records.',
					],
				},
				{
					type: 'paragraph',
					text: 'We don’t make automated decisions about you or build profiles, and we won’t send you marketing emails unless you ask us to.',
				},
			],
		},
		{
			id: 'who-we-share-it-with',
			title: 'Who we share it with',
			blocks: [
				{
					type: 'paragraph',
					text: 'We share personal data only with providers who help us run the site and the business, and only what they need:',
				},
				{
					type: 'list',
					items: [
						'**Netlify:** website hosting and server analytics.',
						'**Google:** Tag Manager and Analytics, only if you consent.',
						'**Cal.com:** call booking and scheduling.',
						'**Email and calendar providers:** to send, receive and schedule our communications.',
						'**Our accountant:** where business records include your details, for example on an invoice.',
					],
				},
				{
					type: 'paragraph',
					text: 'We may also share information if the law requires it, or to protect our rights. We never sell personal data.',
				},
			],
		},
		{
			id: 'international-transfers',
			title: 'International transfers',
			blocks: [
				{
					type: 'paragraph',
					text: 'Some of our providers, including Netlify, Google and Cal.com, store or process data in the United States. When data leaves the UK, we rely on UK adequacy regulations, such as the UK Extension to the EU-US Data Privacy Framework, or on the International Data Transfer Agreement and other approved safeguards.',
				},
			],
		},
		{
			id: 'how-long-we-keep-it',
			title: 'How long we keep it',
			blocks: [
				{
					type: 'list',
					items: [
						'**Enquiries and booking details:** up to two years after our last contact, unless we go on to work together.',
						'**Client and financial records:** six years after the end of the financial year they relate to, as tax law requires.',
						'**Google Analytics data:** 14 months, after which Google deletes it automatically.',
						'**Server logs:** for Netlify’s standard retention period.',
					],
				},
			],
		},
		{
			id: 'your-rights',
			title: 'Your rights',
			blocks: [
				{ type: 'paragraph', text: 'Under UK data protection law, you can:' },
				{
					type: 'list',
					items: [
						'Ask for a copy of the personal data we hold about you.',
						'Ask us to correct anything that’s wrong or incomplete.',
						'Ask us to delete your data.',
						'Ask us to restrict or stop using your data, or object to how we use it.',
						'Ask for your data in a portable format.',
						'Withdraw your consent at any time, where we rely on it.',
					],
				},
				{
					type: 'paragraph',
					text: 'To use any of these rights, email [hey@joebentaylor.co.uk](mailto:hey@joebentaylor.co.uk). We’ll respond within one month, and there’s normally no charge.',
				},
			],
		},
		{
			id: 'security',
			title: 'Security',
			blocks: [
				{
					type: 'paragraph',
					text: 'We use reputable providers, encrypted connections and two-factor authentication on the accounts that hold your data. No website can be completely secure, but if a breach affects your data, we’ll act quickly and tell you where the law requires.',
				},
			],
		},
		{
			id: 'changes-to-this-page',
			title: 'Changes to this page',
			blocks: [
				{
					type: 'paragraph',
					text: 'We may update these terms and this privacy information at any time by updating this page. The date at the top shows when it last changed, so please check back from time to time.',
				},
			],
		},
		{
			id: 'law-and-jurisdiction',
			title: 'Law and jurisdiction',
			blocks: [
				{
					type: 'paragraph',
					text: 'These terms, and any dispute arising from them or from your use of the site, are governed by the law of England and Wales. The courts of England and Wales have exclusive jurisdiction, except that if you’re a consumer living in Scotland or Northern Ireland, you may also bring proceedings in your local courts.',
				},
			],
		},
		{
			id: 'contact-and-complaints',
			title: 'Contact and complaints',
			blocks: [
				{
					type: 'paragraph',
					text: 'Questions about these terms or your data? Email [hey@joebentaylor.co.uk](mailto:hey@joebentaylor.co.uk) or write to JoeBenTaylor Ltd, 294 Askern Road, Toll Bar, Doncaster, South Yorkshire, DN5 0QN.',
				},
				{
					type: 'paragraph',
					text: 'If you’re unhappy with how we’ve handled your data, please tell us first so we can put it right. You also have the right to complain to the Information Commissioner’s Office at [ico.org.uk](https://ico.org.uk) or on [0303 123 1113](tel:+443031231113).',
				},
			],
		},
	],
};
