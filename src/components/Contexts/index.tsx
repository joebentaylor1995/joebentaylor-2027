'use client';

// Imports
// ------------
import type { LenisRef } from 'lenis/react';
import { createContext, useMemo, useRef, useState } from 'react';
import { type ContactDetails, fallbackContact } from '@/data/site';
// Interface
// ------------
import type * as I from './interface';
import { PerformanceProvider } from './Performance';
import { useModalRoutes } from './useModalRoutes';

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
	const { profileOpen, setProfileOpen, contactOpen, setContactOpen, pagePath } = useModalRoutes();

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
			pagePath,
		}),
		[menuOpen, profileOpen, setProfileOpen, contactOpen, setContactOpen, pagePath]
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
