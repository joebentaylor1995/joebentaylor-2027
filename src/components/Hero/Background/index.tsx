'use client';

// Imports
// ------------
import { cn } from '@utils/cn';

// Styles + Interfaces
// ------------
import type * as I from './interface';
import s from './styles.module.scss';

// Component
// ------------
const Background = ({ className }: I.BackgroundProps) => {
	return (
		<aside className={cn(s.background, className)}>
			{/*  */}
			{/*  */}
			{/*  */}
		</aside>
	);
};

// Exports
// ------------
Background.displayName = 'Background';
export default Background;
