import { expect, test } from '@playwright/test';
import { pickVideoSource } from '../src/utils/pickVideoSource';

const SOURCES = [
	{ width: 1920, src: 'large' },
	{ width: 640, src: 'small' },
	{ width: 1280, src: 'medium' },
];

const setDevice = (pixelRatio: number, connection?: { saveData?: boolean; effectiveType?: string }) => {
	Object.defineProperty(globalThis, 'devicePixelRatio', { value: pixelRatio, configurable: true });
	Object.defineProperty(globalThis, 'navigator', { value: { connection }, configurable: true });
};

test.describe('pickVideoSource', () => {
	test('falls back to the only file when there are no renditions', () => {
		setDevice(2);
		expect(pickVideoSource('only', null, 400)).toBe('only');
		expect(pickVideoSource('only', [], 400)).toBe('only');
	});

	test('picks the narrowest copy that stays sharp in the tile', () => {
		setDevice(1);
		expect(pickVideoSource('only', SOURCES, 345)).toBe('small');
		expect(pickVideoSource('only', SOURCES, 1073)).toBe('medium');
		setDevice(2);
		expect(pickVideoSource('only', SOURCES, 438)).toBe('medium');
		expect(pickVideoSource('only', SOURCES, 1073)).toBe('large');
	});

	test('a phone at 3× is treated as 2×', () => {
		setDevice(3);
		expect(pickVideoSource('only', SOURCES, 345)).toBe('small');
	});

	test('uses the widest copy when none is wide enough', () => {
		setDevice(2);
		expect(pickVideoSource('only', SOURCES, 2560)).toBe('large');
	});

	test('uses the smallest copy on a slow or data-saving connection', () => {
		setDevice(2, { effectiveType: '3g' });
		expect(pickVideoSource('only', SOURCES, 1073)).toBe('small');
		setDevice(2, { saveData: true, effectiveType: '4g' });
		expect(pickVideoSource('only', SOURCES, 1073)).toBe('small');
		setDevice(2, { effectiveType: '4g' });
		expect(pickVideoSource('only', SOURCES, 1073)).toBe('large');
	});
});
