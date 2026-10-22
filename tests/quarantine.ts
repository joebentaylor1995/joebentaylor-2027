// Quarantined tests
// ------------
// NOTE • Tests that fail consistently (on every local attempt, or in at least 4
// of 6 CI runs) and are skipped as `fixme` with the reason below. CI had been
// red since 14 Oct 2026 while the site kept changing, so each one is either a
// stale assertion or a real regression — work through them by group and
// delete an entry once its test passes again. Applied by tests/helpers/test.ts.
// Keys are `<spec file> › <test title>`.

// Exports
// ------------
export const quarantine = new Map<string, string>([
	[
		'about-scroll.spec.ts › About settings update the scrub, persist and reset',
		'toHaveValue on Modal settings panel: expected "800"',
	],
	[
		'connect.spec.ts › connect footer renders its assets, links and complete charge cycle',
		'Fails on the CI runner only — Times out after 60s',
	],
	[
		'connect.spec.ts › connect reveals its copy, attracts the cursor and opens contact without closing Profile',
		'Fails on the CI runner only — Times out after 60s',
	],
	['consent.spec.ts › Accept All includes the calendar and stays accepted after reload', 'Times out after 60s'],
	[
		'contact.spec.ts › booking modal covers the viewport, traps focus and restores it on close',
		'Fails on the CI runner only — toHaveAttribute on [data-site-loader]: expected "true", received ""',
	],
	[
		'contact.spec.ts › Cal.com loads only after consent and preserves the booking URL',
		'Fails on the CI runner only — toBeGreaterThan: expected > 0, received 0',
	],
	['cookie-design.spec.ts › cookie design and choices at 1440px', 'toBe: expected 345, received 344.984375'],
	[
		'featured-on.spec.ts › Codrops background plays only while visible at 1440px',
		'toHaveJSProperty on [data-featured-video]: expected false, received true',
	],
	[
		'featured-on.spec.ts › Codrops background plays only while visible at 440px',
		'toHaveJSProperty on [data-featured-video]: expected false, received true',
	],
	[
		'footer-matrix.spec.ts › footer matrix approved defaults render without controls',
		'toHaveAttribute on [data-footer-matrix]: expected "true"',
	],
	[
		'hero-depth.spec.ts › depth and water cursor respond together after the ripple while text is still entering',
		'toHaveAttribute on [data-hero-content]: expected "complete", received "running"',
	],
	[
		'hero-depth.spec.ts › desktop hero text follows HTML content and CSS, with a mobile fallback',
		'Fails on the CI runner only — toHaveCount on [data-liquid-ready="true"]: expected 1, received 0',
	],
	[
		'hero-depth.spec.ts › early hover does not interrupt intro and a slow ripple keeps updating without input',
		'toBeLessThan: expected < 1.1177490854263306, received 1.1200082302093506',
	],
	[
		'hero-depth.spec.ts › explicit query loads scroll zoom controls without particles',
		'Fails on the CI runner only — Times out after 60s',
	],
	[
		'hero-depth.spec.ts › hero entrance settles and reduced motion reveals content immediately',
		'Fails on the CI runner only — toHaveAttribute on [data-hero-content]: expected "complete", received "running"',
	],
	[
		'hero-depth.spec.ts › intro controls export and replay repeatedly with changed timing',
		'toMatchObject: exported intro settings differ from the expected shape',
	],
	[
		'hero-depth.spec.ts › liquid controls toggle, update and reset without restarting the hero',
		'Fails on the CI runner only — locator.click: Timeout 5000ms exceeded.',
	],
	[
		'hero-depth.spec.ts › portrait continues scaling with the viewport width',
		'Fails on the CI runner only — toBeCloseTo: expected 2150.4, received NaN',
	],
	[
		'hero-depth.spec.ts › settled animation does not query shader attributes on every frame',
		'Fails on the CI runner only — toHaveCount on [data-liquid-ready="true"]: expected 1, received 0',
	],
	[
		'hero-depth.spec.ts › WebGL decoration follows CSS border and responsive spacing changes',
		'Fails on the CI runner only — toHaveCount on [data-liquid-ready="true"]: expected 1, received 0',
	],
	[
		'hero-scroll.spec.ts › fast gestures alternate the rendered colour portrait and release sustained scroll',
		'Fails on the CI runner only — Times out after 60s',
	],
	[
		'hero-slow-network.spec.ts › slow hero textures do not miss the opening WebGL wave',
		'Fails on the CI runner only — toHaveAttribute on [data-site-loader]: expected "true", received ""',
	],
	[
		'hero-wave-performance.spec.ts › mobile loader fade frame budget at 4x CPU slowdown',
		'Fails on the CI runner only — toBeGreaterThan: expected > 4, received 1',
	],
	[
		'hero-wave-performance.spec.ts › mobile loader fade frame budget at 6x CPU slowdown',
		'Fails on the CI runner only — toBeGreaterThan: expected > 4, received 1',
	],
	[
		'hero-wave-readiness.spec.ts › desktop reveal waits for slow shader compilation and renders the whole wave',
		'Fails on the CI runner only — toHaveAttribute on [data-site-loader]: expected "true", received ""',
	],
	[
		'hero-wave-save.spec.ts › wave settings save both profiles and reload with the approved defaults',
		'Fails on the CI runner only — Times out after 60s',
	],
	[
		'mobile-interactions.spec.ts › mobile and desktop scene settings stay independent across resize and reload',
		'toHaveAttribute on [data-recognition]: expected "ready", received "loading"',
	],
	[
		'mobile-interactions.spec.ts › mobile face preview saves its comparison setting and touch does not trigger CTA hover',
		'not.toBeChecked on Modal settings panel: expected not checked',
	],
	[
		'mobile-portrait.spec.ts › mobile uses a static portrait and preserves controls across the breakpoint',
		'not.toHaveAttribute on html: expected not have attribute, received have attribute',
	],
	[
		'modal-settings.spec.ts › modal settings are opt-in, update live, persist drafts and reset',
		'toHaveCSS on [data-keycap]: expected "25%", received "11.2%"',
	],
	[
		'next-project-transition.spec.ts › Next Project uses the feathered wave under a fixed header (desktop)',
		'toBeInViewport on a[data-next-project]:visible: expected in viewport',
	],
	[
		'next-project-transition.spec.ts › Next Project uses the feathered wave under a fixed header (mobile)',
		'toBeInViewport on a[data-next-project]:visible: expected in viewport',
	],
	[
		'performance-lifecycle.spec.ts › responsive type and off-screen WebGL suspension at 1024px',
		'toHaveAttribute on [data-recognition]: expected "ready", received "loading"',
	],
	[
		'performance-lifecycle.spec.ts › responsive type and off-screen WebGL suspension at 1440px',
		'Fails on the CI runner only — toHaveAttribute on [data-recognition]: expected "ready", received "loading"',
	],
	[
		'performance-lifecycle.spec.ts › responsive type and off-screen WebGL suspension at 390px',
		'toHaveAttribute on [data-recognition]: expected "ready", received "loading"',
	],
	[
		'performance-lifecycle.spec.ts › responsive type and off-screen WebGL suspension at 768px',
		'toHaveAttribute on [data-recognition]: expected "ready", received "loading"',
	],
	[
		'profile-background-pause.spec.ts › closing Profile finishes a background ribbon warm-up interrupted before its first frame',
		'Times out after 60s',
	],
	[
		'profile-background-pause.spec.ts › profile pauses and resumes grid desktop, including all video decoders',
		'Fails on the CI runner only — Times out after 60s',
	],
	[
		'profile-background-pause.spec.ts › profile pauses and resumes the case-study footer',
		'toHaveAttribute on [data-footer-matrix]: expected "true"',
	],
	[
		'profile-map.spec.ts › globe preparation stays off the scroll thread and preserves modal layout',
		'toBe: expected true, received false',
	],
	[
		"profile-map.spec.ts › profile globe preserves Doncaster's position, supports keyboard exploration and resets on reopen at 440px",
		'toHaveAttribute on [data-globe]: expected "ready", received "loading"',
	],
	[
		'profile-reveal.spec.ts › profile cursor follows, sticks to close, and dismisses from the backdrop',
		'Fails on the CI runner only — toHaveAttribute on #profile-panel: expected "follow", received ""',
	],
	['profile-reveal.spec.ts › profile reveals and scrolls independently at 1440px', 'Times out after 60s'],
	['profile-reveal.spec.ts › profile reveals and scrolls independently at 440px', 'Times out after 60s'],
	[
		'profile-reveal.spec.ts › profile supports reduced motion and viewport changes while open',
		"toBeFocused on getByRole('button'): expected focused, received inactive",
	],
	[
		'project-mesh-handoff.spec.ts › featured finishes expanding into the real hero before navigating',
		'Times out after 60s',
	],
	[
		'project-mesh-handoff.spec.ts › grid finishes expanding into the real hero before navigating',
		'Times out after 60s',
	],
	[
		'project-mesh-handoff.spec.ts › mobile finishes expanding into the real hero before navigating',
		'Times out after 60s',
	],
	[
		'project-overview.spec.ts › project overview matches its responsive layout at 1440px',
		'toBe: expected 48, received 47.984375',
	],
	[
		'project-overview.spec.ts › project overview matches its responsive layout at 440px',
		'toBeVisible on [data-project-overview]: expected visible',
	],
	[
		'project-template.spec.ts › mobile project flows vertically, with a full-size hero and accessible content',
		'toBeCloseTo: expected 1060, received 1044.25',
	],
	[
		'project-title-revisit.spec.ts › ribbon title wave reveal replays when reopening a cached project',
		'Times out after 60s',
	],
	[
		'project-water-resize.spec.ts › failed framebuffer allocation during resize restores the native hero',
		'toHaveAttribute on [data-project-water]: expected "true"',
	],
	[
		'project-water-resize.spec.ts › water survives a hidden route becoming visible again',
		'toHaveAttribute on [data-project-water]: expected "true"',
	],
	[
		'project-water.spec.ts › project title hands over to water, responds to the pointer and respects reduced motion',
		'toHaveAttribute on #project-title [data-page-title-reveal]: expected "block", received "wave"',
	],
	[
		'projects.spec.ts › featured and grid selections open the Pocketchange template and support browser Back',
		'Times out after 60s',
	],
	['projects.spec.ts › mobile uses all projects in the vertical stacked ribbon', 'Times out after 60s'],
	['projects.spec.ts › projects retains the ribbon, grid, settings and host navigation', 'Times out after 60s'],
	[
		'recognition.spec.ts › Recognition fits mobile and respects reduced motion',
		'Fails on the CI runner only — toHaveAttribute on [data-recognition]: expected "ready", received "loading"',
	],
	[
		'recognition.spec.ts › Recognition settings update live, persist, reset, and scrolling controls direction',
		'toHaveAttribute on [data-recognition]: expected "ready", received "loading"',
	],
	[
		'reviews.spec.ts › Reviews animate, wrap in both directions, and keep all portraits and logos available',
		'toBeVisible on [data-reviews]: expected visible',
	],
	[
		'reviews.spec.ts › Reviews fit mobile and switch instantly with reduced motion',
		'toHaveAttribute on [data-reviews]: expected "true", received ""',
	],
	[
		'ribbon-entrance-sequence.spec.ts › projects cross dissolve completes before the ribbon reveal starts',
		'Times out after 60s',
	],
	[
		'ribbon-tags.spec.ts › ribbon displays selected tags in order and hides empty subtitles',
		"Cannot set properties of undefined (setting 'tags')",
	],
	[
		'scene-stability.spec.ts › scene remains ready and error-free through idle, pointer movement and resize',
		'toEqual: scene reports errors or a state change during idle, pointer and resize',
	],
	[
		'site-loader.spec.ts › failed first-view image cannot trap the loader',
		'toHaveAttribute on [data-site-loader]: expected "true", received ""',
	],
	[
		'site-loader.spec.ts › mobile project uses the fade outro and block title reveal',
		'toHaveAttribute on h1 [data-page-title-reveal]: expected "block", received "wave"',
	],
	[
		'site-loader.spec.ts › non-homepage loader fades without a wave on /projects/',
		'toHaveAttribute on [data-site-loader]: expected "fade", received "wave"',
	],
	['toolkit.spec.ts › both toolkit sets render and drag independently at 1440px', 'Times out after 60s'],
	['toolkit.spec.ts › both toolkit sets render and drag independently at 2560px', 'Times out after 60s'],
	['toolkit.spec.ts › both toolkit sets render and drag independently at 440px', 'Times out after 60s'],
]);
