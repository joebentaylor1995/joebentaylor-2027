// Imports
// ------------
import type { LegalSlug } from '../interface';

// Exports
// ------------
export { cookies } from './cookies';
export { llms } from './llms';
export { termsPrivacy } from './termsPrivacy';

// NOTE • Order and labels of the "Legal" page switcher
export const LEGAL_PAGES: { slug: LegalSlug; label: string }[] = [
	{ slug: 'cookies', label: 'Cookie Policy' },
	{ slug: 'terms-privacy', label: 'Terms & Privacy' },
	{ slug: 'llms', label: 'AI & LLMs' },
];
