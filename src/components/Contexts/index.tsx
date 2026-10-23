'use client';

// Imports
// ------------
import { PROJECTS_PATH } from '@utils/projectModal';
import type { LenisRef } from 'lenis/react';
import { createContext, useMemo, useRef, useState } from 'react';
import { type ContactDetails, fallbackContact } from '@/data/site';
// Interface
// ------------
import type * as I from './interface';
import { PerformanceProvider } from './Performance';
import { useModalRoutes } from './useModalRoutes';
import { useProjectModal } from './useProjectModal';

// Context Definition
// ------------
export const GlobalContext = createContext({
	lenisRef: { current: null } as React.RefObject<LenisRef | null>,

	menuOpen: false,
	setMenuOpen: (_value: boolean) => {},
	profileOpen: false,
	setProfileOpen: (_value: boolean) => {},
	contactOpen: false,
	setContactOpen: (_value: boolean) => {},
	// NOTE • A non-featured case study shown in the profile panel (see useProjectModal)
	projectModalOpen: false,
	closeProjectModal: () => {},
	leaveProjectModal: () => {},
	registerProjectModal: (_href: string | null) => {},
	pagePath: '/',
});

// NOTE • Contact details from Sanity's Global settings, provided once by
// app/(site)/Providers.tsx for the contact modal and profile links
export const ContactContext = createContext<ContactDetails>(fallbackContact);

// Component
// ------------
const Contexts = ({ children }: I.ContextsProps) => {
	// Refs
	const lenisRef = useRef<LenisRef | null>(null);

	// States
	const [menuOpen, setMenuOpen] = useState<boolean>(false);
	const { profileOpen, setProfileOpen, contactOpen, setContactOpen, pagePath: routePath } = useModalRoutes();
	const { projectModal, registerProjectModal, closeProjectModal, leaveProjectModal } = useProjectModal();

	// Derived
	const projectModalOpen = Boolean(projectModal && !projectModal.isClosing);
	// NOTE • The projects page stays the scene behind a project modal, so the ribbon keeps running
	const pagePath = projectModal ? PROJECTS_PATH : routePath;

	// Context Values
	const contextValue = useMemo(
		() => ({
			lenisRef,
			menuOpen,
			setMenuOpen,
			profileOpen,
			setProfileOpen,
			contactOpen,
			setContactOpen,
			projectModalOpen,
			closeProjectModal,
			leaveProjectModal,
			registerProjectModal,
			pagePath,
		}),
		[
			menuOpen,
			profileOpen,
			setProfileOpen,
			contactOpen,
			setContactOpen,
			projectModalOpen,
			closeProjectModal,
			leaveProjectModal,
			registerProjectModal,
			pagePath,
		]
	);

	return (
		<GlobalContext.Provider value={contextValue}>
			<PerformanceProvider>{children}</PerformanceProvider>
		</GlobalContext.Provider>
	);
};

// Exports
// ------------
export default Contexts;
