// Content
// ------------
// NOTE • Copy strings support two inline marks, parsed by ./RichText:
// `**lead**` lifts a phrase to full white (list leads like "Analytics:"),
// `[label](href)` renders a link — emails, URLs and the other legal pages.
export type LegalBlock =
	| { type: 'paragraph'; text: string }
	| { type: 'note'; text: string }
	| { type: 'list'; items: string[] }
	| { type: 'table'; rows: LegalTableRow[] }
	| { type: 'code'; code: string };

export interface LegalTableRow {
	name: string;
	provider: string;
	purpose: string;
	duration: string;
}

export interface LegalSection {
	id: string;
	title: string;
	blocks: LegalBlock[];
}

export interface LegalMeta {
	label: string;
	value: string;
}

export interface LegalDocument {
	slug: LegalSlug;
	title: [muted: string, highlighted: string];
	intro: string;
	meta: LegalMeta[];
	sections: LegalSection[];
}

export type LegalSlug = 'cookies' | 'terms-privacy' | 'llms';

// Props
// ------------
export interface LegalPageProps {
	document: LegalDocument;
}

export interface RichTextProps {
	text: string;
}
