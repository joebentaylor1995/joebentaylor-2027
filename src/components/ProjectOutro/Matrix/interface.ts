// Types
// ------------
export interface MatrixProps {
	title: string;
}
// Tunables passed to the engine; the hover* values only apply while the pointer is over the footer
export interface MatrixSettings {
	// Idle rain
	speed: number;
	size: number;
	intensity: number;
	enabled: boolean;

	// Hover reaction
	hoverEnabled: boolean;
	hoverSpeed: number;
	hoverGlow: number;
	hoverSize: number;
	hoverScramble: number;
	hoverDrift: number;
	hoverPulse: number;
	hoverDuration: number;
}
