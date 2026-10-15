// Imports
// ------------
import Image from 'next/image';

// Styles + Interfaces
// ------------
import type * as I from './interface';
import s from './styles.module.scss';

// Component
// ------------
const LogoMarquee = ({ logos }: I.LogoMarqueeProps) => {
	const items = (hidden: boolean) =>
		logos.map(({ name, image, width, height }) => (
			<li key={name} className={s.logo}>
				<Image
					src={image}
					alt={hidden ? '' : name}
					width={width}
					height={height}
					style={{ '--logo-ratio': width / height }}
				/>
			</li>
		));

	return (
		<section className={s.marquee} data-logo-marquee>
			<h2 data-type='captionL'>
				<span className={s.desktopLabel}>Trusted by</span>
				<span className={s.mobileLabel}>Clients include</span>
			</h2>

			<ul className={s.track} data-logo-track>
				{items(false)}
			</ul>
			<ul className={s.track} aria-hidden='true'>
				{items(true)}
			</ul>
		</section>
	);
};

// Exports
// ------------
LogoMarquee.displayName = 'LogoMarquee';
export default LogoMarquee;
