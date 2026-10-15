'use client';

// Imports
// ------------
import Image from 'next/image';

// Styles + Interfaces
// ------------
import s from './styles.module.scss';

// Component
// ------------
const CssDesignAwards = () => {
	return (
		<div className={s.cssda}>
			{/* Match the modal's 3/8 desktop column and full-width mobile card, including 5% overscan per side. */}
			<Image
				src='/images/cssda/cssda.jpeg'
				alt='CSS Design Awards'
				fill
				sizes='(min-width: 1600px) 21.94vw, (min-width: 1024px) 351px, (min-width: 971px) 998px, (min-width: 700px) calc(110vw - 70.4px), calc(110vw - 52.8px)'
			/>
		</div>
	);
};

// Exports
// ------------
CssDesignAwards.displayName = 'CssDesignAwards';
export default CssDesignAwards;
