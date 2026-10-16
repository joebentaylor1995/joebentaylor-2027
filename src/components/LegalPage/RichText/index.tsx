// Imports
// ------------
import Link from 'next/link';

// Styles + Interfaces
// ------------
import type * as I from '../interface';
import s from './styles.module.scss';

// Marks
// ------------
// NOTE • `**lead**` and `[label](href)` — see ../interface.ts. A lead can
// wrap a link (`**[/llms.txt](/llms.txt):**`), so leads render recursively.
const MARKS = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
const LINK = /^\[([^\]]+)\]\(([^)]+)\)$/;

const renderLink = (label: string, href: string, key: number) => {
	// NOTE • Files like /llms.txt aren't app routes, so they skip client navigation
	const isRoute = href.startsWith('/') && !/\.\w+$/.test(href);

	if (isRoute) {
		return (
			<Link key={key} href={href} className={s.link}>
				{label}
			</Link>
		);
	}

	const isExternal = href.startsWith('http');

	return (
		<a
			key={key}
			href={href}
			className={s.link}
			target={isExternal ? '_blank' : undefined}
			rel={isExternal ? 'noopener noreferrer' : undefined}
		>
			{label}
		</a>
	);
};

// Component
// ------------
const RichText = ({ text }: I.RichTextProps) => {
	// Render
	return text.split(MARKS).map((part, index) => {
		if (part.startsWith('**') && part.endsWith('**')) {
			return (
				// biome-ignore lint/suspicious/noArrayIndexKey: parts of a static string, never reordered
				<strong key={index} className={s.lead}>
					<RichText text={part.slice(2, -2)} />
				</strong>
			);
		}

		const link = part.match(LINK);
		if (link) return renderLink(link[1], link[2], index);

		return part;
	});
};

// Exports
// ------------
RichText.displayName = 'RichText';
export default RichText;
