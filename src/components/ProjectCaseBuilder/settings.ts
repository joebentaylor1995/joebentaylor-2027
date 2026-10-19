export const MEDIA_SETTINGS_CHANGED = 'media-reveal:settings';
export const MEDIA_REPLAY = 'media-reveal:replay';
export const mediaEasings = {
	'Cubic ease-out': 'cubic-bezier(0.215, 0.61, 0.355, 1)',
	'Quart ease-out': 'cubic-bezier(0.165, 0.84, 0.44, 1)',
	'Expo ease-out': 'cubic-bezier(0.19, 1, 0.22, 1)',
	'Sine ease-out': 'cubic-bezier(0.39, 0.575, 0.565, 1)',
	'Ease-in-out': 'ease-in-out',
	Linear: 'linear',
};
export const defaultMediaSettings = {
	delay: 0,
	duration: 0.55,
	stagger: 0,
	trigger: 100,
	easing: 'Cubic ease-out' as keyof typeof mediaEasings,
};
export const mediaSettings = { ...defaultMediaSettings };
