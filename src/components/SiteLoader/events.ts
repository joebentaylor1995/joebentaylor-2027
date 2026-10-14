// Pages can prepare and reveal their own entrance without coupling the loader to a hero.
export const LOADER_PREPARE = 'site-loader:prepare';
export const LOADER_REVEAL = 'site-loader:reveal';
export interface LoaderPreparation {
	ripple: boolean;
	speed: number;
}
