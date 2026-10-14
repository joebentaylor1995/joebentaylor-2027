'use client';

// Imports
// ------------
import Logo from '@parts/Logo';
import { useAnimation } from '@utils/useAnimation';
import { gsap } from 'gsap';
import { useId, useRef, useState } from 'react';
import { concepts } from './concepts';
import { LOADER_PREPARE, LOADER_REVEAL } from './events';
import s from './styles.module.scss';

// Component
// ------------
const Gallery = () => {
	const ref = useRef<HTMLDivElement>(null);
	const id = useId().replaceAll(':', '');
	const [selected, setSelected] = useState(0);
	const [replay, setReplay] = useState(0);
	const [speed, setSpeed] = useState(1);
	const [collapsed, setCollapsed] = useState(false);
	const [status, setStatus] = useState('Playing');
	const timeline = useRef<gsap.core.Timeline | null>(null);
	const concept = concepts[selected];

	useAnimation(
		({ reduced }) => {
			const root = ref.current;
			if (!root) return;
			const overlay = root.querySelector('[data-loader-overlay]');
			const veil = root.querySelector('[data-loader-veil]');
			const mark = root.querySelector('[data-loader-mark]');
			const logo = root.querySelector('[data-loader-mark] svg svg');
			const aperture = root.querySelector('[data-logo-aperture]');
			const circle = root.querySelector('[data-circle-aperture]');
			const seam = root.querySelector('[data-seam-aperture]');
			const line = root.querySelector('[data-loader-line]');
			const rings = root.querySelectorAll('[data-loader-ring]');
			const displacement = root.querySelector('feDisplacementMap');
			const w = window.innerWidth,
				h = window.innerHeight;
			const radius = Math.hypot(w, h);
			const logoWidth = Math.min(204, w * 0.38);
			setStatus(reduced ? 'Reduced motion — simple fade' : 'Playing');
			window.dispatchEvent(new CustomEvent(LOADER_PREPARE, { detail: { ripple: concept.ripple, speed } }));
			gsap.set(overlay, { autoAlpha: 1 });
			gsap.set(veil, { opacity: 1 });
			gsap.set(mark, { x: 0, y: 0, scale: 1, opacity: 0, filter: 'blur(0px)', rotation: 0 });
			gsap.set(logo, { fill: 'var(--global-white)', stroke: 'transparent', strokeWidth: 0 });
			gsap.set(aperture, { attr: { transform: `translate(${w / 2} ${h / 2}) scale(0)` } });
			gsap.set(circle, { attr: { cx: w / 2, cy: h / 2, r: 0 } });
			gsap.set(seam, { attr: { x: 0, y: h / 2, width: w, height: 0 } });
			gsap.set(line, { scaleX: 0, opacity: 0 });
			gsap.set(rings, { scale: 0, opacity: 0 });
			gsap.set(displacement, { attr: { scale: 0 } });
			const release = () => window.dispatchEvent(new Event(LOADER_REVEAL));
			const tl = gsap.timeline({ onComplete: () => setStatus('Ready to replay') });
			timeline.current = tl;
			if (reduced) {
				tl.set(mark, { opacity: 1 }).call(release, [], 0.1).to(overlay, { autoAlpha: 0, duration: 0.2 }, 0.2);
				return;
			}
			tl.timeScale(speed);
			tl.to(mark, { opacity: 1, duration: 0.3, ease: 'sine.out' }, 0);
			tl.call(release, [], 0.65);
			const openWater = (at = 0.65) => {
				tl.to(circle, { attr: { r: radius }, duration: 1.15, ease: 'power2.inOut' }, at);
				tl.to(rings[0], { scale: radius / 100, opacity: 0.3, duration: 1.2, ease: 'power2.inOut' }, at);
				tl.to(rings[0], { opacity: 0, duration: 0.4 }, at + 0.9);
			};
			switch (selected) {
				case 0:
					tl.to(mark, { scale: 1.08, duration: 0.2, ease: 'sine.inOut' }, 0.35).to(
						mark,
						{ scale: 0.94, opacity: 0, duration: 0.35 },
						0.6
					);
					openWater();
					break;
				case 1:
					tl.to(displacement, { attr: { scale: 28 }, duration: 0.35 }, 0.3)
						.to(displacement, { attr: { scale: 0 }, duration: 0.5 }, 0.65)
						.to(mark, { scaleX: 1.2, scaleY: 0.85, duration: 0.3 }, 0.35)
						.to(mark, { scaleX: 1, scaleY: 1, opacity: 0, duration: 0.5 }, 0.65);
					openWater();
					break;
				case 2:
					tl.set(
						aperture,
						{ attr: { transform: `translate(${w / 2} ${h / 2}) scale(${logoWidth / 68})` } },
						0.65
					)
						.to(mark, { opacity: 0, duration: 0.2 }, 0.65)
						.to(
							aperture,
							{
								attr: { transform: `translate(${w / 2} ${h / 2}) scale(${radius / 8})` },
								duration: 1.35,
								ease: 'power3.in',
							},
							0.9
						)
						.to(veil, { opacity: 0, duration: 0.3 }, 1.95);
					break;
				case 3:
					tl.to(
						mark,
						{ y: 35, scale: 0.8, filter: 'blur(7px)', opacity: 0, duration: 0.8, ease: 'power2.in' },
						0.35
					).to(displacement, { attr: { scale: 20 }, duration: 0.6 }, 0.35);
					openWater(0.8);
					tl.to(rings[1], { scale: radius / 100, opacity: 0.2, duration: 1.3 }, 1).to(
						rings[1],
						{ opacity: 0, duration: 0.4 },
						1.8
					);
					break;
				case 4: {
					const destination = document.querySelector('header a[href="/"] svg')?.getBoundingClientRect();
					tl.to(
						mark,
						{
							x: destination ? destination.left + destination.width / 2 - w / 2 : 32 - w / 2,
							y: destination ? destination.top + destination.height / 2 - h / 2 : 32 - h / 2,
							scale: destination ? destination.width / logoWidth : 0.33,
							duration: 0.95,
							ease: 'power3.inOut',
						},
						0.55
					)
						.to(veil, { opacity: 0, duration: 0.7 }, 0.75)
						.to(logo, { fill: 'var(--brand-c4)', duration: 0.3 }, 1.1)
						.set(mark, { opacity: 0 }, 1.5);
					break;
				}
				case 5:
					tl.to(line, { scaleX: 1, opacity: 1, duration: 0.55, ease: 'power3.inOut' }, 0.35)
						.to(mark, { scaleY: 0, opacity: 0, duration: 0.25 }, 0.65)
						.to(seam, { attr: { y: 0, height: h }, duration: 0.95, ease: 'power3.inOut' }, 0.9)
						.to(line, { opacity: 0, duration: 0.2 }, 0.9);
					break;
				case 6:
					tl.to(circle, { attr: { r: 90 }, duration: 0.45, ease: 'sine.out' }, 0.6)
						.to(circle, { attr: { r: radius }, duration: 1.1, ease: 'power2.inOut' }, 1)
						.to(mark, { opacity: 0, duration: 0.4 }, 0.95);
					break;
				case 7:
					tl.to(
						logo,
						{ fill: 'var(--brand-c4)', stroke: 'var(--global-white)', strokeWidth: 0.3, duration: 0.4 },
						0.35
					)
						.to(mark, { opacity: 0.3, filter: 'drop-shadow(1px 2px 1px black)', duration: 0.4 }, 0.35)
						.to(mark, { opacity: 0, scale: 1.04, duration: 0.55 }, 0.9);
					openWater(0.9);
					break;
				case 8:
					tl.to(mark, { scale: 1.12, duration: 0.3 }, 0.3)
						.to(
							mark,
							{ scale: 35, filter: 'blur(12px)', opacity: 0, duration: 0.8, ease: 'power3.in' },
							0.6
						)
						.to(veil, { opacity: 0, duration: 0.5 }, 0.9);
					break;
				case 9:
					openWater();
					tl.to(mark, { opacity: 0, duration: 0.5 }, 1.8);
					break;
			}
			tl.set(overlay, { autoAlpha: 0 }, Math.max(2.4, tl.duration()));
		},
		{ scope: ref, dependencies: [selected, replay, speed], revertOnUpdate: true },
		{ reduced: '(prefers-reduced-motion: reduce)' }
	);

	return (
		<div ref={ref} className={s.jacket} data-loader-concept={selected + 1}>
			<div className={s.overlay} data-loader-overlay aria-hidden='true'>
				<svg className={s.veil} data-loader-veil width='100%' height='100%' aria-hidden='true'>
					<defs>
						<filter id={`${id}-glass`} x='-50%' y='-80%' width='200%' height='260%'>
							<feTurbulence
								type='fractalNoise'
								baseFrequency='0.012 0.035'
								numOctaves='1'
								seed='3'
								result='noise'
							/>
							<feDisplacementMap
								in='SourceGraphic'
								in2='noise'
								scale='0'
								xChannelSelector='R'
								yChannelSelector='G'
							/>
						</filter>
						<mask id={`${id}-window`} maskUnits='userSpaceOnUse'>
							<rect width='100%' height='100%' fill='white' />
							<g data-logo-aperture>
								<g transform='translate(-34 -13)'>
									<Logo className={s.cutout} />
								</g>
							</g>
							<circle data-circle-aperture fill='black' />
							<rect data-seam-aperture fill='black' />
						</mask>
					</defs>
					<rect width='100%' height='100%' className={s.dark} mask={`url(#${id}-window)`} />
				</svg>
				<div className={s.centre}>
					<div data-loader-mark className={s.mark}>
						<svg className={s.filteredLogo} viewBox='0 0 68 26' aria-hidden='true'>
							<g filter={`url(#${id}-glass)`}>
								<Logo className={s.logo} />
							</g>
						</svg>
					</div>
				</div>
				<div className={s.ring} data-loader-ring />
				<div className={s.ring} data-loader-ring />
				<div className={s.line} data-loader-line />
			</div>
			<aside className={s.chooser} aria-label='Global loader concepts' data-collapsed={collapsed}>
				<button
					type='button'
					className={s.toggle}
					onClick={() => setCollapsed(!collapsed)}
					aria-expanded={!collapsed}
				>
					{String(selected + 1).padStart(2, '0')} / 10 · Global loader concepts{' '}
					<span>{collapsed ? '+' : '−'}</span>
				</button>
				{!collapsed && (
					<div className={s.controls}>
						<label>
							Concept
							<select value={selected} onChange={event => setSelected(Number(event.target.value))}>
								{concepts.map((item, index) => (
									<option key={item.name} value={index}>
										{index + 1}. {item.name}
									</option>
								))}
							</select>
						</label>
						<p>{concept.description}</p>
						<div className={s.actions}>
							<button
								type='button'
								aria-label='Previous concept'
								onClick={() => setSelected((selected + 9) % 10)}
							>
								←
							</button>
							<button type='button' onClick={() => setReplay(replay + 1)}>
								Replay concept
							</button>
							<button
								type='button'
								aria-label='Next concept'
								onClick={() => setSelected((selected + 1) % 10)}
							>
								→
							</button>
						</div>
						<label>
							Preview speed
							<select value={speed} onChange={event => setSpeed(Number(event.target.value))}>
								<option value={1}>Normal</option>
								<option value={0.5}>Half speed</option>
							</select>
						</label>
						<button type='button' onClick={() => timeline.current?.progress(1)}>
							Skip preview
						</button>
						<small role='status'>{status}. Preview only — no live default has been changed.</small>
					</div>
				)}
			</aside>
		</div>
	);
};

export default Gallery;
