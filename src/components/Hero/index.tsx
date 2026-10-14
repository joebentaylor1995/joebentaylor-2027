// Imports
// ------------

import Copyright from '@parts/Copyright';
import Background from './Background';
import Content from './Content';

// Styles + Interfaces
// ------------
import type * as I from './interface';
import LogoMarquee from './LogoMarquee';
import s from './styles.module.scss';

// Component
// ------------
const Hero = ({ heading, desc, logos }: I.HeroProps) => {
	return (
		<section className={s.jacket}>
			<div className={s.introCover} data-scene-cover aria-hidden='true' />

			<Background />

			<Content heading={heading} description={desc} />

			<LogoMarquee logos={logos} />

			<Copyright />
		</section>
	);
};

// Exports
// ------------
Hero.displayName = 'Hero';
export default Hero;
