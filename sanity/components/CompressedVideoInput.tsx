// Compressed video input
// ------------
// NOTE • Replaces the upload for video file fields: the chosen video is
// compressed in the browser (sanity/lib/compressVideo.ts) and then uploaded.
// If it can't be compressed, the original is uploaded and the reason shown.
// The current file (preview, remove) still uses Sanity's own input.

// Imports
// ------------
import { Box, Button, Card, Flex, Stack, Text } from '@sanity/ui';
import { type ChangeEvent, useRef, useState } from 'react';
import { type FileInputProps, set, useClient } from 'sanity';
import { compressVideo, MAX_WIDTH, TARGET_BITRATE } from '../lib/compressVideo';

// Constants
// ------------
const API_VERSION = '2025-06-01';
const MEGABYTE = 1024 * 1024;
const PERCENT = 100;

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
			const asset = await client.assets.upload('file', result.file, {
				filename: result.file.name,
				contentType: result.file.type || 'video/mp4',
			});
			props.onChange(set({ _type: 'file', asset: { _type: 'reference', _ref: asset._id } }));

			if (result.kind === 'compressed') {
				const saved = Math.round((1 - result.file.size / result.originalBytes) * PERCENT);
				setStatus({
					state: 'done',
					tone: 'positive',
					message: `Compressed ${formatSize(result.originalBytes)} → ${formatSize(result.file.size)} (${saved}% smaller).`,
				});
			} else {
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
							Compressed in your browser before upload: H.264 MP4, up to {MAX_WIDTH}px wide, ~
							{TARGET_BITRATE / 1_000_000} Mbps, sound removed. Keep the tab open until it finishes.
						</Text>
					</Box>
				</Stack>
			</Card>
		</Stack>
	);
};
