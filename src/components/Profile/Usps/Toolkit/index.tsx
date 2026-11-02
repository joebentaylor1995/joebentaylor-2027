'use client';

// Imports
// ------------
import { ProfilePresenceContext } from '@parts/ProfileReveal/context';
import { prepareScene } from '@utils/prepareScene';
import { use, useEffect, useRef } from 'react';

// Styles + Interfaces
// ------------
import type { ToolkitProps } from './interface';
import s from './styles.module.scss';

// Component
// ------------
// Draggable tool tiles dropped into a physics box. The buttons are the accessible, focusable layer;
// the lazy-loaded engine draws the artwork and moves the buttons to match the physics bodies.
const Toolkit = ({ items, label }: ToolkitProps) => {
	// Context
	const profilePresent = use(ProfilePresenceContext);

	// Refs
	const container = useRef<HTMLElement>(null);

	// Effects
	useEffect(() => {
		const element = container.current;
		if (!element || !profilePresent) return;

		const controller = new AbortController();
		let disposed = false;
		let visible = false;
		let scene: Awaited<ReturnType<typeof import('./engine').createToolkit>> | undefined;

		// createToolkit is async (it loads artwork), so check for disposal again before keeping the scene
		const stopPreparing = prepareScene(element, () =>
			import('./engine')
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
				})
		);

		const observer = new IntersectionObserver(
			([entry]) => {
				visible = entry.isIntersecting;
				scene?.setVisible(visible);
			},
			{ threshold: 0.1 }
		);
		observer.observe(element);

		// Disable the buttons again and clear the positions the engine wrote
		return () => {
			disposed = true;
			controller.abort();
			stopPreparing();
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

	// Render
	// NOTE • Buttons start disabled and out of the tab order until the engine is ready
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
