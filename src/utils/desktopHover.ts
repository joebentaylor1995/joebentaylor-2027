import { mq } from '@tackl';

export const DESKTOP_HOVER_QUERY = `${mq.up.l} and (hover: hover) and (pointer: fine)`;
let query: MediaQueryList | undefined;
export const canHover = () => {
	query ??= window.matchMedia(DESKTOP_HOVER_QUERY);
	return query.matches;
};
