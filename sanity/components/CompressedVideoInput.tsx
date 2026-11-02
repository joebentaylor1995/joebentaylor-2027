// Compressed video input
// ------------
// NOTE • Replaces the upload for video file fields: the chosen video is
// compressed in the browser into several widths (sanity/lib/compressVideo.ts)
// and each is uploaded. The field's asset is the widest; the rest go in renditions.
// If it can't be compressed, the original is uploaded and the reason shown.
// The current file (preview, remove) still uses Sanity's own input.

// Imports
// ------------
import { Box, Button, Card, Flex, Stack, Text } from '@sanity/ui';
import { type ChangeEvent, useRef, useState } from 'react';
import { type FileInputProps, set, useClient } from 'sanity';
import { compressVideo, VIDEO_LADDER } from '../lib/compressVideo';

// Constants
// ------------
const API_VERSION = '2025-06-01';
const MEGABYTE = 1024 * 1024;
const PERCENT = 100;
const LADDER_WIDTHS = VIDEO_LADDER.map(rung => rung.width).join(', ');

// Types
// ------------
type Status =
	| { state: 'idle' }
	| { state: 'compressing'; progress: number }
	| { state: 'uploading' }
	| { state: 'done'; message: string; tone: 'positive' | 'caution' }
	| { state: 'error'; message: string };

// Helpers
// ------------
const formatSize = (bytes: number) => `${(bytes / MEGABYTE).toFixed(1)} MB`;

// Component
// ------------
export const CompressedVideoInput = (props: FileInputProps) => {
	// Context
	const client = useClient({ apiVersion: API_VERSION });

	// Refs
	const fileRef = useRef<HTMLInputElement>(null);

	// State
	const [status, setStatus] = useState<Status>({ state: 'idle' });

	// Derived
	const isBusy = status.state === 'compressing' || status.state === 'uploading';
	const hasFile = Boolean(props.value?.asset);

	// Handlers
	const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = '';
		if (!file) return;

		setStatus({ state: 'compressing', progress: 0 });
		const result = await compressVideo(file, progress =>
			setStatus({ state: 'compressing', progress: Math.round(progress * PERCENT) })
		);

		setStatus({ state: 'uploading' });
		try {
			const upload = (file: File) =>
				client.assets.upload('file', file, { filename: file.name, contentType: file.type || 'video/mp4' });

			if (result.kind === 'compressed') {
				const assets = await Promise.all(result.renditions.map(({ file }) => upload(file)));
				const toFile = (id: string) => ({ _type: 'file', asset: { _type: 'reference', _ref: id } });
				props.onChange(
					set({
						...toFile(assets[assets.length - 1]._id),
						renditions: result.renditions.map(({ width }, index) => ({
							_key: `w${width}`,
							_type: 'videoRendition',
							width,
							file: toFile(assets[index]._id),
						})),
					})
				);

				const sizes = result.renditions
					.map(({ width, file }) => `${width}px ${formatSize(file.size)}`)
					.join(', ');
				setStatus({
					state: 'done',
					tone: 'positive',
					message: `Compressed ${formatSize(result.originalBytes)} into ${sizes}.`,
				});
			} else {
				const asset = await upload(result.file);
				props.onChange(set({ _type: 'file', asset: { _type: 'reference', _ref: asset._id } }));
				setStatus({
					state: 'done',
					tone: 'caution',
					message: `${result.reason} Uploaded the original (${formatSize(result.file.size)}).`,
				});
			}
		} catch (error: unknown) {
			console.error('Video upload failed:', error);
			setStatus({ state: 'error', message: 'Upload failed — check your connection and try again.' });
		}
	};

	// Render
	return (
		<Stack gap={3}>
			{hasFile && props.renderDefault(props)}

			<Card padding={3} radius={2} border tone={status.state === 'error' ? 'critical' : 'default'}>
				<Stack gap={3}>
					<Flex align='center' gap={3} wrap='wrap'>
						<Button
							mode='ghost'
							text={hasFile ? 'Replace & compress video' : 'Upload & compress video'}
							disabled={isBusy || props.readOnly}
							loading={isBusy}
							onClick={() => fileRef.current?.click()}
						/>
						<input ref={fileRef} type='file' accept='video/*' hidden onChange={handleFile} />
						{status.state === 'compressing' && <Text size={1}>Compressing… {status.progress}%</Text>}
						{status.state === 'uploading' && <Text size={1}>Uploading…</Text>}
					</Flex>

					{(status.state === 'done' || status.state === 'error') && (
						<Card padding={2} radius={2} tone={status.state === 'error' ? 'critical' : status.tone}>
							<Text size={1}>{status.message}</Text>
						</Card>
					)}

					<Box>
						<Text size={1} muted>
							Compressed in your browser before upload: H.264 MP4 at {LADDER_WIDTHS}px wide (never larger
							than the original), sound removed. Visitors get the size that fits. Keep the tab open until
							it finishes.
						</Text>
					</Box>
				</Stack>
			</Card>
		</Stack>
	);
};
