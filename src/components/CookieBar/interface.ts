// Imports
// ------------
import type { OPTIONAL_CATEGORIES } from './consent';

// Exports
// ------------
export type OptionalCategory = (typeof OPTIONAL_CATEGORIES)[number];
export type ConsentCategory = 'necessary' | OptionalCategory;

// NOTE • One flag per optional category — "necessary" is always granted
export type Consent = Record<OptionalCategory, boolean>;

// NOTE • What is stored in localStorage; `version` and `at` decide whether it is still valid
export type ConsentRecord = {
	version: number;
	at: string;
	consent: Consent;
};

export interface CookieBarProps {
	title?: string;
	message?: string;
	privacyHref?: string;
	className?: string;
}
