// Imports
// ------------
import { getSettings, getSettingsTarget } from '@parts/ProfileReveal/Settings/store';
import { canHover } from '@utils/desktopHover';
import { yieldSceneWork } from '@utils/prepareScene';
import gsap from 'gsap';
import * as THREE from 'three';
import type { RecognitionScene } from './interface';
import { clamp } from './motion';
import { fragmentShader, posterVertexShader } from './shaders';

// Constants
// ------------
// Spiral geometry, in scene units: radius, vertical rise per full turn, and posters per turn
const RADIUS = 3.85;
const PITCH = 6.5;
const PER_TURN = 10;

// Poster card size (the artwork is 420x595)
const CARD_WIDTH = 2.4;
const CARD_HEIGHT = (CARD_WIDTH * 595) / 420;

// How much larger an inspected poster is than one on the spiral, and how far in front of it it sits
const FOCUS_SCALE = 1.75;
const FOCUS_GAP = 0.8;
const TAU = Math.PI * 2;

// Starting phase, in turns
const INITIAL_PHASE = 0.035;

// Camera: vertical field of view, the half-width it keeps in frame, and how close it may get
const CAMERA_FOV = 42;
const CAMERA_HALF_FOV_RADIANS = THREE.MathUtils.degToRad(CAMERA_FOV / 2);
const CAMERA_FRAMED_HALF_WIDTH = 4.7;
const CAMERA_MIN_DISTANCE = 16;

const MOBILE_PIXEL_RATIO = 1.5;
const DESKTOP_PIXEL_RATIO = 2;
const MAX_ANISOTROPY = 8;

// Pointer rests off screen, where it hits nothing
const POINTER_REST = 10;

// A card is pickable when it faces the front and sits within the visible band
const PICK_MIN_Z = 1.5;
const PICK_MAX_Y = 3.5;

// Drag: px before a press becomes a drag, horizontal gain, and fling limits
const DRAG_THRESHOLD_PX = 6;
const DRAG_X_GAIN = 0.6;
const FLING_MIN_SECONDS = 0.008;
const FLING_MAX_VELOCITY = 1.3;
const FLING_MAX_IDLE_MS = 100;
const FLING_DECAY_GAIN = 1.3;

// Turns moved by an arrow key
const KEY_NUDGE = 0.055;

// Frame step limits, in seconds
const MIN_FRAME_SECONDS = 0.001;
const MAX_FRAME_SECONDS = 0.05;

// Motion: base spiral speed (turns/s) and scroll speed mapping
const SPIRAL_SPEED = 0.023;
const SCROLL_DELTA_THRESHOLD = 0.5;
const SCROLL_SPEED_LIMIT = 3;
const SCROLL_SPEED_GAIN = 0.25;

// Easing rates: card scale, tilt and glare
const SCALE_EASE_RATE = 9;
const TILT_EASE_RATE = 10;
const GLARE_EASE_RATE = 8;

// Inspected card tilt, per unit of hover strength
const HOVER_INTENSITY_GAIN = 10;
const MAX_HOVER_STRENGTH = 2;
const TILT_PITCH = 0.1;
const TILT_YAW = 0.12;

const HOVERED_CARD_SCALE = 1.045;

// Turns over which a card fades in at the ends of the spiral
const EDGE_FADE_TURNS = 0.18;

// Render layers: the spiral, and the inspected card drawn over it
const SPIRAL_LAYER = 0;
const FOCUS_LAYER = 1;

// Types
// ------------
type Award = THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
type Settings = ReturnType<typeof getSettings>;

// Helpers
// ------------
// Unwraps a required DOM element, throwing if the markup is missing it
function required<T>(element: T | null): T {
	if (!element) throw new Error('Recognition element missing');
	return element;
}

