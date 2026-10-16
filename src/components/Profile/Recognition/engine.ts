// Imports
// ------------

import { getSettings, getSettingsTarget } from '@parts/ProfileReveal/Settings/store';
import { canHover } from '@utils/desktopHover';
import { yieldSceneWork } from '@utils/prepareScene';
import gsap from 'gsap';
import * as THREE from 'three';
import type { RecognitionScene } from './interface';
import { AWARD_IDS, clamp } from './motion';
import { fragmentShader, posterVertexShader } from './shaders';

// Scene
// ------------
const RADIUS = 3.85;
const PITCH = 6.5;
const PER_TURN = 10;
const TURNS = AWARD_IDS.length / PER_TURN;
const CARD_WIDTH = 2.4;
const CARD_HEIGHT = (CARD_WIDTH * 595) / 420;
const FOCUS_SCALE = 1.75;
const TAU = Math.PI * 2;
type Award = THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;

function required<T>(element: T | null): T {
	if (!element) throw new Error('Recognition element missing');
	return element;
}

export function createRecognition(section: HTMLElement, signal: AbortSignal): RecognitionScene {
	const stage = required(section.querySelector<HTMLElement>('[data-recognition-stage]'));
	const scroller = required(section.closest<HTMLElement>('#profile-panel'));
	const canvas = required(section.querySelector<HTMLCanvasElement>('canvas'));
	const returnButton = required(section.querySelector<HTMLButtonElement>('[data-recognition-return]'));
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
	renderer.setPixelRatio(Math.min(devicePixelRatio, getSettingsTarget() === 'mobile' ? 1.5 : 2));
	renderer.setClearColor(0x000000, 0);
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
	const geometry = new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT, 8, 10);
	const cards: Award[] = [];
	const textures: THREE.Texture[] = [];
	const pointer = new THREE.Vector2(10, 10);
	const raycaster = new THREE.Raycaster();
	const tilt = new THREE.Vector2();
	const tiltTarget = new THREE.Vector2();
	const paperVelocity = new THREE.Vector2();
	const rotation = new THREE.Quaternion();
	const euler = new THREE.Euler();
	const focusPosition = new THREE.Vector3();
	const reduced = matchMedia('(prefers-reduced-motion: reduce)');
	let visible = false;
	let disposed = false;
	let ready = false;
	let playing = !reduced.matches;
	let phase = 0.035;
	let targetPhase = phase;
	let lastScroll = scroller.scrollTop;
	let scrollSpeed = 0;
	let direction = 1;
	let width = 1;
	let height = 1;
	let selected: Award | null = null;
	let focused = false;
	let focusBlend = 0;
	let focusProgress = 0;
	let floatTime = 0;
	let floatStrength = 0;
	let rippleStrength = 0;
	let paperSurfaces: { mesh: THREE.Mesh; original: THREE.BufferGeometry; source: Float32Array }[] = [];

	function restorePaper() {
		for (const surface of paperSurfaces) {
			surface.mesh.geometry.dispose();
			surface.mesh.geometry = surface.original;
		}
		if (selected) {
			selected.material.uniforms.paperBend.value = 0;
		}
		paperSurfaces = [];
	}

	function bendPaper(amount: number) {
		const { awardBendStrength, awardHoverIntensity } = getSettings();
		// Cursor-centred, damped surface waves inspired by Curtains.js's simple-plane example.
		for (const { mesh, source } of paperSurfaces) {
			const positions = mesh.geometry.getAttribute('position');
			for (let i = 0; i < positions.count; i++) {
				const x = source[i * 3];
				const y = source[i * 3 + 1];
				const z = source[i * 3 + 2];
				const nx = x / (CARD_WIDTH / 2);
				const ny = y / (CARD_HEIGHT / 2);
				const dx = tilt.x - nx;
				const dy = tilt.y - ny;
				const distance = Math.hypot(dx, dy);
				const falloff = 1 / (1 + distance * 2.5);
				const wave = Math.cos(distance * 5 - floatTime * 4);
				const movementWave = Math.cos(distance * 5 - focusProgress * 6);
				const flex =
					falloff *
					(wave * (rippleStrength * 0.12 * focusBlend * awardHoverIntensity + floatStrength * 0.25) +
						movementWave * Math.abs(amount) * 0.42) *
					awardBendStrength;
				positions.setXYZ(i, x + flex * dx * 0.35, y + flex * dy * 0.35, z + flex);
			}
			positions.needsUpdate = true;
			mesh.geometry.computeVertexNormals();
			mesh.geometry.computeBoundingSphere();
		}
	}
	let glare = 0;
	let velocity = 0;
	let pointerId: number | null = null;
	let downX = 0;
	let downY = 0;
	let lastX = 0;
	let lastY = 0;
	let lastMove = 0;
	let moved = false;
	let pressed: Award | null = null;

	function focus(card: Award | null) {
		if (card) {
			selected = card;
			targetPhase = phase;
			paperSurfaces = [card, ...(card.children as THREE.Mesh[])].map(mesh => {
				const original = mesh.geometry;
				mesh.geometry =
					mesh === card ? new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT, 32, 40) : original.clone();
				if (mesh !== card) {
					mesh.updateMatrix();
					mesh.geometry.applyMatrix4(mesh.matrix);
					mesh.position.set(0, 0, 0);
					mesh.rotation.set(0, 0, 0);
					mesh.scale.setScalar(1);
				}
				return { mesh, original, source: new Float32Array(mesh.geometry.getAttribute('position').array) };
			});
		}
		focused = Boolean(card);
		velocity = 0;
		section.dataset.focus = String(focused);
		returnButton.hidden = !focused;
	}
	function resize() {
		width = Math.max(stage.clientWidth, 1);
		height = Math.max(stage.clientHeight, 1);
		renderer.setSize(width, height, false);
		camera.aspect = width / height;
		camera.zoom = getSettings().awardZoom;
		camera.position.z = Math.max(16, 4.7 / (Math.tan(THREE.MathUtils.degToRad(21)) * camera.aspect));
		camera.updateProjectionMatrix();
	}
	const observer = new ResizeObserver(resize);
	observer.observe(stage);
	resize();

	function updatePointer(event: PointerEvent) {
		const rect = canvas.getBoundingClientRect();
		pointer.set(
			((event.clientX - rect.left) / rect.width) * 2 - 1,
			(-(event.clientY - rect.top) / rect.height) * 2 + 1
		);
	}
	function pick() {
		scene.updateMatrixWorld();
		camera.updateMatrixWorld();
		raycaster.setFromCamera(pointer, camera);
		const hit = raycaster.intersectObjects(cards, false)[0]?.object as Award | undefined;
		return hit && hit.position.z > 1.5 && Math.abs(hit.position.y) < 3.5 ? hit : null;
	}
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
		if (Math.hypot(event.clientX - downX, event.clientY - downY) > 6) moved = true;
		if (!moved || selected) return;
		const now = performance.now();
		const delta =
			((event.pointerType === 'mouse' ? lastY - event.clientY : 0) - (event.clientX - lastX) * 0.6) / height;
		targetPhase += delta;
		velocity = clamp(delta / Math.max((now - lastMove) / 1000, 0.008), -1.3, 1.3);
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
		if (event.type !== 'pointerup' || performance.now() - lastMove > 100 || reduced.matches || selected)
			velocity = 0;
		pointerId = null;
		pressed = null;
		section.dataset.dragging = 'false';
	}
	function key(event: KeyboardEvent) {
		if (event.key === 'Escape' && selected) {
			event.stopPropagation();
			focus(null);
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			if (focused) focus(null);
			else if (!selected) {
				const central = cards
					.filter(card => card.position.z > 1.5)
					.sort((a, b) => a.position.lengthSq() - b.position.lengthSq())[0];
				if (central) focus(central);
			}
		}
		if (event.code === 'Space') {
			event.preventDefault();
			playing = !playing;
		}
		if (!selected && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
			event.preventDefault();
			targetPhase += event.key === 'ArrowRight' ? 0.055 : -0.055;
		}
	}
	const events = { signal };
	canvas.addEventListener('pointerdown', down, events);
	canvas.addEventListener('pointermove', move, events);
	canvas.addEventListener('pointerup', release, events);
	canvas.addEventListener('pointercancel', release, events);
	canvas.addEventListener('lostpointercapture', release, events);
	canvas.addEventListener('pointerleave', () => pointer.set(10, 10), events);
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

	function tick(_time: number, deltaTime: number) {
		const scrollDelta = scroller.scrollTop - lastScroll;
		lastScroll = scroller.scrollTop;
		if (!visible || disposed || !ready || document.hidden) {
			scrollSpeed = 0;
			return;
		}
		const dt = clamp(deltaTime / 1000, 0.001, 0.05);
		const settings = getSettings();
		if (camera.zoom !== settings.awardZoom) {
			camera.zoom = settings.awardZoom;
			camera.updateProjectionMatrix();
		}
		section.dataset.spiralZoom = String(camera.zoom);
		const size = settings.awardSize / 100;
		const ease = reduced.matches ? 1 : 1 - Math.exp(-9 * dt);
		if (Math.abs(scrollDelta) > 0.5 && !reduced.matches) direction = Math.sign(scrollDelta);
		const scrollTarget = reduced.matches
			? 0
			: clamp(scrollDelta / dt / height, -3, 3) * 0.25 * settings.awardScrollBoost;
		scrollSpeed = THREE.MathUtils.lerp(scrollSpeed, scrollTarget, ease);
		const speed = playing ? direction * 0.023 * settings.awardSpeed + scrollSpeed : 0;
		if (!selected && pointerId === null) {
			targetPhase += (speed + velocity) * dt;
			velocity *= Math.exp(-dt / (settings.awardDragEasing * 1.3));
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
		focusProgress = reduced.matches
			? focused
				? 1
				: 0
			: clamp(focusProgress + ((focused ? 1 : -1) * dt) / settings.awardFocusDuration);
		section.dataset.bendStrength = String(settings.awardBendStrength);
		section.dataset.hoverIntensity = String(settings.awardHoverIntensity);
		section.dataset.focusDuration = String(settings.awardFocusDuration);
		// Zero velocity and acceleration at both ends keeps the return from
		// accelerating into its spiral position and stopping abruptly.
		focusBlend = THREE.MathUtils.smootherstep(focusProgress, 0, 1);
		// A quick pull loads the sheet early; the small reversed bend is its settling recoil.
		const curl =
			reduced.matches || focusProgress === 0 || focusProgress === 1
				? 0
				: Math.sin(focusProgress * Math.PI * 2) *
					Math.sin(focusProgress * Math.PI) *
					Math.exp(-focusProgress * 3) *
					1.8;
		if (selected && playing && !reduced.matches) floatTime += dt;
		floatStrength = reduced.matches ? 0 : THREE.MathUtils.smoothstep(focusProgress, 0.8, 1) * 0.055;
		section.dataset.paperCurl = (selected ? curl : 0).toFixed(3);
		if (!focused && focusProgress === 0) {
			focusBlend = 0;
			focusProgress = 0;
			restorePaper();
			selected = null;
		}
		focusPosition.set(0, 0, RADIUS + 0.8);
		tiltTarget.set(0, 0);
		let overSelected = false;
		if (focused && (canHover() || pointerId !== null)) {
			const halfHeight =
				((camera.position.z - focusPosition.z) * Math.tan(THREE.MathUtils.degToRad(21))) / camera.zoom;
			const x = (pointer.x * halfHeight * camera.aspect) / ((CARD_WIDTH * FOCUS_SCALE * size) / 2);
			const y = (pointer.y * halfHeight) / ((CARD_HEIGHT * FOCUS_SCALE * size) / 2);
			overSelected = Math.abs(x) < 1 && Math.abs(y) < 1;
			if (overSelected && !reduced.matches) tiltTarget.set(x, y);
		}
		if (reduced.matches) {
			tilt.set(0, 0);
			paperVelocity.set(0, 0);
		} else {
			// Substeps keep this lightly damped paper spring stable on slower frames.
			const steps = Math.ceil(dt / 0.008);
			const step = dt / steps;
			for (let i = 0; i < steps; i++) {
				paperVelocity.x += ((tiltTarget.x - tilt.x) * 65 - paperVelocity.x * 10) * step;
				paperVelocity.y += ((tiltTarget.y - tilt.y) * 65 - paperVelocity.y * 10) * step;
				tilt.addScaledVector(paperVelocity, step);
			}
		}
		section.dataset.paperFlex = tilt.length().toFixed(3);
		const rippleTarget = reduced.matches || !focused ? 0 : Math.min(paperVelocity.length() * 0.3, 1);
		rippleStrength = THREE.MathUtils.lerp(
			rippleStrength,
			rippleTarget,
			1 - Math.exp(-dt * (rippleTarget > rippleStrength ? 9 : 2.5))
		);
		if (reduced.matches) rippleStrength = 0;
		focusPosition.x += tilt.x * 0.08 * settings.awardHoverIntensity;
		focusPosition.y += tilt.y * 0.06 * settings.awardHoverIntensity;
		focusPosition.y += Math.sin(floatTime * 1.1) * floatStrength * 0.4;
		glare = THREE.MathUtils.lerp(glare, overSelected ? Math.min(settings.awardHoverIntensity, 1) : 0, ease);
		rotation.setFromEuler(
			euler.set(
				-tilt.y * 0.08 * settings.awardHoverIntensity,
				tilt.x * 0.1 * settings.awardHoverIntensity,
				-tilt.x * 0.02 * settings.awardHoverIntensity
			)
		);
		const hovered = canHover() && !selected && pointerId === null ? pick() : null;
		section.dataset.hover = String(Boolean(hovered));
		cards.forEach((card, index) => {
			const t = THREE.MathUtils.euclideanModulo(index / PER_TURN + phase, TURNS) - TURNS / 2;
			const angle = -t * TAU;
			card.position.set(Math.sin(angle) * RADIUS, t * PITCH, Math.cos(angle) * RADIUS);
			card.rotation.set(0, angle, 0);
			card.traverse(object => object.layers.set(card === selected ? 1 : 0));
			card.scale.setScalar(THREE.MathUtils.lerp(card.scale.x, size * (card === hovered ? 1.045 : 1), ease));
			const depth = (Math.cos(angle) + 1) / 2;
			card.material.uniforms.depth.value = depth;
			card.material.uniforms.fade.value = THREE.MathUtils.smoothstep(TURNS / 2 - Math.abs(t), 0, 0.18);
			card.material.uniforms.glareAmount.value = card === selected ? glare * focusBlend : 0;
			card.material.uniforms.lightPosition.value.copy(tilt);
			if (card === selected) {
				card.position.lerp(focusPosition, focusBlend);
				card.material.uniforms.paperBend.value = Math.max(Math.abs(curl), tilt.length() * 0.7, floatStrength);
				card.quaternion.slerp(rotation, focusBlend);
				card.scale.setScalar(size * (1 + (FOCUS_SCALE - 1) * focusBlend));
				bendPaper(curl);
				card.material.uniforms.depth.value = THREE.MathUtils.lerp(depth, 1, focusBlend);
			}
		});
		camera.layers.set(0);
		renderer.render(scene, camera);
		if (selected) {
			renderer.autoClear = false;
			renderer.clearDepth();
			camera.layers.set(1);
			renderer.render(scene, camera);
			camera.layers.set(0);
			renderer.autoClear = true;
		}
	}
	function syncTicker() {
		gsap.ticker.remove(tick);
		if (visible && ready && !disposed && !document.hidden) {
			lastScroll = scroller.scrollTop;
			gsap.ticker.add(tick);
		}
	}
	document.addEventListener('visibilitychange', syncTicker, { signal });

	const loader = new THREE.TextureLoader();
	const loadAwards = async () => {
		if (signal.aborted) return;
		const results = await Promise.allSettled(
			AWARD_IDS.map(async id => {
				const texture = await loader.loadAsync(`/images/recognition/award-${String(id).padStart(2, '0')}.jpg`);
				if (signal.aborted) {
					texture.dispose();
					return null;
				}
				textures.push(texture);
				texture.colorSpace = THREE.SRGBColorSpace;
				texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
				return texture;
			})
		);
		if (signal.aborted) return;
		for (const result of results) {
			await yieldSceneWork();
			if (signal.aborted) return;
			if (result.status !== 'fulfilled' || !result.value) continue;
			// Upload one poster per task rather than all textures on the first scroll frame.
			renderer.initTexture(result.value);
			const material = new THREE.ShaderMaterial({
				vertexShader: posterVertexShader,
				fragmentShader,
				transparent: true,
				side: THREE.DoubleSide,
				uniforms: {
					paperBend: { value: 0 },
					poster: { value: result.value },
					depth: { value: 1 },
					fade: { value: 1 },
					glareAmount: { value: 0 },
					lightPosition: { value: new THREE.Vector2() },
				},
			});
			const mesh = new THREE.Mesh(geometry, material);
			cards.push(mesh);
			scene.add(mesh);
		}
		if (!cards.length) {
			section.dataset.state = 'fallback';
			return;
		}
		await renderer.compileAsync(scene, camera);
		if (signal.aborted) return;
		ready = true;
		syncTicker();
		// Place the cards before exposing readiness so immediate keyboard selection can find them.
		tick(0, 0);
		section.dataset.state = 'ready';
		section.dataset.awards = String(cards.length);
	};
	void loadAwards().catch(() => {
		if (!signal.aborted) section.dataset.state = 'fallback';
	});
	return {
		setVisible(next) {
			visible = next;
			syncTicker();
			section.dataset.visible = String(next);
		},
		destroy() {
			disposed = true;
			restorePaper();
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
