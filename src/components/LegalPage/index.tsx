// Imports + Styles
// ------------

import PageTitleReveal from '@parts/PageTitleReveal';
import SpecialHeading from '@parts/SpecialHeading';
import Block from './Block';
import Contents from './Contents';
import Footer from './Footer';
import type * as I from './interface';
import PageLinks from './PageLinks';
import RichText from './RichText';
import s from './styles.module.scss';

// Component
// ------------
const LegalPage = ({ document }: I.LegalPageProps) => {
	// Derived
	const { slug, title, intro, meta, sections } = document;

	// Render
	return (
		<div className={s.jacket} data-legal-page>
			<aside className={s.sidebar}>
				<div className={s.sticky}>
					<PageLinks current={slug} className={s.group} />
					<Contents sections={sections} className={s.group} />
				</div>
			</aside>

			<article className={s.main}>
				<header className={s.header}>
					<h1 className={s.title} data-type='displayL'>
						<PageTitleReveal key={slug}>
							{title[0]}
							<br />
							{title[1]}
						</PageTitleReveal>
					</h1>
				</header>

				<PageLinks current={slug} className={s.mobileLinks} />

				<div className={s.content}>
					<section className={s.section} aria-label='Overview'>
						<div className={s.label}>
							<SpecialHeading text='Overview' tag='p' />
						</div>
						<div className={s.body}>
							<p className={s.intro} data-type='bodyL'>
								{intro}
							</p>
							<dl className={s.meta} data-type='bodyM'>
								{meta.map(item => (
									<div key={item.label}>
										<dt>{item.label}</dt>
										<dd>
											<RichText text={item.value} />
										</dd>
									</div>
								))}
							</dl>
						</div>
					</section>

					{sections.map(({ id, title: sectionTitle, blocks }, index) => (
						<section key={id} id={id} className={s.section} aria-labelledby={`${id}-title`}>
							<div className={s.label}>
								<SpecialHeading text={String(index + 1).padStart(2, '0')} tag='p' />
							</div>
							<div className={s.body}>
								<h2 id={`${id}-title`} className={s.sectionTitle} data-type='titleS'>
									{sectionTitle}
								</h2>
								<div className={s.copy}>
									{blocks.map((block, blockIndex) => (
										// biome-ignore lint/suspicious/noArrayIndexKey: static copy, never reordered
										<Block key={blockIndex} block={block} />
									))}
								</div>
							</div>
						</section>
					))}
				</div>

				<Footer />
			</article>
		</div>
	);
};

// Exports
// ------------
LegalPage.displayName = 'LegalPage';
export default LegalPage;
