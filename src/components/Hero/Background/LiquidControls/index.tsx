'use client';

// Imports
// ------------
import { liquidSettings } from '../liquid-settings';

// Styles + Interfaces
// ------------
import type { LiquidControlsProps } from './interface';
import s from './styles.module.scss';

const ranges = [
	['marqueeSpeed', 'Marquee base speed multiplier', 0, 10, 0.05],
	['marqueeScrollBoost', 'Marquee scroll acceleration', 0, 100, 0.5],
	['marqueeBlur', 'Marquee motion blur', 0, 60, 1],
	['marqueeBlurThreshold', 'Blur velocity threshold', 0, 0.95, 0.01],
	['marqueeBlurCurve', 'Blur ramp curve', 0.25, 6, 0.05],
	['resolution', 'Fluid simulation resolution', 64, 512, 64],
	['pressureIterations', 'Fluid pressure iterations', 1, 40, 1],
	['size', 'Brush size', 5, 150, 1],
	['force', 'Flow force', 0, 40, 0.5],
	['persistence', 'Trail persistence', 0, 100, 1],
	['resistance', 'Flow resistance', 0.1, 8, 0.1],
	['swirl', 'Turbulence', 0, 20, 0.1],
	['density', 'Water volume', 0, 3, 0.05],
	['intensity', 'Highlight strength', 0, 2, 0.01],
	['refraction', 'Refraction', 0, 0.2, 0.005],
	['dispersion', 'Colour separation', 0, 1, 0.01],
	['iridescence', 'Iridescence', 0, 1, 0.01],
] as const;

// Component
// ------------
export default function LiquidControls({ settings, onChange, onClose }: LiquidControlsProps) {
	return (
		<section
			id='liquid-glass-controls'
			className={s.jacket}
			aria-label='Liquid glass controls'
			onKeyDown={event => {
				if (event.key === 'Escape') {
					event.currentTarget.parentElement?.querySelector('button')?.focus();
					onClose();
				}
			}}
		>
			<h2>Liquid glass</h2>
			<p>Adjust the water and its position around the portrait. Changes last until you reload.</p>
			<label className={s.toggle}>
				<input
					type='checkbox'
					checked={settings.inFront}
					onChange={event => onChange({ ...settings, inFront: event.target.checked })}
				/>
				Show in front of portrait
			</label>
			<button type='button' onClick={() => onChange({ ...liquidSettings })}>
				Reset saved defaults
			</button>
			{[
				['Simulation quality', 5, 7],
				['Liquid flow', 7, 13],
				['Glass appearance', 13, 17],
			].map(([title, start, end]) => (
				<details key={title}>
					<summary>{title}</summary>
					{ranges.slice(Number(start), Number(end)).map(([key, label, min, max, step]) => (
						<label key={key} className={s.control}>
							<span>{label}</span>
							<input
								type='number'
								aria-label={`${label} value`}
								min={min}
								max={max}
								step={step}
								value={settings[key]}
								onChange={event => {
									const value = event.target.valueAsNumber;
									if (Number.isFinite(value))
										onChange({ ...settings, [key]: Math.min(max, Math.max(min, value)) });
								}}
							/>
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
				</details>
			))}
		</section>
	);
}
