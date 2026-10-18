import type { ReactNode } from 'react';
import type { DepthSettings } from '../effect-settings';
import type { LiquidSettings } from '../liquid-settings';
import type { IntroSettings } from '../scene-intro';
export interface SettingsProps {
	intro: IntroSettings;
	introTarget: 'mobile' | 'desktop';
	onIntroTargetChange: (target: 'mobile' | 'desktop') => void;
	onIntroChange: (settings: IntroSettings) => void;
	onReplay: () => void;
	onSaveIntro: () => boolean;
	liquid: LiquidSettings;
	onLiquidChange: (settings: LiquidSettings) => void;
	children?: ReactNode;
	settings: DepthSettings;
	onChange: (settings: DepthSettings) => void;
	onPreview: () => void;
	exportSettings: string;
}
