// Imports
// ------------
import { mq } from '@tackl';

// Constants
// ------------
export const DESKTOP_HOVER_QUERY = `${mq.up.l} and (hover: hover) and (pointer: fine)`;
// Everything DESKTOP_HOVER_QUERY isn't: small windows, and touch screens of any size
export const TOUCH_LAYOUT_QUERY = `${mq.down.l}, (hover: none), (pointer: coarse)`;
// Any mouse or trackpad attached (including an iPad with a trackpad), i.e. wheel input exists
export const WHEEL_INPUT_QUERY = '(any-hover: hover), (any-pointer: fine)';

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

// NOTE • Lenis only smooths wheel input here (syncTouch is off), yet it listens for touches on
// its scroller with non-passive listeners, so every swipe has to wait for the main thread
// before the browser may scroll — a stuck-then-jumping swipe whenever a scene is loading. On
// devices with no wheel input it gets a detached element to listen to instead; touch scrolling
// is native either way. Returns undefined (Lenis' default target) everywhere else.
export const touchOnlyEventsTarget = () =>
	typeof window !== 'undefined' && !window.matchMedia(WHEEL_INPUT_QUERY).matches
		? document.createElement('div')
		: undefined;
