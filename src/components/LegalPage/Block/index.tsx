// Imports + Styles
// ------------
import type * as I from '../interface';
import RichText from '../RichText';
import s from './styles.module.scss';

// Component
// ------------
const Block = ({ block }: { block: I.LegalBlock }) => {
	// Render
	switch (block.type) {
		case 'paragraph':
			return (
				<p className={s.paragraph} data-type='bodyM'>
					<RichText text={block.text} />
				</p>
			);

		case 'note':
			return (
				<p className={s.note} data-type='bodyS'>
					<RichText text={block.text} />
				</p>
			);

		case 'list':
			return (
				<ul className={s.list}>
					{block.items.map(item => (
						<li key={item} data-type='bodyM'>
							<RichText text={item} />
						</li>
					))}
				</ul>
			);

		case 'table':
			return (
				<table className={s.table} data-type='bodyS'>
					<thead>
						<tr>
							<th scope='col'>Cookie</th>
							<th scope='col'>Provider</th>
							<th scope='col'>Purpose</th>
							<th scope='col'>Duration</th>
						</tr>
					</thead>
					<tbody>
						{block.rows.map(row => (
							<tr key={row.name}>
								<th scope='row' data-cell='name'>
									{row.name}
								</th>
								<td data-cell='provider'>{row.provider}</td>
								<td data-cell='purpose'>{row.purpose}</td>
								<td data-cell='duration'>{row.duration}</td>
							</tr>
						))}
					</tbody>
				</table>
			);

		case 'code':
			return (
				<pre className={s.code} data-type='bodyS'>
					<code>{block.code}</code>
				</pre>
			);
	}
};

// Exports
// ------------
Block.displayName = 'Block';
export default Block;
