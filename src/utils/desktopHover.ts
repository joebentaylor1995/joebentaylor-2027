import { mq } from '@tackl';

export const DESKTOP_HOVER_QUERY = `${mq.up.l} and (hover: hover) and (pointer: fine)`;
// Everything DESKTOP_HOVER_QUERY isn't: small windows, and touch screens of any size
export const TOUCH_LAYOUT_QUERY = `${mq.down.l}, (hover: none), (pointer: coarse)`;
let query: MediaQueryList | undefined;
export const canHover = () => {
	query ??= window.matchMedia(DESKTOP_HOVER_QUERY);
	return query.matches;
};
