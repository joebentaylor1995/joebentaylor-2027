// Gallery images input
// ------------
// NOTE • Wraps an animated gallery's image grid with bulk adding: upload many
// files at once, or tick several images already in the library. Sanity's own
// grid stays underneath, so drag-to-reorder, hotspots, alt text and dropping
// files straight onto the grid all work as before. Alt text is copied from the
// asset when it has some (the Media tab stores it there).

// Imports
// ------------
import { Box, Button, Card, Dialog, Flex, Grid, Spinner, Stack, Text, TextInput } from '@sanity/ui';
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { type ArrayOfObjectsInputProps, insert, setIfMissing, useClient } from 'sanity';
import { MAX_GALLERY_IMAGES } from '../lib/galleryLimits';

// Constants
// ------------
const API_VERSION = '2025-06-01';
const LIBRARY_LIMIT = 200;
const LIBRARY_QUERY = `*[_type == "sanity.imageAsset"] | order(_createdAt desc)[0...${LIBRARY_LIMIT}]{
	_id, url, originalFilename, altText
}`;
const THUMBNAIL = '?w=240&h=240&fit=crop&auto=format';
const KEY_LENGTH = 12;

// Types
// ------------
type Asset = { _id: string; url: string; originalFilename?: string | null; altText?: string | null };
type Status =
	| { state: 'idle' }
	| { state: 'uploading'; done: number; total: number }
	| { state: 'error'; message: string };

// Helpers
// ------------
const newKey = () => crypto.randomUUID().replace(/-/g, '').slice(0, KEY_LENGTH);

const toItem = (asset: Pick<Asset, '_id' | 'altText'>) => ({
	_type: 'image',
	_key: newKey(),
	asset: { _type: 'reference', _ref: asset._id },
	...(asset.altText ? { alt: asset.altText } : {}),
});

// Component
// ------------
// NOTE • Built per limit, so galleries with different image caps share one input
export const createGalleryImagesInput = (maxImages: number) => {
	// biome-ignore lint/correctness/noComponentHookFactories: called once per schema at module load, so the component is stable
	const Input = (props: ArrayOfObjectsInputProps) => <GalleryImagesInputBody {...props} maxImages={maxImages} />;
	Input.displayName = 'GalleryImagesInput';
	return Input;
};

