// Imports
// ------------
import Background from './Background';

// Styles + Interfaces
// ------------
import type * as I from './interface';
import s from './styles.module.scss';

// Component
// ------------
const Hero = ({ heading, desc }: I.HeroProps) => {
	return (
		<section className={s.jacket}>
			<div className={s.content}>
				<h1>{heading}</h1>
				<p>{desc}</p>
			</div>
			<Background />
		</section>
	);
};

// Exports
// ------------
Hero.displayName = 'Hero';
export default Hero;
