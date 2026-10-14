// Saved prototype defaults (shared with the optional settings panel)
// ------------
export const defaultSettings = {
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
	intensity: 0.4,
	horizontal: 2,
	vertical: 1,
	lift: 1.15,
	smooth: 0.82,
	rotation: -6,
	positionX: 3,
	positionY: 3,
	zoom: 1.12,
	maxWidth: 1440,
	chroma: 0.65,
	glow: 0.65,
	chromaOn: true,
	glowOn: true,
	drag: 1.35,
	push: 1.1,
	trails: 0.5,
	focus: 0.3,
	dragOn: true,
	pushOn: true,
	trailsOn: true,
	focusOn: true,
	auto: false,
	depth: false,
};
export type DepthSettings = typeof defaultSettings;
export type NumericSetting = {
	[K in keyof DepthSettings]: DepthSettings[K] extends number ? K : never;
}[keyof DepthSettings];
export type BooleanSetting = {
	[K in keyof DepthSettings]: DepthSettings[K] extends boolean ? K : never;
}[keyof DepthSettings];
export const scrollKeys = ['drag', 'push', 'trails', 'focus'] as const;
export const portraitUrl = '/images/hero-depth/portrait.png';
export const depthUrl = '/images/hero-depth/depth.webp';
