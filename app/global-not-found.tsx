import Favicons from '@parts/Favicons';
import NotFoundScene from '@parts/NotFoundScene';
import { ppNeueMontreal, sequel } from '@theme/fonts';
import type { Metadata } from 'next';
import '@css/tokens.css';
import '@css/global.scss';

export const metadata: Metadata = { title: 'Page not found — Joe Ben Taylor' };

// Last-resort document for errors outside the website route tree. Ordinary
// unmatched URLs use the site catch-all and retain client-side transitions.
export default function GlobalNotFound() {
	return (
		<html lang='en' className={`${ppNeueMontreal.variable} ${sequel.variable}`}>
			<head>
				<Favicons />
			</head>
			<body>
				<NotFoundScene standalone />
			</body>
		</html>
	);
}
