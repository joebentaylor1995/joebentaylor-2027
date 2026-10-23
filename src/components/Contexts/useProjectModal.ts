'use client';

import { clearProjectModalEntry, isProjectModalEntry, PROJECTS_PATH } from '@utils/projectModal';
import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';

// NOTE • A non-featured case study renders into the layout's @modal slot, which
// registers itself here while it's mounted. Closing plays the panel's exit
// first and only then leaves the route, so the content never vanishes mid-slide.
type ProjectModal = { href: string; isClosing: boolean };

export function useProjectModal() {
	const router = useRouter();
	const [projectModal, setProjectModal] = useState<ProjectModal | null>(null);
	// NOTE • Whether this modal was opened from the projects page (Back) or visited directly (replace)
	const fromSite = useRef(false);
	// NOTE • Set only by closeProjectModal, so the profile closing — or Back, which
	// has already left the route — never triggers a second navigation
	const isLeaving = useRef(false);

	const registerProjectModal = useCallback((href: string | null) => {
		if (href) fromSite.current = isProjectModalEntry(href);
		else isLeaving.current = false;
		setProjectModal(href ? { href, isClosing: false } : null);
	}, []);

	const closeProjectModal = useCallback(() => {
		isLeaving.current = true;
		setProjectModal(current => current && { ...current, isClosing: true });
	}, []);

	// NOTE • Called by ProfileReveal once the panel has finished sliding away
	const leaveProjectModal = useCallback(() => {
		if (!isLeaving.current) return;
		isLeaving.current = false;
		clearProjectModalEntry();
		if (fromSite.current) router.back();
		else router.replace(PROJECTS_PATH, { transitionTypes: ['project-modal'] });
	}, [router]);

	return { projectModal, registerProjectModal, closeProjectModal, leaveProjectModal };
}
