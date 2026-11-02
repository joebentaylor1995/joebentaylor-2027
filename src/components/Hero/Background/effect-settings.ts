// Constants
// ------------
// Saved prototype defaults (shared with the optional settings panel).
// Every key here is a tunable; the panel's exported `portrait` settings have this shape.
export const defaultSettings = {
	// Scroll motion: how wheel/touch input is turned into velocity, the colour reveal and the pulse
	gestureGap: 0.35,
	fastRate: 1200,
	velocityScale: 200,
	velocitySmoothing: 0.1,
	colourThreshold: 1,
	colourTransition: 0.3,
	colourOn: true,
	pulsePeak: 0.9,
	pulseDuration: 0.55,
	pulseAttack: 0.09,
	pulseRelease: 0.22,

	// Pointer parallax: depth strength, per-axis travel, and how smoothly it follows (closer to 1 = slower)
	intensity: 0.4,
	horizontal: 2,
	vertical: 1,
	lift: 1.15,
	smooth: 0.82,

	// Desktop portrait crop. Position values are percentages of the canvas; rotation is in degrees.
	rotation: -6,
	positionX: 3,
	positionY: 3,
	zoom: 1.12,

	// Figma's 440 × 796 mobile crop; vertical offset is measured from the bottom.
	mobilePositionX: 11.48,
	mobilePositionY: 24.87,
	mobileZoom: 1.22,
	mobileRotation: 0,

	// Tablets, from the m breakpoint up to the desktop layout. Same offset rules as mobile.
	tabletPositionX: 8,
	tabletPositionY: 24,
	tabletZoom: 1.22,
	tabletRotation: 0,

	// Shader finishes
	chroma: 0.65,
	glow: 0.65,
	chromaOn: true,
	glowOn: true,

	// Scroll-driven effects (see `scrollKeys`) and their on/off switches
	drag: 1.35,
	push: 1.1,
	trails: 0.5,
	focus: 0.3,
	dragOn: true,
	pushOn: true,
	trailsOn: true,
	focusOn: true,

	// Debug: drift the parallax automatically, and show the raw depth map
	auto: false,
	depth: false,
};

// Names of the four scroll effects, in the order the shader's `scrollFX` array expects
export const scrollKeys = ['drag', 'push', 'trails', 'focus'] as const;

// Image paths served from /public
export const portraitUrl = '/images/hero-depth/portrait.png';
export const depthUrl = '/images/hero-depth/depth.webp';

// Types
// ------------
export type DepthSettings = typeof defaultSettings;

// The keys of `DepthSettings` whose value is a number (sliders) or a boolean (toggles)
export type NumericSetting = {
	[K in keyof DepthSettings]: DepthSettings[K] extends number ? K : never;
}[keyof DepthSettings];
export type BooleanSetting = {
	[K in keyof DepthSettings]: DepthSettings[K] extends boolean ? K : never;
}[keyof DepthSettings];
