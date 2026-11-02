// Video compression — in the Studio, before upload
// ------------
// NOTE • Sanity stores video files exactly as uploaded, so loops are re-encoded
// in the editor's browser first (WebCodecs, via mediabunny): H.264 MP4, one file
// per rung of VIDEO_LADDER, audio stripped (every loop plays muted). The site
// then plays whichever fits the visitor (src/utils/pickVideoSource.ts).
// mediabunny is imported on demand, so it only loads when a video is chosen.

// Constants
// ------------
// NOTE • 640 covers phones, 1280 most tiles, 1920 a full-width tile on a sharp screen
export const VIDEO_LADDER = [
	{ width: 640, bitrate: 800_000 },
	{ width: 1280, bitrate: 2_500_000 },
	{ width: 1920, bitrate: 5_000_000 },
] as const;
const MAX_WIDTH = VIDEO_LADDER[VIDEO_LADDER.length - 1].width;
// NOTE • Busy 60fps footage overshoots its bitrate by double whatever the mode,
// and halving the frames is what brings it back
const MAX_FRAME_RATE = 30;
const FRAME_RATE_SAMPLES = 120;
const VIDEO_CODEC = 'avc';
const BITS_PER_BYTE = 8;
const MIN_SAVING_RATIO = 0.8;

// Types
// ------------
export interface VideoRendition {
	width: number;
	file: File;
}

interface Rung {
	width: number;
	bitrate: number;
}

export type CompressionResult =
	| { kind: 'compressed'; renditions: VideoRendition[]; originalBytes: number }
	| { kind: 'original'; file: File; reason: string };

// Helpers
// ------------
const toMp4Name = (name: string, width: number) => `${name.replace(/\.[^.]+$/, '') || 'video'}-${width}w.mp4`;

// NOTE • H.264 can't encode an odd dimension
const toEven = (size: number) => Math.round(size / 2) * 2;

// NOTE • Never upscales: rungs wider than the source collapse into one at its
// own width, and no rung asks for more bits than the source itself holds
const toRungs = (sourceWidth: number, sourceBitrate: number): Rung[] => {
	const topWidth = Math.min(sourceWidth, MAX_WIDTH);
	const below = VIDEO_LADDER.filter(rung => rung.width < topWidth);
	const top = VIDEO_LADDER.find(rung => rung.width >= topWidth) ?? VIDEO_LADDER[VIDEO_LADDER.length - 1];
	return [...below, { ...top, width: topWidth }].map(rung => ({
		...rung,
		bitrate: Math.round(Math.min(rung.bitrate, sourceBitrate)),
	}));
};

// NOTE • Worse picture for barely fewer bytes is no bargain: a smaller copy only
// stays if it really saves against the next one up
const dropTinySavings = (renditions: VideoRendition[]) => {
	const widestFirst: VideoRendition[] = [];
	for (const rendition of [...renditions].reverse()) {
		const nextUp = widestFirst[widestFirst.length - 1];
		if (!nextUp || rendition.file.size <= nextUp.file.size * MIN_SAVING_RATIO) widestFirst.push(rendition);
	}
	return widestFirst.reverse();
};

// Exports
// ------------
/**
 * Re-encodes `file` for the web, smallest rung first. Never throws: when the
 * browser can't encode H.264 or the conversion fails, it hands back the original
 * file with the reason, so the upload still goes ahead.
 */
export const compressVideo = async (
	file: File,
	onProgress?: (progress: number) => void
): Promise<CompressionResult> => {
	if (typeof VideoEncoder === 'undefined')
		return { kind: 'original', file, reason: 'This browser can’t compress video (no WebCodecs support).' };

	try {
		const {
			ALL_FORMATS,
			BlobSource,
			BufferTarget,
			Conversion,
			Input,
			Mp4OutputFormat,
			Output,
			Quality,
			canEncodeVideo,
		} = await import('mediabunny');

		const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
		const track = await input.getPrimaryVideoTrack();
		if (!track) return { kind: 'original', file, reason: 'No video track found in this file.' };

		const sourceWidth = await track.getDisplayWidth();
		const sourceHeight = await track.getDisplayHeight();
		const sourceBitrate = (file.size * BITS_PER_BYTE) / (await input.computeDuration());
		const rungs = toRungs(sourceWidth, sourceBitrate);
		// NOTE • Only ever drop frames — asking a 24fps source for 30 would invent some
		const { averagePacketRate } = await track.computePacketStats(FRAME_RATE_SAMPLES);
		const isOverFrameRate = averagePacketRate > MAX_FRAME_RATE + 1;

		for (const { width, bitrate } of rungs) {
			const height = toEven((sourceHeight * width) / sourceWidth);
			if (!(await canEncodeVideo(VIDEO_CODEC, { width: toEven(width), height, bitrate })))
				return { kind: 'original', file, reason: 'This browser can’t encode H.264 video.' };
		}

		// NOTE • fastStart keeps the index at the front, so playback can begin
		// without a second request to the end of the file
		const convert = async (rung: Rung, shouldTranscode: boolean, onRungProgress?: (progress: number) => void) => {
			const target = new BufferTarget();
			const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
			const conversion = await Conversion.init({
				input,
				output,
				video: shouldTranscode
					? {
							// NOTE • Only ever scale down — width alone keeps the aspect ratio
							...(rung.width < sourceWidth && { width: rung.width }),
							...(isOverFrameRate && { frameRate: MAX_FRAME_RATE }),
							codec: VIDEO_CODEC,
							quality: new Quality({ bitrate: rung.bitrate, bitrateMode: 'variable' }),
							forceTranscode: true,
						}
					: { codec: VIDEO_CODEC },
				audio: { discard: true },
			});
			if (!conversion.isValid) throw new Error('This video format can’t be converted here.');

			if (onRungProgress) conversion.onProgress = onRungProgress;
			await conversion.execute();
			if (!target.buffer) throw new Error('Compression produced no output.');
			return target.buffer;
		};

		const renditions: VideoRendition[] = [];
		for (const [index, rung] of rungs.entries()) {
			const isTop = index === rungs.length - 1;
			let buffer = await convert(rung, true, progress => onProgress?.((index + progress) / rungs.length));

			// NOTE • Already tighter than a re-encode: the top rung keeps the source's
			// own frames, repackaged. A smaller rung that gains nothing is dropped.
			if (buffer.byteLength >= file.size) {
				if (!isTop) continue;
				buffer = await convert(rung, false);
			}

			renditions.push({
				width: rung.width,
				file: new File([buffer], toMp4Name(file.name, rung.width), { type: 'video/mp4' }),
			});
		}

		return { kind: 'compressed', renditions: dropTinySavings(renditions), originalBytes: file.size };
	} catch (error: unknown) {
		console.error('Video compression failed:', error);
		return { kind: 'original', file, reason: 'Compression failed in this browser.' };
	}
};
