export async function resolveRoutes(baseUrl, required = ['/'], optional = []) {
	const paths = [];
	const skipped = [];
	for (const path of new Set([...required, ...optional])) {
		const url = new URL(path, baseUrl);
		if (url.origin !== new URL(baseUrl).origin) throw new Error('Audit routes must stay on the deploy origin.');
		const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
		await response.body?.cancel();
		if (response.status === 404 && optional.includes(path) && !required.includes(path)) {
			skipped.push(`${path}: skipped — HTTP 404 (optional unpublished route); no score`);
		} else if (!response.ok) {
			throw new Error(`Lighthouse preflight ${url.href}: HTTP ${response.status}`);
		} else {
			paths.push(path);
		}
	}
	return { paths, skipped };
}
