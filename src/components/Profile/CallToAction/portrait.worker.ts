// Keep the face's flood fill and luminance conversion off the scroll thread.
self.onmessage = (event: MessageEvent<ImageData>) => {
	const pixels = event.data;
	const { width, height, data } = pixels;
	const background = new Uint8Array(width * height);
	const queue = new Int32Array(background.length);
	let head = 0;
	let tail = 0;
	const enqueue = (p: number) => {
		if (background[p]) return;
		const i = p * 4;
		if (Math.min(data[i], data[i + 1], data[i + 2]) < 232 && data[i + 3] > 0) return;
		background[p] = 1;
		queue[tail++] = p;
	};
	for (let x = 0; x < width; x++) {
		enqueue(x);
		enqueue((height - 1) * width + x);
	}
	for (let y = 0; y < height; y++) {
		enqueue(y * width);
		enqueue(y * width + width - 1);
	}
	while (head < tail) {
		const p = queue[head++];
		const x = p % width;
		if (x > 0) enqueue(p - 1);
		if (x < width - 1) enqueue(p + 1);
		if (p >= width) enqueue(p - width);
		if (p < background.length - width) enqueue(p + width);
	}
	for (let i = 0; i < data.length; i += 4) {
		const value = background[i / 4]
			? 0
			: ((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) * data[i + 3]) / 255;
		data[i] = data[i + 1] = data[i + 2] = value;
		data[i + 3] = 255;
	}
	self.postMessage(pixels, { transfer: [data.buffer] });
};

export {};
