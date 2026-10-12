// Saved prototype defaults (shared with the optional settings panel)
// ------------
export const defaultSettings = {
	intensity: 1,
	horizontal: 1,
	vertical: 0.65,
	lift: 1.15,
	smooth: 0.82,
	rotation: 0,
	positionX: 0,
	positionY: 0,
	zoom: 1,
	chroma: 0.65,
	glow: 0.65,
	chromaOn: true,
	glowOn: true,
	drag: 1.35,
	push: 1.1,
	trails: 0.5,
	focus: 0.3,
	wire: 1.2,
	dragOn: true,
	pushOn: true,
	trailsOn: true,
	focusOn: true,
	wireOn: false,
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
export const scrollKeys = ['drag', 'push', 'trails', 'focus', 'wire'] as const;
export const portraitUrl = '/images/hero-depth/portrait.png';
export const depthUrl = '/images/hero-depth/depth.png';
