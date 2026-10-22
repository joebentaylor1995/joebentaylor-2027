// Imports
// ------------
import type { CSSProperties } from 'react';

// Styles + Interfaces
// ------------
import type * as I from '../interface';
import s from './styles.module.scss';

// Component
// ------------
const Stage = ({ ref, background, isPaused, onTogglePause, children }: I.StageProps) => {
	// Derived
	const style = background ? ({ '--gallery-background': background } as CSSProperties) : undefined;

	// Render
	return (
		<div ref={ref} className={s.jacket} style={style}>
			{children}
			<button
				type='button'
				className={s.toggle}
				data-type='captionS'
				aria-label={`${isPaused ? 'Play' : 'Pause'} animation`}
				onClick={onTogglePause}
			>
				<span>{isPaused ? 'Play' : 'Pause'}</span>
			</button>
		</div>
	);
};

// Exports
// ------------
Stage.displayName = 'Stage';
export default Stage;
