'use client';

// Imports
// ------------
import { ProfilePresenceContext } from '@parts/ProfileReveal/context';
import { use, useEffect, useRef } from 'react';
import type { ToolkitProps } from './interface';
import s from './styles.module.scss';

// Component
// ------------
const Toolkit = ({ items, label }: ToolkitProps) => {
	const profilePresent = use(ProfilePresenceContext);
	const container = useRef<HTMLElement>(null);
	useEffect(() => {
		const element = container.current;
		if (!element || !profilePresent) return;
		const controller = new AbortController();
		let disposed = false;
		let loading = false;
		let visible = false;
		let scene: Awaited<ReturnType<typeof import('./engine').createToolkit>> | undefined;
		const observer = new IntersectionObserver(
			([entry]) => {
				visible = entry.isIntersecting;
				scene?.setVisible(visible);
				if (!visible || loading) return;
				loading = true;
				void import('./engine')
					.then(async ({ createToolkit }) => {
						if (disposed) return;
						const next = await createToolkit(element, items, controller.signal);
						if (disposed) next.destroy();
						else {
							scene = next;
							scene.setVisible(visible);
						}
					})
					.catch(error => {
						if (!disposed) {
							element.dataset.state = 'error';
							console.error('Toolkit could not load', error);
						}
					});
			},
			{ threshold: 0.1 }
		);
		observer.observe(element);
		return () => {
			disposed = true;
			controller.abort();
			observer.disconnect();
			scene?.destroy();
			element.dataset.state = 'loading';
			for (const button of element.querySelectorAll('button')) {
				button.disabled = true;
				button.tabIndex = -1;
				button.style.removeProperty('--tool-x');
				button.style.removeProperty('--tool-y');
				button.style.removeProperty('--tool-angle');
			}
		};
	}, [items, profilePresent]);

	return (
		<section ref={container} className={s.jacket} aria-label={label} data-toolkit={label} data-state='loading'>
			{items.map(item => (
				<button
					key={item.id}
					type='button'
					tabIndex={-1}
					disabled
					aria-label={`${item.label}: drag to move, or use arrow keys. Space to toss.`}
					data-tool={item.id}
				/>
			))}
		</section>
	);
};

// Exports
// ------------
Toolkit.displayName = 'Toolkit';
export default Toolkit;
