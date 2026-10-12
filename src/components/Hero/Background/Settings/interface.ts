import type { DepthSettings } from '../effect-settings';
export interface SettingsProps {
	settings: DepthSettings;
	onChange: (settings: DepthSettings) => void;
	onPreview: () => void;
}
