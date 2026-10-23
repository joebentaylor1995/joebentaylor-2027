import type { DepthSettings } from './effect-settings';

export const PORTRAIT_ASPECT = 4046 / 2799;

// The rotated bottom edge, as a fraction of the viewport width the portrait scales from.
// Share this framing between the native image and its WebGL replacement.
export function portraitBottomSpan(settings: Pick<DepthSettings, 'zoom' | 'rotation'>, aspect = PORTRAIT_ASPECT) {
	const angle = Math.abs((settings.rotation * Math.PI) / 180);
	return settings.zoom * (Math.cos(angle) / aspect - Math.sin(angle));
}

// Wide windows scale the portrait with their width; once the bottom edge would
// fall short of the viewport, tall windows keep it growing with their height.
export function portraitFitWidth(
	width: number,
	height: number,
	settings: Pick<DepthSettings, 'zoom' | 'rotation'>,
	aspect = PORTRAIT_ASPECT
) {
	return Math.max(width, height / portraitBottomSpan(settings, aspect));
}
