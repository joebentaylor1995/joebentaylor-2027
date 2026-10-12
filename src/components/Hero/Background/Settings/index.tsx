'use client';

// Imports
// ------------
import { useState } from 'react';
import { type BooleanSetting, defaultSettings, type NumericSetting } from '../effect-settings';

// Styles + Interfaces
// ------------
import type { SettingsProps } from './interface';
import s from './styles.module.scss';

const ranges: [NumericSetting, string, number, number, number][] = [
	['intensity', 'Parallax intensity', 0, 2, 0.01],
	['horizontal', 'Horizontal movement', 0, 2, 0.01],
	['vertical', 'Vertical movement', 0, 2, 0.01],
	['lift', 'Hand depth', 0, 2, 0.01],
	['smooth', 'Smoothing', 0, 0.99, 0.01],
	['rotation', 'Rotation', -45, 45, 1],
	['positionX', 'X position', -100, 100, 1],
	['positionY', 'Y position', -100, 100, 1],
	['zoom', 'Scale', 0.3, 2.5, 0.01],
	['chroma', 'Blue edge strength', 0, 2, 0.05],
	['glow', 'Fingertip glow strength', 0, 2, 0.05],
	['drag', 'Blue scroll drag', 0, 2, 0.05],
	['push', 'Depth push', 0, 2, 0.05],
	['trails', 'Motion trails', 0, 2, 0.05],
	['focus', 'Focus pull', 0, 2, 0.05],
	['wire', 'Wireframe strength', 0, 2, 0.05],
	['particles', 'Particle dispersion', 0, 2, 0.05],
	['pulseStrength', 'Pulse strength', 0, 2, 0.05],
	['pulseSize', 'Pulse size', 0.25, 2.5, 0.05],
	['particleSize', 'Particle size', 0.5, 5, 0.05],
];
const toggles: [BooleanSetting, string][] = [
	['chromaOn', 'Blue cursor edges'],
	['glowOn', 'Fingertip glow'],
	['dragOn', 'Scroll chromatic drag'],
	['pushOn', 'Scroll depth push'],
	['trailsOn', 'Scroll motion trails'],
	['focusOn', 'Scroll focus pull'],
	['wireOn', 'Blue wireframe'],
	['particlesOn', 'Scroll particles'],
	['pulseOn', 'Click pulse'],
	['auto', 'Automatic movement'],
	['depth', 'View depth map'],
];

// Component
// ------------
export default function Settings({ settings, onChange, onPreview }: SettingsProps) {
	// State
	const [open, setOpen] = useState(true);
	// Render
	return (
		<div className={s.jacket} data-hero-settings data-lenis-prevent>
			<button
				type='button'
				onClick={() => setOpen(!open)}
				aria-expanded={open}
				aria-controls='hero-effect-controls'
			>
				{open ? 'Hide effect settings' : 'Effect settings'}
			</button>
			{open ? (
				<section id='hero-effect-controls' aria-label='Hero effect settings' className={s.panel}>
					<h2>Hero effect settings</h2>
					<p>Only loaded with ?heroSettings=1. Changes are temporary.</p>
					<button type='button' onClick={onPreview}>
						Preview downward scroll
					</button>
					<button type='button' onClick={() => onChange({ ...defaultSettings })}>
						Reset saved defaults
					</button>
					{toggles.map(([key, label]) => (
						<label key={key} className={s.toggle}>
							<input
								type='checkbox'
								checked={settings[key]}
								onChange={event => onChange({ ...settings, [key]: event.target.checked })}
							/>
							{label}
						</label>
					))}
					{ranges.map(([key, label, min, max, step]) => (
						<label key={key} className={s.control}>
							{label}
							<output>{settings[key].toFixed(2)}</output>
							<input
								type='range'
								aria-label={label}
								min={min}
								max={max}
								step={step}
								value={settings[key]}
								onChange={event => onChange({ ...settings, [key]: Number(event.target.value) })}
							/>
						</label>
					))}
				</section>
			) : null}
		</div>
	);
}
