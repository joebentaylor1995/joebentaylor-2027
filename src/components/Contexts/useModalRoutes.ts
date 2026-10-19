'use client';

import { isLoaderSettled, LOADER_SETTLED } from '@parts/SiteLoader/events';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

type Modal = 'profile' | 'contact';
const modalAt = (path: string): Modal | null =>
	/^\/profile\/?$/.test(path) ? 'profile' : /^\/contact\/?$/.test(path) ? 'contact' : null;

export function useModalRoutes() {
	const pathname = usePathname();
	const background = useRef('/');
	const initialized = useRef(false);
	const [modal, setModal] = useState<Modal | null>(null);
	const pagePath = modalAt(pathname) ? background.current : pathname;

	// biome-ignore lint/correctness/useExhaustiveDependencies: sync modal state after framework navigation as well as popstate.
	useEffect(() => {
		const sync = () => {
			const current = window.location.pathname;
			// A reload renders the home rewrite, not the previous document's scene.
			if (!initialized.current && modalAt(current)) {
				window.history.replaceState(
					{ ...window.history.state, modalEntry: false, modalBackground: '/' },
					'',
					window.location.href
				);
			}
			initialized.current = true;
			const legacy = new URLSearchParams(window.location.search).has('profile');
			if (legacy && !modalAt(current)) window.history.replaceState(window.history.state, '', '/profile/');
			const next = legacy ? 'profile' : modalAt(current);
			if (!next) background.current = current;
			else background.current = window.history.state?.modalBackground ?? '/';
			setModal(isLoaderSettled() ? next : null);
		};
		sync();
		window.addEventListener('popstate', sync);
		window.addEventListener(LOADER_SETTLED, sync);
		return () => {
			window.removeEventListener('popstate', sync);
			window.removeEventListener(LOADER_SETTLED, sync);
		};
	}, [pathname]);

	const toggle = useCallback((kind: Modal, open: boolean) => {
		if (open) {
			if (modalAt(window.location.pathname) !== kind) {
				if (!modalAt(window.location.pathname)) background.current = window.location.pathname;
				window.history.pushState({ modalEntry: true, modalBackground: background.current }, '', `/${kind}/`);
			}
			setModal(kind);
		} else {
			setModal(null);
			if (modalAt(window.location.pathname) === kind) {
				if (window.history.state?.modalEntry) window.history.back();
				else window.history.replaceState(window.history.state, '', '/');
			}
		}
	}, []);
	const setProfileOpen = useCallback((open: boolean) => toggle('profile', open), [toggle]);
	const setContactOpen = useCallback((open: boolean) => toggle('contact', open), [toggle]);
	return {
		profileOpen: modal === 'profile',
		contactOpen: modal === 'contact',
		setProfileOpen,
		setContactOpen,
		pagePath,
	};
}
