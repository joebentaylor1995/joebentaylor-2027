// Imports
// ------------
import Logo from '@parts/Logo';
import Link from 'next/link';

// Styles + Interfaces
// ------------
import type * as I from './interface';
import s from './styles.module.scss';

// Component
// ------------
const Header = (_props: I.HeaderProps) => {
	return (
		<header className={s.header}>
			<nav className={s.left} aria-label='Homepage navigation'>
				<Link href='/' aria-label='Go to home page'>
					<Logo />
				</Link>

				<div>
					<em data-type='captionS'>Available for hire</em>
					<span data-type='captionS'>Based in Doncaster, UK</span>
				</div>
			</nav>

			<nav className={s.right} aria-label='Page navigation'>
				<button type='button' aria-label='Open Profile' data-type='bodyS'>
					Profile
				</button>
				<Link href='/projects' aria-label='Go to Projects page' data-type='bodyS'>
					Projects
				</Link>
				<button type='button' aria-label='Open Booking Form' data-type='bodyS'>
					Let's Talk
				</button>
			</nav>
		</header>
	);
};

// Exports
// ------------
Header.displayName = 'Header';
export default Header;