// Engine
// ------------
// Renders awards as shader-driven cards on a helical spiral. Phase (in turns) advances on its own,
// with scroll, and with drag/keys; clicking or pressing Enter lifts one card to the front for
// inspection, where the pointer tilts it and adds glare. Frame work runs on GSAP's ticker only
// while visible. section.dataset.* mirrors state for styling and tests.
//
// NOTE • posters are the award image URLs (Sanity, or the local fallback) — the
// spiral's length follows however many there are
export function createRecognition(
	section: HTMLElement,
	signal: AbortSignal,
	posters: readonly string[]
): RecognitionScene {
	// Total turns of the spiral; phase wraps modulo this
	const TURNS = posters.length / PER_TURN;

	// DOM
	const stage = required(section.querySelector<HTMLElement>('[data-recognition-stage]'));
	const scroller = required(section.closest<HTMLElement>('#profile-panel'));
	const canvas = required(section.querySelector<HTMLCanvasElement>('canvas'));
	const returnButton = required(section.querySelector<HTMLButtonElement>('[data-recognition-return]'));

	// Three.js objects
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
	renderer.setPixelRatio(
		Math.min(devicePixelRatio, getSettingsTarget() === 'mobile' ? MOBILE_PIXEL_RATIO : DESKTOP_PIXEL_RATIO)
	);
	renderer.setClearColor(0x000000, 0);
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 100);
	const geometry = new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT, 8, 10);
	const cards: Award[] = [];
	const textures: THREE.Texture[] = [];
	const pointer = new THREE.Vector2(POINTER_REST, POINTER_REST);
	const raycaster = new THREE.Raycaster();
	const tilt = new THREE.Vector2();
	const tiltTarget = new THREE.Vector2();
	const rotation = new THREE.Quaternion();
	const euler = new THREE.Euler();
	const focusPosition = new THREE.Vector3();
	const reduced = matchMedia('(prefers-reduced-motion: reduce)');

	// Lifecycle flags + spiral motion (phase is eased towards targetPhase; scrollSpeed follows the panel scroll)
	let visible = false;
	let disposed = false;
	let ready = false;
	let preparingFrame = false;
	let playing = !reduced.matches;
	let phase = INITIAL_PHASE;
	let targetPhase = phase;
	let lastScroll = scroller.scrollTop;
	let scrollSpeed = 0;
	let direction = 1;
	let width = 1;
	let height = 1;

	// Inspect state: focusProgress runs 0..1 linearly, focusBlend is its smoothed version used for animation
	let selected: Award | null = null;
	let focused = false;
	let focusBlend = 0;
	let focusProgress = 0;
	let glare = 0;
	let velocity = 0;

	// Pointer / drag tracking
	let pointerId: number | null = null;
	let downX = 0;
	let downY = 0;
	let lastX = 0;
	let lastY = 0;
	let lastMove = 0;
	let moved = false;
	let pressed: Award | null = null;

	// Enters (card) or leaves (null) inspection; a tapped card keeps the spiral where it is while selected
	function focus(card: Award | null) {
		if (card) {
			selected = card;
			targetPhase = phase;
		}
		focused = Boolean(card);
		velocity = 0;
		section.dataset.focus = String(focused);
		returnButton.hidden = !focused;
	}

	// Fit the renderer and camera to the stage; the camera pulls back so narrow stages still frame the spiral
	function resize() {
		width = Math.max(stage.clientWidth, 1);
		height = Math.max(stage.clientHeight, 1);
		renderer.setSize(width, height, false);
		camera.aspect = width / height;
		camera.zoom = getSettings().awardZoom;
		camera.position.z = Math.max(
			CAMERA_MIN_DISTANCE,
			CAMERA_FRAMED_HALF_WIDTH / (Math.tan(CAMERA_HALF_FOV_RADIANS) * camera.aspect)
		);
		camera.updateProjectionMatrix();
	}
	const observer = new ResizeObserver(resize);
	observer.observe(stage);
	resize();

	// Pointer in normalised device coordinates (-1..1, y up)
	function updatePointer(event: PointerEvent) {
		const rect = canvas.getBoundingClientRect();
		pointer.set(
			((event.clientX - rect.left) / rect.width) * 2 - 1,
			(-(event.clientY - rect.top) / rect.height) * 2 + 1
		);
	}
	// Front-facing card under the pointer, if any (cards at the back or off the visible band are ignored)
	function pick() {
		scene.updateMatrixWorld();
		camera.updateMatrixWorld();
		raycaster.setFromCamera(pointer, camera);
		const hit = raycaster.intersectObjects(cards, false)[0]?.object as Award | undefined;
		return hit && hit.position.z > PICK_MIN_Z && Math.abs(hit.position.y) < PICK_MAX_Y ? hit : null;
	}

	// Drag moves the spiral (past a threshold that separates a drag from a tap); a tap on a card inspects it
	function down(event: PointerEvent) {
		if (pointerId !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
		updatePointer(event);
		pointerId = event.pointerId;
		canvas.setPointerCapture(pointerId);
		pressed = pick();
		moved = false;
		velocity = 0;
		downX = lastX = event.clientX;
		downY = lastY = event.clientY;
		lastMove = performance.now();
		canvas.focus({ preventScroll: true });
	}
	function move(event: PointerEvent) {
		if (event.pointerId === pointerId || (canHover() && event.pointerType === 'mouse')) updatePointer(event);
		if (event.pointerId !== pointerId) return;
		if (Math.hypot(event.clientX - downX, event.clientY - downY) > DRAG_THRESHOLD_PX) moved = true;
		if (!moved || selected) return;
		const now = performance.now();
		const delta =
			((event.pointerType === 'mouse' ? lastY - event.clientY : 0) - (event.clientX - lastX) * DRAG_X_GAIN) /
			height;
		targetPhase += delta;
		velocity = clamp(
			delta / Math.max((now - lastMove) / 1000, FLING_MIN_SECONDS),
			-FLING_MAX_VELOCITY,
			FLING_MAX_VELOCITY
		);
		lastX = event.clientX;
		lastY = event.clientY;
		lastMove = now;
		section.dataset.dragging = 'true';
	}
	function release(event: PointerEvent) {
		if (event.pointerId !== pointerId) return;
		if (event.type === 'pointerup' && !moved) {
			if (focused) focus(null);
			else if (pressed && !selected) focus(pressed);
		}
		if (
			event.type !== 'pointerup' ||
			performance.now() - lastMove > FLING_MAX_IDLE_MS ||
			reduced.matches ||
			selected
		)
			velocity = 0;
		pointerId = null;
		pressed = null;
		section.dataset.dragging = 'false';
	}
	// The front-facing card nearest the spiral's centre
	function centralCard() {
		return cards
			.filter(card => card.position.z > PICK_MIN_Z)
			.sort((a, b) => a.position.lengthSq() - b.position.lengthSq())[0];
	}
	// Keyboard: Enter inspects the most central card (or returns), Escape returns, Space pauses, arrows nudge
	function key(event: KeyboardEvent) {
		if (event.key === 'Escape' && selected) {
			event.stopPropagation();
			focus(null);
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			if (focused) focus(null);
			else if (!selected) {
				const central = centralCard();
				if (central) focus(central);
			}
		}
		if (event.code === 'Space') {
			event.preventDefault();
			playing = !playing;
		}
		if (!selected && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
			event.preventDefault();
			targetPhase += event.key === 'ArrowRight' ? KEY_NUDGE : -KEY_NUDGE;
		}
	}

	// Listeners, all removed through the abort signal
	const events = { signal };
	canvas.addEventListener('pointerdown', down, events);
	canvas.addEventListener('pointermove', move, events);
	canvas.addEventListener('pointerup', release, events);
	canvas.addEventListener('pointercancel', release, events);
	canvas.addEventListener('lostpointercapture', release, events);
	canvas.addEventListener('pointerleave', () => pointer.set(POINTER_REST, POINTER_REST), events);
	canvas.addEventListener('keydown', key, events);
	canvas.addEventListener(
		'webglcontextlost',
		event => {
			event.preventDefault();
			ready = false;
			section.dataset.state = 'fallback';
		},
		events
	);
	returnButton.addEventListener(
		'click',
		() => {
			focus(null);
			canvas.focus({ preventScroll: true });
		},
		events
	);
	reduced.addEventListener(
		'change',
		() => {
			playing = !reduced.matches;
			velocity = 0;
		},
		events
	);

	function syncCameraZoom(settings: Settings) {
		if (camera.zoom !== settings.awardZoom) {
			camera.zoom = settings.awardZoom;
			camera.updateProjectionMatrix();
		}
		section.dataset.spiralZoom = String(camera.zoom);
	}

	// Spiral motion: scroll sets the direction and adds a speed boost; phase eases towards targetPhase
	function advanceSpiral(dt: number, scrollDelta: number, ease: number, settings: Settings) {
		if (Math.abs(scrollDelta) > SCROLL_DELTA_THRESHOLD && !reduced.matches) direction = Math.sign(scrollDelta);
		const scrollTarget = reduced.matches
			? 0
			: clamp(scrollDelta / dt / height, -SCROLL_SPEED_LIMIT, SCROLL_SPEED_LIMIT) *
				SCROLL_SPEED_GAIN *
				settings.awardScrollBoost;
		scrollSpeed = THREE.MathUtils.lerp(scrollSpeed, scrollTarget, ease);

		const speed = playing ? direction * SPIRAL_SPEED * settings.awardSpeed + scrollSpeed : 0;
		if (!selected && pointerId === null) {
			targetPhase += (speed + velocity) * dt;
			velocity *= Math.exp(-dt / (settings.awardDragEasing * FLING_DECAY_GAIN));
		}

		phase = THREE.MathUtils.lerp(
			phase,
			targetPhase,
			reduced.matches ? 1 : 1 - Math.exp(-dt / settings.awardDragEasing)
		);
		// Keep both sides of the eased position on the same turn at the wrap boundary.
		const turns = Math.floor(phase / TURNS) * TURNS;
		phase -= turns;
		targetPhase -= turns;

		section.dataset.spiralSpeed = speed.toFixed(4);
		section.dataset.awardSize = String(settings.awardSize);
		section.dataset.dragEasing = String(settings.awardDragEasing);
	}

	// Inspect progress; clears the selection once a return has finished
	function advanceFocus(dt: number, settings: Settings) {
		focusProgress = reduced.matches
			? focused
				? 1
				: 0
			: clamp(focusProgress + ((focused ? 1 : -1) * dt) / settings.awardFocusDuration);
		section.dataset.hoverIntensity = String(settings.awardHoverIntensity);
		section.dataset.focusDuration = String(settings.awardFocusDuration);
		// Zero velocity and acceleration at both ends keeps the return from
		// accelerating into its spiral position and stopping abruptly.
		focusBlend = THREE.MathUtils.smootherstep(focusProgress, 0, 1);
		section.dataset.focusProgress = focusProgress.toFixed(3);
		if (!focused && focusProgress === 0) {
			focusBlend = 0;
			focusProgress = 0;
			selected = null;
		}
	}

	// Inspection target: just in front of the spiral; the pointer tilts the card while it is hovered
	function updateInspectPose(dt: number, size: number, settings: Settings) {
		focusPosition.set(0, 0, RADIUS + FOCUS_GAP);
		tiltTarget.set(0, 0);
		let overSelected = false;
		if (focused && (canHover() || pointerId !== null)) {
			const halfHeight =
				((camera.position.z - focusPosition.z) * Math.tan(CAMERA_HALF_FOV_RADIANS)) / camera.zoom;
			const x = (pointer.x * halfHeight * camera.aspect) / ((CARD_WIDTH * FOCUS_SCALE * size) / 2);
			const y = (pointer.y * halfHeight) / ((CARD_HEIGHT * FOCUS_SCALE * size) / 2);
			overSelected = Math.abs(x) < 1 && Math.abs(y) < 1;
			if (overSelected && !reduced.matches) tiltTarget.set(x, y);
		}
		// Damp the rigid card tilt without paper wobble or surface ripples.
		if (reduced.matches) tilt.set(0, 0);
		else tilt.lerp(tiltTarget, 1 - Math.exp(-dt * TILT_EASE_RATE));

		const hoverStrength = Math.min(settings.awardHoverIntensity * HOVER_INTENSITY_GAIN, MAX_HOVER_STRENGTH);
		section.dataset.cardTilt = tilt.length().toFixed(3);
		glare = THREE.MathUtils.lerp(
			glare,
			overSelected && !reduced.matches ? Math.min(hoverStrength, 1) : 0,
			1 - Math.exp(-dt * GLARE_EASE_RATE)
		);
		section.dataset.cardGlare = glare.toFixed(3);
		rotation.setFromEuler(euler.set(-tilt.y * TILT_PITCH * hoverStrength, tilt.x * TILT_YAW * hoverStrength, 0));
	}

	// Place every card on the helix, t = its offset in turns from the middle of the spiral
	function placeCards(size: number, ease: number, hovered: Award | null) {
		cards.forEach((card, index) => {
			const t = THREE.MathUtils.euclideanModulo(index / PER_TURN + phase, TURNS) - TURNS / 2;
			const angle = -t * TAU;
			card.position.set(Math.sin(angle) * RADIUS, t * PITCH, Math.cos(angle) * RADIUS);
			card.rotation.set(0, angle, 0);
			card.traverse(object => object.layers.set(card === selected ? FOCUS_LAYER : SPIRAL_LAYER));
			card.scale.setScalar(
				THREE.MathUtils.lerp(card.scale.x, size * (card === hovered ? HOVERED_CARD_SCALE : 1), ease)
			);
			const depth = (Math.cos(angle) + 1) / 2;
			card.material.uniforms.depth.value = depth;
			card.material.uniforms.fade.value = THREE.MathUtils.smoothstep(TURNS / 2 - Math.abs(t), 0, EDGE_FADE_TURNS);
			card.material.uniforms.glareAmount.value = card === selected ? glare * focusBlend : 0;
			card.material.uniforms.lightPosition.value.copy(tilt);
			if (card === selected) {
				card.position.lerp(focusPosition, focusBlend);
				card.quaternion.slerp(rotation, focusBlend);
				card.scale.setScalar(size * (1 + (FOCUS_SCALE - 1) * focusBlend));
				card.material.uniforms.depth.value = THREE.MathUtils.lerp(depth, 1, focusBlend);
			}
		});
	}

	// The focus layer holds the inspected card, drawn in a second pass over a cleared depth buffer so it never clips into the spiral.
	function renderLayers() {
		camera.layers.set(SPIRAL_LAYER);
		renderer.render(scene, camera);
		if (selected) {
			renderer.autoClear = false;
			renderer.clearDepth();
			camera.layers.set(FOCUS_LAYER);
			renderer.render(scene, camera);
			camera.layers.set(SPIRAL_LAYER);
			renderer.autoClear = true;
		}
	}

	// Frame: update spiral phase, inspect animation and card uniforms, then render.
	function tick(_time: number, deltaTime: number) {
		const scrollDelta = scroller.scrollTop - lastScroll;
		lastScroll = scroller.scrollTop;
		if ((!visible && !preparingFrame) || disposed || !ready || document.hidden) {
			scrollSpeed = 0;
			return;
		}

		const dt = clamp(deltaTime / 1000, MIN_FRAME_SECONDS, MAX_FRAME_SECONDS);
		const settings = getSettings();
		syncCameraZoom(settings);

		const size = settings.awardSize / 100;
		const ease = reduced.matches ? 1 : 1 - Math.exp(-SCALE_EASE_RATE * dt);

		advanceSpiral(dt, scrollDelta, ease, settings);
		advanceFocus(dt, settings);
		updateInspectPose(dt, size, settings);

		const hovered = canHover() && !selected && pointerId === null ? pick() : null;
		section.dataset.hover = String(Boolean(hovered));

		placeCards(size, ease, hovered);
		renderLayers();
	}

	// Run the ticker only while visible, loaded and the tab is showing
	function syncTicker() {
		gsap.ticker.remove(tick);
		if (visible && ready && !disposed && !document.hidden) {
			lastScroll = scroller.scrollTop;
			gsap.ticker.add(tick);
		}
	}
	document.addEventListener('visibilitychange', syncTicker, { signal });

	// Loads one poster, or resolves null if the scene went away meanwhile
	const loader = new THREE.TextureLoader();
	const loadPoster = async (poster: string) => {
		const texture = await loader.loadAsync(poster);
		if (signal.aborted) {
			texture.dispose();
			return null;
		}
		textures.push(texture);
		texture.colorSpace = THREE.SRGBColorSpace;
		texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), MAX_ANISOTROPY);
		return texture;
	};

	const addCard = (poster: THREE.Texture) => {
		const material = new THREE.ShaderMaterial({
			vertexShader: posterVertexShader,
			fragmentShader,
			transparent: true,
			side: THREE.DoubleSide,
			uniforms: {
				poster: { value: poster },
				depth: { value: 1 },
				fade: { value: 1 },
				glareAmount: { value: 0 },
				lightPosition: { value: new THREE.Vector2() },
			},
		});
		const mesh = new THREE.Mesh(geometry, material);
		cards.push(mesh);
		scene.add(mesh);
	};

	// Load every poster in parallel, then build one card each (one task per card so the main thread stays responsive)
	const loadAwards = async () => {
		if (signal.aborted) return;
		const results = await Promise.allSettled(posters.map(poster => loadPoster(poster)));
		if (signal.aborted) return;

		for (const result of results) {
			await yieldSceneWork();
			if (signal.aborted) return;
			if (result.status !== 'fulfilled' || !result.value) continue;
			// Upload one poster per task rather than all textures on the first scroll frame.
			renderer.initTexture(result.value);
			addCard(result.value);
		}

		if (!cards.length) {
			section.dataset.state = 'fallback';
			return;
		}

		await renderer.compileAsync(scene, camera);
		if (signal.aborted) return;
		ready = true;
		// Draw the complete layout offscreen before allowing the canvas to fade in.
		preparingFrame = true;
		tick(0, 0);
		preparingFrame = false;
		section.dataset.state = 'ready';
		section.dataset.awards = String(cards.length);
		syncTicker();
	};

	void loadAwards().catch(() => {
		if (!signal.aborted) section.dataset.state = 'fallback';
	});

	// Handle
	return {
		setVisible(next) {
			visible = next;
			syncTicker();
			section.dataset.visible = String(next);
		},
		destroy() {
			disposed = true;
			gsap.ticker.remove(tick);
			observer.disconnect();
			for (const card of cards) card.material.dispose();
			for (const texture of textures) texture.dispose();
			geometry.dispose();
			renderer.dispose();
			section.dataset.focus = 'false';
			returnButton.hidden = true;
		},
	};
}
