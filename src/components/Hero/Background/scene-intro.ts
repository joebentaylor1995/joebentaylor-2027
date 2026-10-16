export const sceneIntros = new WeakMap<HTMLElement, { portrait: number; marqueeBoost: number; waterReveal: number }>();

export const introEasings = {
	'power2.inOut': 'Cinematic — slow / fast / slow',
	'power3.inOut': 'Dramatic — stronger acceleration',
	'sine.inOut': 'Silky — gentle acceleration',
	'power2.out': 'Soft settle — smooth deceleration',
	'power3.out': 'Impact — fast launch, soft landing',
	'expo.out': 'Surge — explosive launch',
	none: 'Constant — steady travel',
} as const;
export interface IntroSettings {
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
	strength: 1,
	width: 1,
	speed: 0.95,
	ease: 'none',
	portraitScale: 2.58,
	portraitFinish: 100,
	portraitEase: 'power2.inOut',
	headingStart: 1.2,
	headingCoverDuration: 0.4,
	headingRevealDuration: 0.5,
	starStart: 2.02,
	starDuration: 0.6,
	paragraphStart: 2.27,
	wordDuration: 0.85,
	wordStagger: 0.025,
	copyrightFade: 0.4,
	copyrightLineDuration: 0.55,
	copyrightDigitStagger: 0.07,
};
export const introSettings = new WeakMap<HTMLElement, IntroSettings>();
export const mobileIntroDefaults: IntroSettings = { ...introDefaults, portraitScale: 2.06, portraitFinish: 90 };
export const introReplays = new WeakMap<HTMLElement, () => void>();
