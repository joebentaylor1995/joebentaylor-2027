'use client';

// Imports
// ------------
import '@parts/AnimationPlugins';
import Contexts, { ContactContext } from '@parts/Contexts';
import CookieBar from '@parts/CookieBar';
import dynamic from 'next/dynamic';
import { type ComponentType, useEffect, useState } from 'react';
import type { ContactDetails } from '@/data/site';

// Dev Tools
// ------------
// NOTE • Loaded lazily and only in development, so neither the overlay's JS
// nor its CSS ships in production builds
const GridExposer = process.env.NODE_ENV === 'development' ? dynamic(() => import('@parts/GridExposer')) : null;

// Component
// ------------
// NOTE • Client-side providers only — the document shell (html/body) and all
// site chrome live in app/(site)/layout.tsx, so page content stays
// server-rendered. Styles need no provider: they're static CSS.
const Providers = ({ children, contact }: { children: React.ReactNode; contact: ContactDetails }) => {
	const [Settings, setSettings] = useState<ComponentType | null>(null);
	const [LoaderTweaks, setLoaderTweaks] = useState<ComponentType | null>(null);
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		let disposed = false;
		if (params.has('globalSettings'))
			void import('@parts/GlobalSettings').then(module => {
				if (!disposed) setSettings(() => module.default);
			});
		// NOTE • ?loaderTweaks opens a live control panel for the site loader's intro
		if (params.has('loaderTweaks'))
			void import('@parts/SiteLoader/Tweaks').then(module => {
				if (!disposed) setLoaderTweaks(() => module.default);
			});
		return () => {
			disposed = true;
		};
	}, []);
	return (
		<>
			{Settings && <Settings />}
			{LoaderTweaks && <LoaderTweaks />}
			{/* GridExposer only rendered in development environment */}
			{GridExposer && <GridExposer />}

			<CookieBar />

			<ContactContext value={contact}>
				<Contexts>{children}</Contexts>
			</ContactContext>
		</>
	);
};

// Exports
// ------------
Providers.displayName = 'Providers';
export default Providers;
