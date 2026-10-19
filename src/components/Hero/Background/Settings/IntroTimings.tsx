import type { IntroSettings } from '../scene-intro';
import s from './styles.module.scss';

const ranges = [
	['headingStart', 'Heading start', 0, 6, 0.05],
	['headingCoverDuration', 'Heading cover duration', 0.05, 3, 0.05],
	['headingRevealDuration', 'Heading reveal duration', 0.05, 3, 0.05],
	['starStart', 'Star start', 0, 6, 0.05],
	['starDuration', 'Star rotation duration', 0.05, 3, 0.05],
	['paragraphStart', 'Paragraph start', 0, 6, 0.05],
	['wordDuration', 'Word reveal duration', 0.05, 3, 0.05],
	['wordStagger', 'Word stagger', 0, 0.3, 0.005],
	['copyrightFade', 'Copyright fade duration', 0.05, 3, 0.05],
	['copyrightLineDuration', 'Copyright line growth duration', 0.05, 3, 0.05],
	['copyrightDigitStagger', 'Copyright digit stagger', 0, 0.3, 0.005],
] as const;

export default function IntroTimings({
	intro,
	onChange,
	onReplay,
}: {
	intro: IntroSettings;
	onChange: (settings: IntroSettings) => void;
	onReplay: () => void;
}) {
	return (
		<details className={s.group}>
			<summary>Heading & paragraph timing</summary>
			<p>
				All values are seconds. Start times share the intro timeline; the desktop ripple starts at{' '}
				{intro.start.toFixed(2)}s. Replay to preview changes.
			</p>
			<p>Copyright starts with the heading at {intro.headingStart.toFixed(2)}s.</p>
			{ranges.map(([key, label, min, max, step]) => (
				<label key={key} className={s.control}>
					<span>{label}</span>
					<input
						type='number'
						aria-label={`${label} value`}
						min={min}
						max={max}
						step={step}
						value={intro[key]}
						onChange={event => {
							const value = event.target.valueAsNumber;
							if (Number.isFinite(value))
								onChange({ ...intro, [key]: Math.min(max, Math.max(min, value)) });
						}}
					/>
					<input
						type='range'
						aria-label={label}
						min={min}
						max={max}
						step={step}
						value={intro[key]}
						onChange={event => onChange({ ...intro, [key]: Number(event.target.value) })}
					/>
				</label>
			))}
			<button type='button' onClick={onReplay}>
				Replay text timing
			</button>
		</details>
	);
}
