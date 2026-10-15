'use client';

import { GlobalContext } from '@parts/Contexts';
import { use, useEffect, useState, useSyncExternalStore } from 'react';
import { defaults, getSettings, type NumberSetting, ranges, STORAGE_KEY, subscribe, updateSettings } from './store';
import s from './styles.module.scss';

const fields: { title: string; controls: [NumberSetting, string, string][] }[] = [
	{
		title: 'Keycap placement',
		controls: [
			['keycapX', 'Horizontal position', '%'],
			['keycapY', 'Vertical position', '%'],
			['keycapSize', 'Size', '%'],
			['keycapRotation', 'Rotation', '°'],
		],
	},
	{
		title: 'Globe',
		controls: [
			['globeZoom', 'Zoom', '×'],
			['globeLatitude', 'Latitude / tilt', '°'],
			['globeLongitude', 'Longitude / rotation', '°'],
			['globeX', 'Horizontal offset', '%'],
			['globeY', 'Vertical offset', '%'],
			['globeIntro', 'Opening duration', 's'],
			['globeFade', 'Fade duration', 's'],
			['globeDotSize', 'Dot size', 'px at 1600px'],
			['globePulseDuration', 'Pulse duration', 's'],
			['globePulseScale', 'Pulse size', '×'],
		],
	},
];

export default function ModalSettingsPanel() {
	const { setProfileOpen } = use(GlobalContext);
	const values = useSyncExternalStore(subscribe, getSettings, () => defaults);
	const [message, setMessage] = useState('Changes save in this browser for settings mode.');
	useEffect(() => {
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) updateSettings(JSON.parse(saved));
		} catch {
			/* Storage may be unavailable or contain an older draft. */
		}
		setProfileOpen(true);
		return subscribe(() => {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(getSettings()));
			} catch {
				setMessage('Preview updated. Browser storage is unavailable.');
			}
		});
	}, [setProfileOpen]);
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(JSON.stringify(values, null, 2));
			setMessage('Settings copied. Paste them here to make them the defaults.');
		} catch {
			setMessage('Clipboard unavailable. Your settings remain saved in this browser.');
		}
	};
	return (
		<aside className={s.jacket} data-modal-settings data-lenis-prevent aria-label='Modal settings'>
			<details open>
				<summary>Modal settings</summary>
				<p>Live preview · settings mode only</p>
				{fields.map(group => (
					<fieldset key={group.title}>
						<legend>{group.title}</legend>
						<button
							type='button'
							onClick={() => {
								setProfileOpen(true);
								document
									.querySelector(group.title === 'Globe' ? '[data-globe]' : '[data-keycap]')
									?.scrollIntoView({ block: 'center' });
							}}
						>
							Show {group.title === 'Globe' ? 'globe' : 'keycap'}
						</button>
						{group.controls.map(([key, label, unit]) => (
							<div className={s.control} key={key}>
								<label htmlFor={`modal-${key}`}>
									{label} <span>{unit}</span>
								</label>
								<input
									id={`modal-${key}`}
									type='number'
									min={ranges[key][0]}
									max={ranges[key][1]}
									step={ranges[key][2]}
									value={Number(values[key].toFixed(4))}
									onChange={event => {
										if (event.target.value !== '')
											updateSettings({ [key]: event.target.valueAsNumber });
									}}
								/>
								<input
									aria-label={`${group.title}: ${label} slider`}
									type='range'
									min={ranges[key][0]}
									max={ranges[key][1]}
									step={ranges[key][2]}
									value={values[key]}
									onChange={event => updateSettings({ [key]: event.target.valueAsNumber })}
								/>
							</div>
						))}
						{(group.title === 'Globe'
							? [
									['globeFollow', 'Mouse movement'],
									['globePulse', 'Dot pulse'],
								]
							: [
									['keycapTilt', 'Mouse tilt'],
									['keycapSound', 'Click sound'],
								]
						).map(([key, label]) => (
							<label className={s.toggle} key={key}>
								<input
									type='checkbox'
									checked={Boolean(values[key as keyof typeof values])}
									onChange={event => updateSettings({ [key]: event.target.checked })}
								/>
								{label}
							</label>
						))}
					</fieldset>
				))}
				<div className={s.actions}>
					<button type='button' onClick={() => window.dispatchEvent(new Event('modal-settings-replay'))}>
						Replay globe
					</button>
					<button type='button' onClick={() => updateSettings(defaults)}>
						Reset defaults
					</button>
					<button type='button' onClick={copy}>
						Copy settings
					</button>
				</div>
				<p role='status'>{message}</p>
			</details>
		</aside>
	);
}
