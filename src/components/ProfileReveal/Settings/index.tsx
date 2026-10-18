'use client';

import { GlobalContext } from '@parts/Contexts';
import { use, useEffect, useState, useSyncExternalStore } from 'react';
import {
	defaults,
	getSavedSettings,
	getSettingsFor,
	getSettingsTarget,
	type ModalSettings,
	mobileDefaults,
	type NumberSetting,
	ranges,
	restoreSettings,
	type SettingsTarget,
	STORAGE_KEY,
	subscribe,
	updateSettings as updateProfileSettings,
} from './store';
import s from './styles.module.scss';

const sections: Record<string, string> = {
	Recognition: '[data-recognition]',
	About: '[data-about]',
	Globe: '[data-globe]',
	'Keycap placement': '[data-keycap]',
	Connect: '[data-connect]',
	'Design toolkit': '[data-toolkit="Design toolkit" i]',
	'Development toolkit': '[data-toolkit="Development toolkit" i]',
};

const fields: { title: string; controls: [NumberSetting, string, string][] }[] = [
	{
		title: 'Connect',
		controls: [
			['matrixPortraitSize', 'Desktop face size', '×'],
			['matrixSpeed', 'Rain speed', '×'],
			['matrixBrightness', 'Brightness', '×'],
			['matrixGlow', 'Glow', '×'],
			['matrixFace', 'Face detail', '×'],
			['matrixDepth', 'Face depth', '×'],
			['matrixBend', 'Rain bending', '×'],
		],
	},
	{ title: 'Design toolkit', controls: [['designToolkitSize', 'Tile size', '%']] },
	{ title: 'Development toolkit', controls: [['developmentToolkitSize', 'Tile size', '%']] },
	{
		title: 'Recognition',
		controls: [
			['awardSize', 'Award size', '%'],
			['awardZoom', 'Spiral camera zoom', '×'],
			['awardSpeed', 'Spiral speed', '×'],
			['awardDragEasing', 'Drag smoothing', 's · higher is softer'],
			['awardScrollBoost', 'Scroll acceleration', '×'],
			['awardHoverIntensity', 'Hover intensity', '×'],
			['awardFocusDuration', 'Move to centre duration', 's · lower is faster'],
		],
	},
	{
		title: 'About',
		controls: [
			['aboutScrollDistance', 'Scroll distance', 'svh'],
			['aboutStartZoom', 'Starting image zoom', '%'],
			['aboutFinalOpacity', 'Final image opacity', '%'],
			['aboutIntroParallax', 'Intro Y parallax', '%'],
			['aboutExitParallax', 'Exit Y parallax', '%'],
			['aboutPreviousZoom', 'Previous image extra zoom', '%'],
		],
	},
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
	const [target, setTarget] = useState<SettingsTarget>('desktop');
	const values = useSyncExternalStore(
		subscribe,
		() => getSettingsFor(target),
		() => defaults
	);
	const updateSettings = (values: Partial<ModalSettings>) => updateProfileSettings(values, target);
	const [message, setMessage] = useState('Changes save in this browser for settings mode.');
	useEffect(() => {
		setTarget(getSettingsTarget());
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) restoreSettings(JSON.parse(saved));
			// Apply the approved mobile preset once, preserving saved desktop settings.
			const mobilePresetKey = 'jbt-mobile-preset-2026-10-16';
			if (!localStorage.getItem(mobilePresetKey)) {
				updateProfileSettings(mobileDefaults, 'mobile');
				localStorage.setItem(STORAGE_KEY, JSON.stringify(getSavedSettings()));
				localStorage.setItem(mobilePresetKey, '1');
			}
		} catch {
			/* Storage may be unavailable or contain an older draft. */
		}
		setProfileOpen(true);
		return subscribe(() => {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(getSavedSettings()));
			} catch {
				setMessage('Preview updated. Browser storage is unavailable.');
			}
		});
	}, [setProfileOpen]);
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(JSON.stringify(getSavedSettings(), null, 2));
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
				<label>
					Editing settings for{' '}
					<select
						aria-label='Settings device'
						value={target}
						onChange={event => setTarget(event.target.value as SettingsTarget)}
					>
						<option value='mobile'>Mobile</option>
						<option value='desktop'>Desktop</option>
					</select>
				</label>
				<p>
					{target === 'mobile'
						? 'Mobile settings apply below 1024px. Desktop stays unchanged.'
						: 'Desktop settings apply from 1024px. Mobile stays unchanged.'}
				</p>
				{target === 'mobile' && (
					<fieldset>
						<legend>Connect · mobile face</legend>
						<button
							type='button'
							onClick={() =>
								document.querySelector('[data-connect]')?.scrollIntoView({ block: 'center' })
							}
						>
							Show Connect
						</button>
						<label className={s.toggle}>
							<input
								type='checkbox'
								checked={values.mobileFaceSmall}
								onChange={event => updateSettings({ mobileFaceSmall: event.target.checked })}
							/>
							Smaller mobile face
						</label>
						<div className={s.control}>
							<label htmlFor='modal-mobileFaceSize'>
								Mobile face size{' '}
								<span>{Math.round((values.mobileFaceSize / 1.45) * 100)}% of original</span>
							</label>
							<input
								id='modal-mobileFaceSize'
								type='range'
								min={ranges.mobileFaceSize[0]}
								max={ranges.mobileFaceSize[1]}
								step={ranges.mobileFaceSize[2]}
								value={values.mobileFaceSize}
								disabled={!values.mobileFaceSmall}
								onChange={event => updateSettings({ mobileFaceSize: event.target.valueAsNumber })}
							/>
						</div>
						<p>Mobile only. Turn off to compare with the original size.</p>
					</fieldset>
				)}
				{fields.map(group => (
					<fieldset key={group.title}>
						<legend>{group.title}</legend>
						<button
							type='button'
							onClick={() => {
								setProfileOpen(true);
								document
									.querySelector(sections[group.title])
									?.scrollIntoView({ block: group.title === 'About' ? 'start' : 'center' });
							}}
						>
							Show{' '}
							{group.title === 'Globe'
								? 'globe'
								: group.title === 'Keycap placement'
									? 'keycap'
									: group.title === 'Connect'
										? 'rain'
										: group.title}
						</button>
						{group.controls
							.filter(([key]) => !(target === 'mobile' && key === 'matrixPortraitSize'))
							.map(([key, label, unit]) => (
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
						{(!['Globe', 'Keycap placement'].includes(group.title)
							? []
							: group.title === 'Globe'
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
					<button
						type='button'
						onClick={() => updateSettings(target === 'mobile' ? mobileDefaults : defaults)}
					>
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
