/**
 * CookieBar Stories
 * ================
 * The cookie consent manager. Clear the `tackl-cookie-consent` localStorage
 * key to see it again after making a choice.
 *
 * @component CookieBar
 */

// Imports
// ------------
import type { Meta, StoryObj } from '@storybook/nextjs';
import CookieBar from './';

// Story config
// ------------
const meta: Meta<typeof CookieBar> = {
	title: 'Components/CookieBar',
	component: CookieBar,
	parameters: {
		layout: 'fullscreen',
	},
	argTypes: {
		title: { control: 'text' },
		message: { control: 'text' },
		privacyHref: { control: 'text' },
		className: { control: 'text' },
	},
};

// Exports
// ------------
export default meta;
type Story = StoryObj<typeof CookieBar>;

export const Default: Story = {};

export const CustomText: Story = {
	args: {
		title: 'Cookies?',
		message: 'We only set analytics and marketing cookies if you say so.',
		privacyHref: '/legal/cookies/',
	},
};
