// Model viewer engine
// ------------
// NOTE • Only ever loaded by a dynamic import() when a visitor presses "View in
// 3D", so three.js and its loaders stay out of every page's bundle. Draws on
// GSAP's shared ticker (no second rAF loop) and only while on screen.
//
// Compressed geometry: meshopt decodes inline; Draco fetches its decoder from
// public/draco (copied from three/examples/jsm/libs/draco/gltf — refresh it
// when three is upgraded) only when a model actually uses it. Both compile
// WebAssembly, which is why the CSP allows 'wasm-unsafe-eval' and blob: workers.

// Imports
// ------------
import gsap from 'gsap';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Types
// ------------
export interface ModelViewer {
	setRotating: (isRotating: boolean) => void;
	dispose: () => void;
}

interface Options {
	// 0–1 as the file downloads, or null when the server doesn't send its size
	onProgress: (progress: number | null) => void;
	isRotating: boolean;
	signal: AbortSignal;
}

// Constants
// ------------
const FIELD_OF_VIEW = 30;
// NOTE • Breathing room round the model's bounding sphere — larger sits the model
// smaller in the frame (1.55 leaves a round coin at about 45% of the height)
const FRAME_PADDING = 1.55;
// A little above the model, looking slightly down
const VIEW_ELEVATION = THREE.MathUtils.degToRad(12);
// NOTE • OrbitControls' speed 2 is one turn per 30s; 3 is one per 20s
const AUTO_ROTATE_SPEED = 3;
// Seconds after a drag before the model starts turning on its own again
const RESUME_AFTER = 1.5;
// How far a drag may tilt the model above and below its starting angle
const TILT_UP = THREE.MathUtils.degToRad(28);
const TILT_DOWN = THREE.MathUtils.degToRad(18);
const MAX_PIXEL_RATIO = 2;
const DRACO_DECODER = '/draco/';

// Helpers
// ------------
const disposeObject = (root: THREE.Object3D) =>
	root.traverse(node => {
		if (!(node instanceof THREE.Mesh)) return;
		node.geometry.dispose();
		for (const material of [node.material].flat() as THREE.Material[]) {
			for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
			material.dispose();
		}
	});

// NOTE • Fits the bounding sphere inside whichever field of view is tighter,
// so a portrait block doesn't crop a wide model
const distanceFor = (radius: number, aspect: number) => {
	const vertical = THREE.MathUtils.degToRad(FIELD_OF_VIEW) / 2;
	const horizontal = Math.atan(Math.tan(vertical) * aspect);
	return (radius * FRAME_PADDING) / Math.sin(Math.min(vertical, horizontal));
};

// Exports
// ------------
export const createModelViewer = async (
	canvas: HTMLCanvasElement,
	url: string,
	{ onProgress, isRotating, signal }: Options
): Promise<ModelViewer> => {
	const draco = new DRACOLoader().setDecoderPath(DRACO_DECODER);
	const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setDRACOLoader(draco);
	const gltf = await loader
		.loadAsync(url, event => onProgress(event.lengthComputable ? event.loaded / event.total : null))
		// NOTE • The decoder's workers are only needed while the file is parsed
		.finally(() => draco.dispose());
	if (signal.aborted) {
		disposeObject(gltf.scene);
		throw signal.reason;
	}

	// Scene
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
	renderer.setPixelRatio(Math.min(devicePixelRatio, MAX_PIXEL_RATIO));
	renderer.toneMapping = THREE.NeutralToneMapping;
	const scene = new THREE.Scene();
	// NOTE • A procedural studio for image-based lighting — no HDR file to fetch
	const pmrem = new THREE.PMREMGenerator(renderer);
	const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
	scene.environment = environment;

	// Model, centred on the origin
	const model = gltf.scene;
	const sphere = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere());
	model.position.sub(sphere.center);
	scene.add(model);

	// Camera and controls
	const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, 1, sphere.radius / 100, sphere.radius * 100);
	const controls = new OrbitControls(camera, canvas);
	controls.enableDamping = true;
	controls.enableZoom = false;
	controls.enablePan = false;
	controls.autoRotate = isRotating;
	controls.autoRotateSpeed = AUTO_ROTATE_SPEED;
	controls.minPolarAngle = Math.PI / 2 - VIEW_ELEVATION - TILT_UP;
	controls.maxPolarAngle = Math.PI / 2 - VIEW_ELEVATION + TILT_DOWN;
	// NOTE • OrbitControls blocks all touch scrolling; let vertical swipes scroll
	// the page past the block, so only sideways drags turn the model
	canvas.style.touchAction = 'pan-y';

	let wantsRotation = isRotating;
	let resumeCall: gsap.core.Tween | null = null;
	const onDragStart = () => {
		resumeCall?.kill();
		controls.autoRotate = false;
	};
	const onDragEnd = () => {
		resumeCall = gsap.delayedCall(RESUME_AFTER, () => {
			controls.autoRotate = wantsRotation;
		});
	};
	controls.addEventListener('start', onDragStart);
	controls.addEventListener('end', onDragEnd);

	// NOTE • Keeps the camera's direction, re-fitting its distance to the new shape
	const resize = () => {
		const { clientWidth: width, clientHeight: height } = canvas;
		if (!width || !height) return;
		renderer.setSize(width, height, false);
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		const distance = distanceFor(sphere.radius, camera.aspect);
		const direction = camera.position.lengthSq()
			? camera.position.clone().normalize()
			: new THREE.Vector3(0, Math.sin(VIEW_ELEVATION), Math.cos(VIEW_ELEVATION));
		camera.position.copy(direction.multiplyScalar(distance));
		controls.update();
	};

	const tick = (_time: number, deltaTime: number) => {
		controls.update(deltaTime / 1000);
		renderer.render(scene, camera);
	};

	let isTicking = false;
	const setTicking = (shouldTick: boolean) => {
		if (shouldTick === isTicking) return;
		if (shouldTick) gsap.ticker.add(tick);
		else gsap.ticker.remove(tick);
		isTicking = shouldTick;
	};

	const resizeObserver = new ResizeObserver(resize);
	const visibility = new IntersectionObserver(([entry]) => setTicking(Boolean(entry?.isIntersecting)));
	resizeObserver.observe(canvas);
	visibility.observe(canvas);
	resize();
	renderer.render(scene, camera);

	return {
		setRotating: next => {
			wantsRotation = next;
			resumeCall?.kill();
			controls.autoRotate = next;
		},
		dispose: () => {
			setTicking(false);
			resumeCall?.kill();
			resizeObserver.disconnect();
			visibility.disconnect();
			controls.removeEventListener('start', onDragStart);
			controls.removeEventListener('end', onDragEnd);
			controls.dispose();
			disposeObject(model);
			environment.dispose();
			pmrem.dispose();
			renderer.dispose();
		},
	};
};
