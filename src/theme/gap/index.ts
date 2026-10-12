// Property Documentation
// ------------

// NOTE • This file exports the gap object, the gap object is used to store all the gap values for the application.

// REVIEW — Usage: gap: var(--gap-s);

// Imports
// ------------
import { toVarRefs } from '@theme/cssVariables';

// SECTION • Raw Gap Values
// NOTE • Emitted as --gap-{key} on :root in the generated src/css/tokens.css
export const gapValues = {
	xxs: '0.2rem',
	xs: '0.4rem',
	s: '0.8rem',
	sm: '1.6rem',
	m: '2.4rem',
	l: '3.2rem',
	xl: '4rem',
	xxl: '4.8rem',
	huge: '6.4rem',
	uber: '8rem',
};

// Exports
// ------------
export const gap = toVarRefs('gap', gapValues);
