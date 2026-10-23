'use client';

// Imports
// ------------
import PageTransition from '@parts/PageTransition';
// Styles + Interfaces
// ------------
import button from '@parts/ProjectOverview/styles.module.scss';
import { prepareNavigationScene, waitForNavigationScene } from '@utils/navigationScene';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { NotFoundSceneProps } from './interface';
import s from './styles.module.scss';

// Component
// ------------
export default function NotFoundScene({ standalone = false }: NotFoundSceneProps) {
	// Refs
	const canvas = useRef<HTMLCanvasElement>(null);
	// State
	const [ready, setReady] = useState(false);
	const [paused, setPaused] = useState(false);
	const controller = useRef<{ destroy: () => void; pause: (value: boolean) => void } | null>(null);
	// Effects
	useEffect(() => {
		const abort = new AbortController();
		void (async () => {
			try {
				await waitForNavigationScene(abort.signal);
				const { mountNotFoundRain } = await import('./engine');
				if (abort.signal.aborted || !canvas.current) return;
				controller.current = mountNotFoundRain(canvas.current, setReady);
			} catch {
				setReady(false);
			}
		})();
		return () => {
			abort.abort();
			controller.current?.destroy();
			controller.current = null;
		};
	}, []);
	useEffect(() => controller.current?.pause(paused), [paused]);
	// Render
	const label = (
		<>
			<span className={button.websiteFill} aria-hidden='true' />
			<span className={button.websiteInner}>
				<span className={button.websiteText}>Back to home</span>
			</span>
		</>
	);
	return (
		<PageTransition>
			<section className={s.jacket} data-not-found-scene data-ready={ready} aria-labelledby='not-found-title'>
				<h1 id='not-found-title' className={s.srOnly}>
					Page not found
				</h1>
				<div className={s.fallback} aria-hidden='true'>
					404
				</div>
				<canvas
					ref={canvas}
					className={s.canvas}
					role='img'
					aria-label='404 formed from falling blue digital rain'
				/>
				<div className={s.content}>
					<p data-type='bodyS'>The page you’re looking for doesn’t exist or has moved.</p>
					<div className={s.actions}>
						{standalone ? (
							<a href='/' className={`${button.website} ${s.home}`} data-button-050='' data-type='bodyS'>
								{label}
							</a>
						) : (
							<Link
								href='/'
								onNavigate={() => prepareNavigationScene('/')}
								className={`${button.website} ${s.home}`}
								data-button-050=''
								data-cursor-sticky
								data-cursor-fit
								data-type='bodyS'
							>
								{label}
							</Link>
						)}
					</div>
					<p className={s.caption} data-type='captionS'>
						Page got lost in the rain
					</p>
				</div>
				{ready && (
					<button
						className={s.pause}
						type='button'
						aria-pressed={paused}
						onClick={() => setPaused(value => !value)}
						data-type='captionS'
					>
						{paused ? 'Play rain' : 'Pause rain'}
					</button>
				)}
			</section>
		</PageTransition>
	);
}
