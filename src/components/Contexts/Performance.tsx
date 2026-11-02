'use client';

// Imports
// ------------
import { createContext, useEffect, useMemo, useRef, useState } from 'react';

// Context
// ------------
export const PerformanceContext = createContext({
	isReducedMotion: false,
	devicePixelRatio: 1,
});

// Component
// ------------
export const PerformanceProvider = ({ children }: { children: React.ReactNode }) => {
	// State
	const [performanceState, setPerformanceState] = useState({
		isReducedMotion: false,
		devicePixelRatio: 1,
	});

	// Refs
	// Track if component is mounted to prevent state updates after unmount
	const isMountedRef = useRef(true);
	const mediaQueryRef = useRef<MediaQueryList | null>(null);

	// Effects
	useEffect(() => {
		// Safety check for SSR
		if (typeof window === 'undefined') {
			return;
		}

		isMountedRef.current = true;

		// Initialize state
		const updatePerformanceState = () => {
			if (!isMountedRef.current) return;

			setPerformanceState({
				isReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
				devicePixelRatio: window.devicePixelRatio || 1,
			});
		};

		// Initial state update
		updatePerformanceState();

		// Listen for changes to reduced motion preference
		const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		mediaQueryRef.current = mediaQuery;

		// Modern browsers support addEventListener on MediaQueryList
		const handleChange = () => {
			if (isMountedRef.current) {
				updatePerformanceState();
			}
		};

		if (mediaQuery.addEventListener) {
			mediaQuery.addEventListener('change', handleChange);
		} else {
			// Fallback for older browsers
			mediaQuery.addListener(handleChange);
		}

		// Cleanup function to prevent memory leaks
		return () => {
			isMountedRef.current = false;

			if (mediaQueryRef.current) {
				if (mediaQueryRef.current.removeEventListener) {
					mediaQueryRef.current.removeEventListener('change', handleChange);
				} else {
					// Fallback for older browsers
					mediaQueryRef.current.removeListener(handleChange);
				}
				mediaQueryRef.current = null;
			}
		};
	}, []);

	// Derived
	const value = useMemo(() => performanceState, [performanceState]);

	// Render
	return <PerformanceContext.Provider value={value}>{children}</PerformanceContext.Provider>;
};

// Exports
// ------------
// For documentation, see `docs/Tackl/PerformanceContext.md`
