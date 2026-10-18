'use client';

// Imports
// ------------
import { GlobalContext } from '@parts/Contexts';
import {
	type HistoryAdapter,
	type HistoryAdapterNavigate,
	type HistoryRefresh,
	VisualEditing,
} from '@sanity/visual-editing/react';
import { isProfilePath, PROFILE_PATH } from '@utils/profileRoute';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useIsPresentationTool } from 'next-sanity/hooks';
import { use, useEffect, useMemo, useRef, useState } from 'react';

// Styles
// ------------
import s from './styles.module.scss';

// Constants
// ------------
// NOTE • Gives the refetch time to land before the overlays re-measure
const REFRESH_SETTLE_MS = 1000;

// Helpers
// ------------
// NOTE • Matches next.config.js `trailingSlash`, so Presentation's URL bar and
// the site's routes agree
const withTrailingSlash = (pathname: string) => (pathname.endsWith('/') ? pathname : `${pathname}/`);

// Component
// ------------
const Overlays = () => {
	// Context
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const { profileOpen, setProfileOpen } = use(GlobalContext);
	// NOTE • null while it's still detecting, so the link never flashes in
	const isPresentationTool = useIsPresentationTool();

	// Refs
	// NOTE • Read by the history adapter, which is created once
	const profileOpenRef = useRef(profileOpen);

	// State
	// NOTE • Presentation hands over its navigate callback once connected
	const [navigate, setNavigate] = useState<HistoryAdapterNavigate>();

	// Derived
	// NOTE • Inside Presentation the Studio has its own controls; the exit link
	// is only for someone previewing drafts in a normal tab
	const isOutsidePresentation = isPresentationTool === false;
	const search = searchParams.size ? `?${searchParams.toString()}` : '';
	// NOTE • While the profile panel is open, report its own address so
	// Presentation opens the “Profile panel” document beside the preview
	const reportedUrl = profileOpen ? PROFILE_PATH : `${withTrailingSlash(pathname)}${search}`;

	// NOTE • Bridges Presentation's URL bar and the site: page URLs route as
	// normal, while PROFILE_PATH opens the panel in place rather than navigating
	const history = useMemo<HistoryAdapter>(
		() => ({
			subscribe: next => {
				setNavigate(() => next);
				return () => setNavigate(undefined);
			},
			update: update => {
				if (isProfilePath(update.url)) {
					setProfileOpen(true);
					return;
				}
				// NOTE • Back from the panel closes it rather than leaving the page
				if (update.type === 'pop' && profileOpenRef.current) {
					setProfileOpen(false);
					return;
				}
				setProfileOpen(false);
				if (update.type === 'push') router.push(update.url);
				else if (update.type === 'replace') router.replace(update.url);
				else router.back();
			},
		}),
		[router, setProfileOpen]
	);

	// Handlers
	// NOTE • Draft mode bypasses the 'use cache' layer, so a router refresh
	// re-reads the drafts — every keystroke in the Studio shows up here
	const refresh = (_payload: HistoryRefresh) => {
		router.refresh();
		return new Promise<void>(resolve => setTimeout(resolve, REFRESH_SETTLE_MS));
	};

	// Effects
	useEffect(() => {
		profileOpenRef.current = profileOpen;
	}, [profileOpen]);

	useEffect(() => {
		navigate?.({ type: 'push', url: reportedUrl });
	}, [navigate, reportedUrl]);

	// Render
	return (
		<>
			<VisualEditing portal history={history} refresh={refresh} />
			{isOutsidePresentation && (
				<a className={s.exit} data-type='captionL' href='/api/draft-mode/disable/'>
					Exit draft preview
				</a>
			)}
		</>
	);
};

// Exports
// ------------
Overlays.displayName = 'SanityPreviewOverlays';
export default Overlays;
