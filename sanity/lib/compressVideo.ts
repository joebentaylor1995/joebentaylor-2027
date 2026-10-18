// Video compression — in the Studio, before upload
// ------------
// NOTE • Sanity stores video files exactly as uploaded, so loops are re-encoded
// in the editor's browser first (WebCodecs, via mediabunny): H.264 MP4, at most
// MAX_WIDTH wide, ~TARGET_BITRATE, audio stripped (every loop plays muted).
// mediabunny is imported on demand, so it only loads when a video is chosen.

// Constants
// ------------
// NOTE • Ribbon tiles render at 1024px wide — 1280 leaves headroom for sharp screens
export const MAX_WIDTH = 1280;
export const TARGET_BITRATE = 2_500_000;
const VIDEO_CODEC = 'avc';

// Types
// ------------
export type CompressionResult =
	| { kind: 'compressed'; file: File; originalBytes: number }
	| { kind: 'original'; file: File; reason: string };

// Helpers
// ------------
const toMp4Name = (name: string) => `${name.replace(/\.[^.]+$/, '') || 'video'}.mp4`;

// Exports
// ------------
/**
 * Re-encodes `file` for the web. Never throws: when the browser can't encode
 * H.264, the conversion fails, or the result wouldn't be smaller, it hands back
 * the original file with the reason, so the upload still goes ahead.
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
		const width = Math.min(sourceWidth, MAX_WIDTH);
		const height = Math.round((sourceHeight * width) / sourceWidth);
		if (!(await canEncodeVideo(VIDEO_CODEC, { width, height, bitrate: TARGET_BITRATE })))
			return { kind: 'original', file, reason: 'This browser can’t encode H.264 video.' };

		const target = new BufferTarget();
		const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
		const conversion = await Conversion.init({
			input,
			output,
			video: {
				// NOTE • Only ever scale down — width alone keeps the aspect ratio
				...(sourceWidth > MAX_WIDTH && { width: MAX_WIDTH }),
				codec: VIDEO_CODEC,
				quality: new Quality({ bitrate: TARGET_BITRATE, bitrateMode: 'variable' }),
				forceTranscode: true,
			},
			audio: { discard: true },
		});
		if (!conversion.isValid)
			return { kind: 'original', file, reason: 'This video format can’t be converted here.' };

		if (onProgress) conversion.onProgress = progress => onProgress(progress);
		await conversion.execute();

		if (!target.buffer) return { kind: 'original', file, reason: 'Compression produced no output.' };
		if (target.buffer.byteLength >= file.size)
			return { kind: 'original', file, reason: 'The original is already as small as a re-encode would be.' };

		return {
			kind: 'compressed',
			file: new File([target.buffer], toMp4Name(file.name), { type: 'video/mp4' }),
			originalBytes: file.size,
		};
	} catch (error: unknown) {
		console.error('Video compression failed:', error);
		return { kind: 'original', file, reason: 'Compression failed in this browser.' };
	}
};
