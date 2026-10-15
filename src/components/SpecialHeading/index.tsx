// Imports
// ------------

// Styles + Interfaces
// ------------
import type * as I from './interface';
import s from './styles.module.scss';

// Component
// ------------
const SpecialHeading = ({ text, tag: Tag = 'h2', isLight = false }: I.SpecialHeadingProps) => {
	const size = 11;
	const viewBox = `0 0 ${size} ${size}`;

	return (
		<Tag className={s.special} data-type='captionL' data-light={isLight}>
			<svg width={size} height={size} viewBox={viewBox} aria-hidden='true'>
				<title>Star Icon</title>
				<path d='M4.60776 0.324443C4.76998 -0.108144 5.38187 -0.108145 5.54409 0.324442L6.63248 3.22683C6.68318 3.36205 6.78987 3.46873 6.92508 3.51944L9.82747 4.60782C10.2601 4.77004 10.2601 5.38194 9.82747 5.54415L6.92508 6.63254C6.78987 6.68324 6.68318 6.78993 6.63248 6.92514L5.54409 9.82753C5.38188 10.2601 4.76998 10.2601 4.60776 9.82754L3.51938 6.92514C3.46867 6.78993 3.36198 6.68324 3.22677 6.63254L0.324382 5.54415C-0.108205 5.38194 -0.108206 4.77004 0.324381 4.60782L3.22677 3.51944C3.36198 3.46873 3.46867 3.36205 3.51938 3.22683L4.60776 0.324443Z' />
			</svg>

			<span>{text}</span>
		</Tag>
	);
};

// Exports
// ------------
SpecialHeading.displayName = 'SpecialHeading';
export default SpecialHeading;
