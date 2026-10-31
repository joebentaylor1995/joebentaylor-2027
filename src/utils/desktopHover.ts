// Imports
// ------------
import { mq } from '@tackl';

// Constants
// ------------
export const DESKTOP_HOVER_QUERY = `${mq.up.l} and (hover: hover) and (pointer: fine)`;

// State
// ------------
// Created on first use, then reused
let query: MediaQueryList | undefined;

// Exports
// ------------
export const canHover = () => {
	query ??= window.matchMedia(DESKTOP_HOVER_QUERY);
	return query.matches;
};
