// Imports
// ------------
import { mq } from '@tackl';

// Constants
// ------------
export const DESKTOP_HOVER_QUERY = `${mq.up.l} and (hover: hover) and (pointer: fine)`;
// Everything DESKTOP_HOVER_QUERY isn't: small windows, and touch screens of any size
export const TOUCH_LAYOUT_QUERY = `${mq.down.l}, (hover: none), (pointer: coarse)`;

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
