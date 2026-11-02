// Pick video source
// ------------
// NOTE • Loops are short, so one file per visitor beats segmented streaming: the
// narrowest copy that stays sharp in its tile, or the smallest on a slow or
// data-saving connection. Safari has no navigator.connection and goes by size.

// Types
// ------------
export interface VideoSource {
	width: number;
	src: string;
}

interface Connection {
	saveData?: boolean;
	effectiveType?: string;
}

// Constants
// ------------
// NOTE • Past 2× the extra pixels can't be seen in a moving loop
const MAX_PIXEL_RATIO = 2;
// NOTE • A copy this close to the wanted width looks the same and saves a rung
const WIDTH_TOLERANCE = 0.9;
const SLOW_CONNECTIONS = ['slow-2g', '2g', '3g'];

// Helpers
// ------------
const isConstrained = () => {
	const connection = (navigator as Navigator & { connection?: Connection }).connection;
	return Boolean(connection?.saveData) || SLOW_CONNECTIONS.includes(connection?.effectiveType ?? '');
};

// Exports
// ------------
export const pickVideoSource = (fallback: string, sources: VideoSource[] | null | undefined, displayWidth: number) => {
	if (!sources?.length) return fallback;

	const byWidth = [...sources].sort((a, b) => a.width - b.width);
	if (isConstrained()) return byWidth[0].src;

	const wanted = displayWidth * Math.min(devicePixelRatio, MAX_PIXEL_RATIO) * WIDTH_TOLERANCE;
	return (byWidth.find(source => source.width >= wanted) ?? byWidth[byWidth.length - 1]).src;
};
