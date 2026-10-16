'use client';

// Imports
// ------------
import { grid } from '@theme/grid';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEffect, useState } from 'react';

// Styles
// ------------
import s from './styles.module.scss';

// Component
// ------------
export default function GlobalSettings() {
	const [scale, setScale] = useState(100);

	useEffect(() => {
		document.documentElement.style.setProperty('--tablet-font-scale', `${scale}%`);
		const refresh = window.setTimeout(() => {
			window.dispatchEvent(new Event('resize'));
			ScrollTrigger.refresh();
		}, 150);
		return () => {
			window.clearTimeout(refresh);
			document.documentElement.style.removeProperty('--tablet-font-scale');
		};
	}, [scale]);

	return (
		<aside className={s.jacket} aria-label='Global settings' data-type='captionL' data-lenis-prevent>
			<details open>
				<summary>Global settings</summary>
				<p>
					Tablet sizing · {grid.breakpoints.m}–{Number.parseInt(grid.breakpoints.l, 10) - 1}px
				</p>
				<label className={s.control}>
					<span>
						Tablet font scale <output>{scale}%</output>
					</span>
					<input
						aria-label='Tablet font scale'
						type='range'
						min='62.5'
						max='125'
						step='2.5'
						value={scale}
						onChange={event => setScale(Number(event.target.value))}
					/>
				</label>
				<p>Live preview only. Mobile and desktop keep their normal sizing. Reload to restore 100%.</p>
				<button type='button' onClick={() => setScale(100)}>
					Reset to 100%
				</button>
			</details>
		</aside>
	);
}
