'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { defaultMediaSettings, MEDIA_REPLAY, MEDIA_SETTINGS_CHANGED, mediaEasings, mediaSettings } from '../settings';
import s from './styles.module.scss';

const controls = [
	{ key: 'delay', label: 'Delay (seconds)', min: 0, max: 2, step: 0.05 },
	{ key: 'duration', label: 'Duration / speed (seconds)', min: 0.1, max: 2, step: 0.05 },
	{ key: 'stagger', label: 'Dual image stagger (seconds)', min: 0, max: 0.5, step: 0.05 },
	{ key: 'trigger', label: 'Trigger position (% from top)', min: 20, max: 100, step: 1 },
] as const;

export default function MediaSettings() {
	const [settings, setSettings] = useState({ ...mediaSettings });
	const update = (values: Partial<typeof mediaSettings>) => {
		Object.assign(mediaSettings, values);
		setSettings({ ...mediaSettings });
		window.dispatchEvent(new Event(MEDIA_SETTINGS_CHANGED));
	};
	return createPortal(
		<aside className={s.jacket} aria-label='Media reveal settings' data-modal-settings data-lenis-prevent>
			<details open>
				<summary>Media reveal</summary>
				{controls.map(({ key, label, min, max, step }) => (
					<label key={key}>
						<span>
							{label} <output>{settings[key]}</output>
						</span>
						<input
							aria-label={label}
							type='range'
							min={min}
							max={max}
							step={step}
							value={settings[key]}
							onChange={event => update({ [key]: Number(event.target.value) })}
						/>
					</label>
				))}
				<label>
					Easing
					<select
						aria-label='Easing'
						value={settings.easing}
						onChange={event => update({ easing: event.target.value as keyof typeof mediaEasings })}
					>
						{Object.keys(mediaEasings).map(easing => (
							<option key={easing}>{easing}</option>
						))}
					</select>
				</label>
				<p>
					100% triggers at the bottom edge; 50% at the centre. Shorter duration is faster. Changes apply to
					unrevealed tiles.
				</p>
				<div>
					<button type='button' onClick={() => window.dispatchEvent(new Event(MEDIA_REPLAY))}>
						Replay reveals
					</button>
					<button type='button' onClick={() => update(defaultMediaSettings)}>
						Reset defaults
					</button>
				</div>
			</details>
		</aside>,
		document.body
	);
}
