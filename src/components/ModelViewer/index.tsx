'use client';

// Imports
// ------------
import Image from 'next/image';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import type { ModelViewer as Viewer } from './engine';

// Styles + Interfaces
// ------------
import type * as I from './interface';
import s from './styles.module.scss';

// Helpers
// ------------
const labelFor = (status: I.ViewerStatus, progress: number | null) => {
	if (status === 'loading') return progress === null ? 'Loading…' : `Loading ${Math.round(progress * 100)}%`;
	if (status === 'error') return 'Couldn’t load — try again';
	return 'View in 3D';
};

// Component
// ------------
const ModelViewer = ({ src, poster, alt, background, sizes }: I.ModelViewerProps) => {
	// Refs
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const viewerRef = useRef<Viewer | null>(null);
	const abortRef = useRef<AbortController | null>(null);

	// State
	const [status, setStatus] = useState<I.ViewerStatus>('idle');
	const [progress, setProgress] = useState<number | null>(null);
	const [isRotating, setIsRotating] = useState(true);

	// Derived
	const style = background ? ({ '--model-background': background } as CSSProperties) : undefined;
	const isReady = status === 'ready';

	// Handlers
	// NOTE • three.js and the model only download from here — never on page load
	const handleOpen = async () => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		abortRef.current = new AbortController();
		const isRotatingNow = matchMedia('(prefers-reduced-motion: no-preference)').matches;
		setIsRotating(isRotatingNow);
		setProgress(null);
		setStatus('loading');
		try {
			const { createModelViewer } = await import('./engine');
			viewerRef.current = await createModelViewer(canvas, src, {
				onProgress: setProgress,
				isRotating: isRotatingNow,
				signal: abortRef.current.signal,
			});
			setStatus('ready');
		} catch {
			if (!abortRef.current.signal.aborted) setStatus('error');
		}
	};

	const handleToggleRotation = () => {
		const next = !isRotating;
		viewerRef.current?.setRotating(next);
		setIsRotating(next);
	};

	// Effects
	// NOTE • A new model (or leaving the page) tears down the old scene and its GPU memory
	// biome-ignore lint/correctness/useExhaustiveDependencies: a new src resets the viewer.
	useEffect(
		() => () => {
			abortRef.current?.abort();
			viewerRef.current?.dispose();
			viewerRef.current = null;
			setStatus('idle');
		},
		[src]
	);

	// Render
	return (
		<div className={s.jacket} data-state={status} style={style}>
			<Image className={s.poster} src={poster} alt={isReady ? '' : alt} fill sizes={sizes} quality={90} />
			<canvas
				ref={canvasRef}
				className={s.canvas}
				role='img'
				aria-label={alt}
				aria-hidden={!isReady || undefined}
			/>
			{!isReady && (
				<button
					type='button'
					className={s.open}
					data-type='captionL'
					onClick={handleOpen}
					disabled={status === 'loading'}
					aria-live='polite'
				>
					<span>{labelFor(status, progress)}</span>
				</button>
			)}
			{isReady && (
				<>
					<p className={s.hint} data-type='captionS' aria-hidden='true'>
						<span>Drag to turn</span>
					</p>
					<button
						type='button'
						className={s.toggle}
						data-type='captionS'
						aria-label={`${isRotating ? 'Pause' : 'Play'} rotation`}
						onClick={handleToggleRotation}
					>
						<span>{isRotating ? 'Pause' : 'Play'}</span>
					</button>
				</>
			)}
		</div>
	);
};

// Exports
// ------------
ModelViewer.displayName = 'ModelViewer';
export default ModelViewer;
