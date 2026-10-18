'use client';

import { readIntroProfiles } from '@parts/Hero/Background/intro-storage';
import { lockProjectScroll } from '@utils/lockProjectScroll';
import { gsap } from 'gsap';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useMemo, useRef, ViewTransition } from 'react';
import s from './styles.module.scss';

// Native snapshots retain canvases, video and font rendering without DOM rasterisation.
export default function NavigationWave({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const previous = useRef(pathname);
	const routeChanged = previous.current !== pathname;
	// Streaming updates can invoke onUpdate again for the same navigation.
	const navigation = useMemo(() => ({ pathname, played: false }), [pathname]);
	useEffect(() => {
		previous.current = pathname;
	}, [pathname]);
	const map = useRef<SVGFEImageElement>(null);
	const displacement = useRef<SVGFEDisplacementMapElement>(null);
	const texture = useRef('');
	const textureKey = useRef('');
	return (
		<>
			<svg className={s.jacket} aria-hidden='true' width='0' height='0'>
				<defs>
					<filter
						id='navigation-wave-lens'
						x='-25%'
						y='-25%'
						width='150%'
						height='150%'
						colorInterpolationFilters='sRGB'
					>
						<feFlood floodColor='rgb(128,128,128)' result='neutral' />
						<feImage ref={map} result='lens' preserveAspectRatio='none' />
						<feMerge result='field'>
							<feMergeNode in='neutral' />
							<feMergeNode in='lens' />
						</feMerge>
						<feDisplacementMap
							ref={displacement}
							in='SourceGraphic'
							in2='field'
							scale='0'
							xChannelSelector='R'
							yChannelSelector='G'
						/>
					</filter>
				</defs>
			</svg>
			<ViewTransition
				name='navigation-surface'
				update={{ 'project-mesh': 'none', default: 'pageWave' }}
				default='none'
				onUpdate={(instance, types) => {
					if (!routeChanged || types.includes('project-mesh')) return;
					if (navigation.played) return;
					navigation.played = true;
					if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
					const settings = readIntroProfiles().desktop;
					const width = innerWidth,
						height = innerHeight;
					const x = (width * settings.originX) / 100,
						y = height * (1 - settings.originY / 100);
					const feather = Math.max(1, height * 0.16 * settings.width * settings.softness);
					const end = Math.hypot(Math.max(x, width - x), Math.max(y, height - y)) + feather * 2;
					const duration = Math.min(2000, Math.max(450, 1000 / settings.speed));
					const ease = gsap.parseEase(settings.ease);
					const root = document.documentElement;
					root.dataset.navigationWave = 'running';
					root.dataset.navigationWaveProgress = '0';
					const releaseScroll = lockProjectScroll();
					// The reusable map is a broad radial shoulder, neutral beyond the lens.
					const key = `${settings.lensWidth}:${settings.lensFalloff}`;
					if (!texture.current || textureKey.current !== key) {
						const canvas = document.createElement('canvas');
						canvas.width = canvas.height = 256;
						const context = canvas.getContext('2d');
						if (context) {
							const pixels = context.createImageData(256, 256);
							for (let j = 0; j < 256; j++)
								for (let i = 0; i < 256; i++) {
									const dx = (i - 127.5) / 127.5,
										dy = (j - 127.5) / 127.5,
										d = Math.hypot(dx, dy);
									const shoulder = Math.exp(
										-(
											Math.abs((d - 0.65) / (0.18 * Math.max(0.1, settings.lensWidth))) **
											Math.max(1, settings.lensFalloff * 2)
										)
									);
									const p = (j * 256 + i) * 4;
									pixels.data[p] = 128 + (dx / Math.max(d, 0.001)) * shoulder * 110;
									pixels.data[p + 1] = 128 + (dy / Math.max(d, 0.001)) * shoulder * 110;
									pixels.data[p + 2] = 128;
									pixels.data[p + 3] = 255;
								}
							context.putImageData(pixels, 0, 0);
							texture.current = canvas.toDataURL();
							textureKey.current = key;
						}
					}
					map.current?.setAttribute('href', texture.current);
					const frames = Array.from({ length: 61 }, (_, i) => {
						const radius = -feather * 2 + (end + feather * 2) * ease(i / 60);
						return {
							maskImage: `radial-gradient(circle at ${x}px ${y}px, #000 ${Math.max(0, radius - feather)}px, transparent ${Math.max(0.01, radius + feather)}px)`,
						};
					});
					const animation = root.animate(frames, {
						duration,
						fill: 'both',
						pseudoElement: `::view-transition-new(${instance.name})`,
					});
					const hold = root.animate([{ opacity: 1 }, { opacity: 1 }], {
						duration,
						pseudoElement: `::view-transition-old(${instance.name})`,
					});
					let raf = 0;
					const tick = () => {
						const progress = Math.min(1, Number(animation.currentTime || 0) / duration);
						root.dataset.navigationWaveProgress = String(progress);
						const radius = Math.max(1, -feather * 2 + (end + feather * 2) * ease(progress));
						const size = radius / 0.65;
						map.current?.setAttribute('x', String(x - size));
						map.current?.setAttribute('y', String(y - size));
						map.current?.setAttribute('width', String(size * 2));
						map.current?.setAttribute('height', String(size * 2));
						displacement.current?.setAttribute(
							'scale',
							String(height * 0.09 * settings.bend * settings.strength * Math.sin(Math.PI * progress))
						);
						if (progress < 1) raf = requestAnimationFrame(tick);
					};
					tick();
					let cleaned = false;
					const cleanup = () => {
						if (cleaned) return;
						cleaned = true;
						cancelAnimationFrame(raf);
						releaseScroll();
						displacement.current?.setAttribute('scale', '0');
						delete root.dataset.navigationWave;
						delete root.dataset.navigationWaveProgress;
					};
					void animation.finished.then(cleanup, cleanup);
					return () => {
						cleanup();
						animation.cancel();
						hold.cancel();
					};
				}}
			>
				{children}
			</ViewTransition>
		</>
	);
}