const GalleryImagesInputBody = ({ maxImages, ...props }: ArrayOfObjectsInputProps & { maxImages: number }) => {
	// Context
	const client = useClient({ apiVersion: API_VERSION });

	// Refs
	const fileInputRef = useRef<HTMLInputElement>(null);

	// State
	const [status, setStatus] = useState<Status>({ state: 'idle' });
	const [isLibraryOpen, setIsLibraryOpen] = useState(false);
	const [library, setLibrary] = useState<Asset[] | null>(null);
	const [selected, setSelected] = useState<string[]>([]);
	const [search, setSearch] = useState('');

	// Derived
	const { readOnly, onChange } = props;
	const count = props.value?.length ?? 0;
	const remaining = Math.max(0, maxImages - count);
	const isUploading = status.state === 'uploading';
	const isFull = remaining === 0;
	const visibleLibrary = useMemo(() => {
		const term = search.trim().toLowerCase();
		return (library ?? []).filter(asset => !term || asset.originalFilename?.toLowerCase().includes(term));
	}, [library, search]);

	// Effects
	useEffect(() => {
		if (!isLibraryOpen || library) return;
		client.fetch<Asset[]>(LIBRARY_QUERY).then(setLibrary, () => setLibrary([]));
	}, [client, isLibraryOpen, library]);

	// Handlers
	const append = (assets: Pick<Asset, '_id' | 'altText'>[]) =>
		onChange([setIfMissing([]), insert(assets.map(toItem), 'after', [-1])]);

	const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(event.currentTarget.files ?? []).slice(0, remaining);
		event.currentTarget.value = '';
		if (!files.length) return;

		setStatus({ state: 'uploading', done: 0, total: files.length });
		try {
			// NOTE • One at a time, in the order picked, so the grid keeps that order
			for (const [index, file] of files.entries()) {
				const asset = await client.assets.upload('image', file, { filename: file.name });
				append([asset]);
				setStatus({ state: 'uploading', done: index + 1, total: files.length });
			}
			setStatus({ state: 'idle' });
		} catch (error) {
			setStatus({ state: 'error', message: error instanceof Error ? error.message : 'Upload failed' });
		}
	};

	const toggle = (id: string) =>
		setSelected(current =>
			current.includes(id)
				? current.filter(item => item !== id)
				: current.length < remaining
					? [...current, id]
					: current
		);

	const closeLibrary = () => {
		setIsLibraryOpen(false);
		setSelected([]);
		setSearch('');
	};

	const addSelected = () => {
		const byId = new Map((library ?? []).map(asset => [asset._id, asset]));
		append(selected.flatMap(id => byId.get(id) ?? []));
		closeLibrary();
	};

	// Render
	return (
		<Stack gap={3}>
			{props.renderDefault(props)}

			{!readOnly && (
				<Flex gap={2} wrap='wrap' align='center'>
					<Button
						text={isUploading ? `Uploading ${status.done + 1} of ${status.total}…` : 'Upload images'}
						mode='ghost'
						icon={isUploading ? Spinner : undefined}
						disabled={isFull || isUploading}
						onClick={() => fileInputRef.current?.click()}
					/>
					<Button
						text='Choose from library'
						mode='ghost'
						disabled={isFull || isUploading}
						onClick={() => setIsLibraryOpen(true)}
					/>
					<Text size={1} muted>
						{isFull
							? `All ${maxImages} slots are full.`
							: `Pick several at once — up to ${remaining} more. You can also drop files onto the grid.`}
					</Text>
					<input ref={fileInputRef} type='file' accept='image/*' multiple hidden onChange={handleFiles} />
				</Flex>
			)}

			{status.state === 'error' && (
				<Card padding={3} radius={2} tone='critical'>
					<Text size={1}>{status.message}</Text>
				</Card>
			)}

			{isLibraryOpen && (
				<Dialog
					id={`${props.id}-library`}
					header={`Choose images (${selected.length} of up to ${remaining})`}
					width={2}
					onClose={closeLibrary}
					footer={
						<Flex padding={3} gap={2} justify='flex-end'>
							<Button text='Cancel' mode='bleed' onClick={closeLibrary} />
							<Button
								text={`Add ${selected.length || ''} image${selected.length === 1 ? '' : 's'}`}
								tone='primary'
								disabled={!selected.length}
								onClick={addSelected}
							/>
						</Flex>
					}
				>
					<Stack padding={4} gap={4}>
						<TextInput
							placeholder='Search by file name'
							value={search}
							onChange={event => setSearch(event.currentTarget.value)}
						/>
						{library === null ? (
							<Flex justify='center' padding={5}>
								<Spinner muted />
							</Flex>
						) : visibleLibrary.length === 0 ? (
							<Text muted>No images found.</Text>
						) : (
							<Grid gridTemplateColumns={[3, 4, 5]} gap={2}>
								{visibleLibrary.map(asset => {
									const order = selected.indexOf(asset._id);
									const isSelected = order >= 0;
									return (
										<Card
											key={asset._id}
											as='button'
											type='button'
											radius={2}
											padding={1}
											tone={isSelected ? 'primary' : 'default'}
											border
											title={asset.originalFilename ?? undefined}
											aria-pressed={isSelected}
											onClick={() => toggle(asset._id)}
											style={{ position: 'relative', cursor: 'pointer' }}
										>
											{/* biome-ignore lint/performance/noImgElement: a Studio-only picker thumbnail — Sanity's CDN already sizes it */}
											<img
												src={`${asset.url}${THUMBNAIL}`}
												alt=''
												loading='lazy'
												style={{
													display: 'block',
													width: '100%',
													aspectRatio: '1',
													objectFit: 'cover',
													borderRadius: 3,
												}}
											/>
											{/* NOTE • The number is the order they'll be added in */}
											{isSelected && (
												<Box style={{ position: 'absolute', top: 6, right: 6 }}>
													<Card
														radius={6}
														paddingX={2}
														paddingY={1}
														tone='primary'
														shadow={1}
													>
														<Text size={1} weight='semibold'>
															{order + 1}
														</Text>
													</Card>
												</Box>
											)}
										</Card>
									);
								})}
							</Grid>
						)}
					</Stack>
				</Dialog>
			)}
		</Stack>
	);
};

// NOTE • The animated galleries' input (6–9 images)
export const GalleryImagesInput = createGalleryImagesInput(MAX_GALLERY_IMAGES);
