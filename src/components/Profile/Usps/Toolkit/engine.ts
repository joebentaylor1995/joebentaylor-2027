// Imports
// ------------
import { getSettings, subscribe } from '@parts/ProfileReveal/Settings/store';
import { yieldSceneWork } from '@utils/prepareScene';
import { gsap } from 'gsap';
import { Body, Sleeping } from 'matter-js';
import * as THREE from 'three';
import type { ToolkitItem } from './interface';
import { createPhysics, STEP } from './physics';

// Artwork
// ------------
const SIZE = 98;
const RADIUS = 16;
const RESOLUTION = 3;
const MAX_DELTA = 50;
const SETTLE_STEPS = 600;
const KEY_STEP = 20;

async function loadImage(src: string) {
	const image = new Image();
	image.src = src;
	await image.decode();
	return image;
}

async function artwork(item: ToolkitItem, signal?: AbortSignal) {
	signal?.throwIfAborted();
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = SIZE * RESOLUTION;
	const context = canvas.getContext('2d');
	if (!context) throw new Error('Canvas unavailable');
	context.scale(RESOLUTION, RESOLUTION);
	context.beginPath();
	context.roundRect(0, 0, SIZE, SIZE, RADIUS);
	context.clip();
	context.fillStyle = item.background;
	context.fillRect(0, 0, SIZE, SIZE);
	const images = await Promise.all(
		item.layers.map(async layer => ({
			layer,
			image: await loadImage(layer.src),
			mask: layer.mask ? await loadImage(layer.mask) : undefined,
		}))
	);
	for (const { layer, image, mask } of images) {
		await yieldSceneWork();
		signal?.throwIfAborted();
		const stamp = document.createElement('canvas');
		stamp.width = Math.ceil(layer.width * RESOLUTION);
		stamp.height = Math.ceil(layer.height * RESOLUTION);
		const drawing = stamp.getContext('2d');
		if (!drawing) continue;
		drawing.drawImage(image, 0, 0, stamp.width, stamp.height);
		if (mask) {
			drawing.globalCompositeOperation = 'destination-in';
			drawing.drawImage(mask, 0, 0, stamp.width, stamp.height);
		}
		context.save();
		context.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
		context.rotate(((layer.angle ?? 0) * Math.PI) / 180);
		context.drawImage(stamp, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
		context.restore();
	}
	return canvas;
}

// Scene
// ------------
export async function createToolkit(element: HTMLElement, items: readonly ToolkitItem[], signal?: AbortSignal) {
	const artworkCanvases = await Promise.all(items.map(item => artwork(item, signal)));
	signal?.throwIfAborted();
	const buttons = Array.from(element.querySelectorAll('button'));
	// Keep physics in design units; the camera and hit targets scale with rem sizing.
	const getScale = () =>
		((parseFloat(getComputedStyle(document.documentElement).fontSize) / 10) *
			(element.dataset.toolkit === 'Design toolkit'
				? getSettings().designToolkitSize
				: getSettings().developmentToolkitSize)) /
		100;
	let scale = getScale();
	let width = Math.max(SIZE + 16, element.clientWidth / scale);
	let height = Math.max(SIZE + 16, element.clientHeight / scale);
	const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
	const physics = createPhysics(
		width,
		height,
		items.map((item, index) => ({
			label: item.label,
			width: SIZE,
			height: SIZE,
			x: SIZE / 2 + 8 + ((index * 113) % Math.max(1, width - SIZE - 16)),
			y: -SIZE - index * 110,
			angle: (index % 2 ? 1 : -1) * 0.12,
		})),
		{ intro: true }
	);
	if (motion.matches) for (let i = 0; i < SETTLE_STEPS; i++) physics.step();
	const scene = new THREE.Scene();
	const camera = new THREE.OrthographicCamera(0, width, 0, height, 0.1, 100);
	camera.position.z = 10;
	let renderer: THREE.WebGLRenderer | undefined;
	let fallback: CanvasRenderingContext2D | null = null;
	let canvas: HTMLCanvasElement;
	try {
		renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
		renderer.setClearColor(0, 0);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		canvas = renderer.domElement;
	} catch {
		canvas = document.createElement('canvas');
		fallback = canvas.getContext('2d');
	}
	canvas.setAttribute('aria-hidden', 'true');
	element.prepend(canvas);
	const meshes = artworkCanvases.map(art => {
		const texture = new THREE.CanvasTexture(art);
		texture.colorSpace = THREE.SRGBColorSpace;
		texture.flipY = false;
		const mesh = new THREE.Mesh(
			new THREE.PlaneGeometry(SIZE, SIZE),
			new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthTest: false })
		);
		scene.add(mesh);
		return mesh;
	});
	const releaseAssets = () => {
		physics.destroy();
		for (const mesh of meshes) {
			mesh.geometry.dispose();
			mesh.material.map?.dispose();
			mesh.material.dispose();
		}
		renderer?.dispose();
		renderer?.forceContextLoss();
		canvas.remove();
	};
	try {
		if (renderer) {
			await renderer.compileAsync(scene, camera);
			for (const mesh of meshes) {
				await yieldSceneWork();
				signal?.throwIfAborted();
				if (mesh.material.map) renderer.initTexture(mesh.material.map);
			}
		}
		signal?.throwIfAborted();
	} catch (error) {
		releaseAssets();
		throw error;
	}
	let visible = false;
	let listening = false;
	let destroyed = false;
	let accumulator = 0;
	let activePointer: number | null = null;
	let activeButton: HTMLButtonElement | undefined;
	const events = new AbortController();
	const options = { signal: events.signal };

	function draw() {
		fallback?.clearRect(0, 0, width, height);
		physics.bodies.forEach((body, index) => {
			const mesh = meshes[index];
			mesh.position.set(body.position.x, body.position.y, 0);
			mesh.rotation.z = body.angle;
			const button = buttons[index];
			button.style.setProperty('--tool-size', `${SIZE * scale}px`);
			button.style.setProperty('--tool-x', `${(body.position.x - SIZE / 2) * scale}px`);
			button.style.setProperty('--tool-y', `${(body.position.y - SIZE / 2) * scale}px`);
			button.style.setProperty('--tool-angle', `${body.angle}rad`);
			if (fallback) {
				fallback.save();
				fallback.translate(body.position.x, body.position.y);
				fallback.rotate(body.angle);
				fallback.drawImage(artworkCanvases[index], -SIZE / 2, -SIZE / 2, SIZE, SIZE);
				fallback.restore();
			}
		});
		renderer?.render(scene, camera);
	}
	function stop() {
		gsap.ticker.remove(tick);
		listening = false;
		accumulator = 0;
	}
	function start() {
		if (destroyed || listening || !visible || document.hidden) return;
		listening = true;
		gsap.ticker.add(tick);
	}
	function tick(_time: number, delta: number) {
		accumulator += Math.min(delta, MAX_DELTA);
		while (accumulator >= STEP) {
			physics.step();
			accumulator -= STEP;
		}
		draw();
		if (!physics.active) stop();
	}
	function release() {
		physics.release();
		if (activePointer !== null && activeButton?.hasPointerCapture(activePointer))
			activeButton.releasePointerCapture(activePointer);
		activePointer = null;
		activeButton = undefined;
	}
	function point(event: PointerEvent) {
		const bounds = element.getBoundingClientRect();
		return {
			x: ((event.clientX - bounds.left) * width) / bounds.width,
			y: ((event.clientY - bounds.top) * height) / bounds.height,
		};
	}
	buttons.forEach((button, index) => {
		button.tabIndex = 0;
		button.disabled = false;
		button.addEventListener(
			'pointerdown',
			event => {
				if (event.button !== 0 || activePointer !== null) return;
				event.preventDefault();
				physics.grab(point(event), index);
				activePointer = event.pointerId;
				activeButton = button;
				button.setPointerCapture(event.pointerId);
				button.focus({ preventScroll: true });
				start();
			},
			options
		);
		button.addEventListener(
			'pointermove',
			event => {
				if (activePointer === event.pointerId) physics.move(point(event));
			},
			options
		);
		for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
			button.addEventListener(type, release, options);
		button.addEventListener(
			'keydown',
			event => {
				const direction: Record<string, [number, number]> = {
					ArrowLeft: [-KEY_STEP, 0],
					ArrowRight: [KEY_STEP, 0],
					ArrowUp: [0, -KEY_STEP],
					ArrowDown: [0, KEY_STEP],
					' ': [0, -KEY_STEP * 2],
				};
				const movement = direction[event.key];
				if (!movement) return;
				event.preventDefault();
				const body = physics.bodies[index];
				Sleeping.set(body, false);
				Body.setVelocity(body, { x: movement[0] / 3, y: movement[1] / 3 });
				start();
			},
			options
		);
	});
	function resize() {
		scale = getScale();
		const nextWidth = Math.max(SIZE + 16, element.clientWidth / scale);
		const nextHeight = Math.max(SIZE + 16, element.clientHeight / scale);
		if (width !== nextWidth || height !== nextHeight) {
			physics.resize(nextWidth, nextHeight);
			if (motion.matches) for (let i = 0; i < SETTLE_STEPS; i++) physics.step();
		}
		width = nextWidth;
		height = nextHeight;
		camera.right = width;
		camera.bottom = height;
		camera.updateProjectionMatrix();
		if (renderer) renderer.setSize(width * scale, height * scale, false);
		else {
			canvas.width = width * scale * RESOLUTION;
			canvas.height = height * scale * RESOLUTION;
			fallback?.setTransform(RESOLUTION * scale, 0, 0, RESOLUTION * scale, 0, 0);
		}
		draw();
		start();
	}
	const unsubscribe = subscribe(resize);
	const resizeObserver = new ResizeObserver(resize);
	resizeObserver.observe(element);
	document.addEventListener(
		'visibilitychange',
		() => {
			if (document.hidden) {
				release();
				stop();
			} else start();
		},
		options
	);
	window.addEventListener('blur', release, options);
	motion.addEventListener(
		'change',
		() => {
			if (motion.matches) {
				release();
				for (let i = 0; i < SETTLE_STEPS; i++) physics.step();
				draw();
			}
		},
		options
	);
	resize();
	element.dataset.state = 'ready';
	element.dataset.renderer = renderer ? 'webgl' : 'canvas';
	return {
		setVisible(next: boolean) {
			visible = next;
			if (next) start();
			else {
				release();
				stop();
			}
		},
		destroy() {
			destroyed = true;
			stop();
			release();
			events.abort();
			resizeObserver.disconnect();
			unsubscribe();
			releaseAssets();
		},
	};
}
