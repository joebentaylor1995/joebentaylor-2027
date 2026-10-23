export const sceneIntros = new WeakMap<
	HTMLElement,
	{ portrait: number; marqueeBoost: number; waterReveal: number; colour: number }
>();

export const introEasings = {
	'power1.inOut': 'Balanced — gentle acceleration and settle',
	'power4.inOut': 'Extreme — slow edges, fast centre',
	'expo.inOut': 'Exponential — dramatic centre surge',
	'circ.inOut': 'Circular — sharp centre acceleration',
	'sine.out': 'Sine out — gradual settling',
	'sine.in': 'Sine in — accelerating finish',
	'power2.in': 'Accelerate — slow launch, fast finish',
	'power4.out': 'Strong settle — rapid launch',
	'power2.inOut': 'Cinematic — slow / fast / slow',
	'power3.inOut': 'Dramatic — stronger acceleration',
	'sine.inOut': 'Silky — gentle acceleration',
	'power2.out': 'Soft settle — smooth deceleration',
	'power3.out': 'Impact — fast launch, soft landing',
	'expo.out': 'Surge — explosive launch',
	none: 'Constant — steady travel',
} as const;
export interface IntroSettings {
	start: number;
	originX: number;
	originY: number;
	softness: number;
	lensWidth: number;
	lensFalloff: number;
	lensChroma: number;
	lensShadow: number;
	bend: number;
	reflection: number;
	caustic: number;
	rings: number;
	frequency: number;
	decay: number;
	strength: number;
	width: number;
	speed: number;
	ease: keyof typeof introEasings;
	portraitScale: number;
	portraitFinish: number;
	portraitEase: keyof typeof introEasings;
	headingStart: number;
	headingCoverDuration: number;
	headingRevealDuration: number;
	starStart: number;
	starDuration: number;
	paragraphStart: number;
	wordDuration: number;
	wordStagger: number;
	copyrightFade: number;
	copyrightLineDuration: number;
	copyrightDigitStagger: number;
}
export const introDefaults: IntroSettings = {
	start: 0.1,
	originX: 50,
	originY: 50,
	softness: 1,
	lensWidth: 1,
	lensFalloff: 1,
	lensChroma: 1,
	lensShadow: 4.35,
	bend: 2.75,
	reflection: 1,
	caustic: 1,
	rings: 0,
	frequency: 3.5,
	decay: 4.6,
	strength: 1,
	width: 1,
	speed: 0.8,
	ease: 'sine.out',
	portraitScale: 2.58,
	portraitFinish: 100,
	portraitEase: 'power2.inOut',
	headingStart: 0.85,
	headingCoverDuration: 0.4,
	headingRevealDuration: 0.5,
	starStart: 2.02,
	starDuration: 0.6,
	paragraphStart: 1,
	wordDuration: 0.85,
	wordStagger: 0.025,
	copyrightFade: 0.4,
	copyrightLineDuration: 0.55,
	copyrightDigitStagger: 0.07,
};
export const introSettings = new WeakMap<HTMLElement, IntroSettings>();
export const mobileIntroDefaults: IntroSettings = {
	...introDefaults,
	originY: 52,
	lensShadow: 1,
	bend: 1,
	rings: 0,
	frequency: 8,
	decay: 2,
	speed: 0.95,
	ease: 'none',
	// The loader's fade lasts 0.36s: the heading wipe picks up as it ends, the copy just after
	headingStart: 0.3,
	starStart: 0.7,
	paragraphStart: 0.5,
	portraitScale: 2.06,
	portraitFinish: 90,
};
export const introReplays = new WeakMap<HTMLElement, () => void>();
