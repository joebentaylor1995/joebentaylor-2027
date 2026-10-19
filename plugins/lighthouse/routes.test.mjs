import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveRoutes } from './routes.mjs';

test('only explicitly optional 404 routes are skipped', async t => {
	let status = 404;
	t.mock.method(globalThis, 'fetch', async url => new Response('', {
		status: url.pathname === '/' ? 200 : status,
	}));
	const result = await resolveRoutes('https://example.com', ['/'], ['/projects/']);
	assert.deepEqual(result.paths, ['/']);
	assert.match(result.skipped[0], /HTTP 404/);
	status = 200;
	assert.deepEqual((await resolveRoutes('https://example.com', ['/'], ['/projects/'])).paths, ['/', '/projects/']);
	status = 500;
	await assert.rejects(resolveRoutes('https://example.com', ['/'], ['/projects/']), /HTTP 500/);
	status = 404;
	await assert.rejects(resolveRoutes('https://example.com', ['/projects/'], ['/projects/']), /HTTP 404/);
	await assert.rejects(resolveRoutes('https://example.com', ['https://other.example/']), /origin/);
});
