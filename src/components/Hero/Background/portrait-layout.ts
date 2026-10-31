// Imports
// ------------
import type { DepthSettings } from './effect-settings';

// Constants
// ------------
// Width / height of the portrait image
export const PORTRAIT_ASPECT = 4046 / 2799;

// Helpers
// ------------
// The rotated bottom edge determines how far tall layouts lower the portrait.
// Share this framing between the native image and its WebGL replacement.
export function portraitBottomSpan(settings: Pick<DepthSettings, 'zoom' | 'rotation'>, aspect = PORTRAIT_ASPECT) {
	const angle = Math.abs((settings.rotation * Math.PI) / 180);
	return settings.zoom * (Math.cos(angle) / aspect - Math.sin(angle));
}
