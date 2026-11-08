'use strict';

// Introduction
// ------------
// Timing and settings for the slide-reveal cascade that plays when the ribbon first appears.
// Wired up by app.js, which calls `update(time)` each frame and passes `progress` (0..1) and
// `settings` to the ribbon shader. Builds its controls into the settings panel, before
// `#intro-replay`, and persists the user's tweaks to localStorage under `ribbon-introduction`.

class RibbonIntroduction {
	static STORAGE_KEY = 'ribbon-introduction';
	// Only stored settings of this version restore the duration and intensity.
	static SETTINGS_VERSION = 2;
	// The cascade effect, the extra stagger steps it adds to the length, and the flat fade used for reduced motion.
	static CASCADE_EFFECT = 9;
	static CASCADE_STAGGER_STEPS = 4;
	static REDUCED_FADE_MS = 250;
	// NOTE • Read every frame while the intro runs: one live MediaQueryList rather than parsing a new query each time
	static REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');

	// `requestFrame` asks app.js for a render; `prepare` runs at the start of each `play()`.
	constructor(requestFrame, prepare) {
		this.requestFrame = requestFrame;
		this.prepare = prepare;

		// Reveal progress 0..1, whether the intro is running, and the timestamp it started at.
		this.progress = 0;
		this.active = false;
		this.start = null;

		// Defaults. `duration` is seconds; `intensity` and `transitionStart` are percentages;
		// `cascadeStagger` is milliseconds between slides.
		this.settings = {
			version: RibbonIntroduction.SETTINGS_VERSION,
			effect: RibbonIntroduction.CASCADE_EFFECT,
			duration: 1.1,
			intensity: 90,
			cascadeEase: 1,
			cascadeStagger: 50,
			transitionStart: 50,
		};

		// Restore saved duration and intensity, clamped to the slider limits.
		// Ignored unless the stored settings carry the current version.
		this.restoreSaved(saved => {
			if (saved.version === RibbonIntroduction.SETTINGS_VERSION)
				for (const [key, min, max] of [
					['duration', 0.4, 3],
					['intensity', 25, 150],
				])
					if (Number.isFinite(saved[key])) this.settings[key] = Math.min(max, Math.max(min, saved[key]));
		});

		// Cascade controls are injected here rather than written in index.html.
		const cascade = document.createElement('div');
		cascade.innerHTML =
			'<label for="intro-cascadeEase">Cascade easing</label>' +
			'<select id="intro-cascadeEase">' +
			'<option value="0">Smooth in/out</option>' +
			'<option value="1">Cubic out</option>' +
			'<option value="2">Quartic out</option>' +
			'<option value="3">Sine in/out</option>' +
			'<option value="4">Linear</option>' +
			'</select>' +
			'<div class="control"><div class="control-top">' +
			'<label for="intro-cascadeStagger">Cascade stagger</label><output id="intro-cascadeStagger-value"></output>' +
			'</div><input id="intro-cascadeStagger" type="range" min="0" max="200" step="5"></div>' +
			'<div class="control"><div class="control-top">' +
			'<label for="intro-transitionStart">Start during page transition</label><output id="intro-transitionStart-value"></output>' +
			'</div><input id="intro-transitionStart" type="range" min="0" max="100" step="5"></div>';
		document.querySelector('#intro-replay').before(cascade);

		// Restore the cascade settings, clamped to 0..max (the easing is a whole-number option index).
		this.restoreSaved(saved => {
			for (const [key, max] of [
				['cascadeEase', 4],
				['cascadeStagger', 200],
				['transitionStart', 100],
			])
				if (Number.isFinite(saved[key]))
					this.settings[key] = Math.max(
						0,
						Math.min(max, key === 'cascadeEase' ? Math.round(saved[key]) : saved[key])
					);
		});

		// Bind each control: edits save as you drag, and releasing the control replays the intro.
		for (const key of ['duration', 'intensity', 'cascadeEase', 'cascadeStagger', 'transitionStart']) {
			const input = document.querySelector('#intro-' + key);
			input.value = this.settings[key];
			input.addEventListener('input', () => {
				this.settings[key] = +input.value;
				this.sync();
				try {
					localStorage.setItem(RibbonIntroduction.STORAGE_KEY, JSON.stringify(this.settings));
				} catch {}
			});
			input.addEventListener('change', () => this.play());
		}

		document.querySelector('#intro-replay').onclick = () => this.play();
		this.sync();
	}

	// Hands `apply` the stored settings. Missing, corrupt or blocked storage leaves the defaults as they are.
	restoreSaved(apply) {
		try {
			apply(JSON.parse(localStorage.getItem(RibbonIntroduction.STORAGE_KEY) || '{}'));
		} catch {}
	}

	// Refreshes the value read-outs beside the sliders.
	sync() {
		document.querySelector('#intro-duration-value').textContent = this.settings.duration.toFixed(1) + 's';
		document.querySelector('#intro-intensity-value').textContent = this.settings.intensity + '%';
		document.querySelector('#intro-cascadeStagger-value').textContent = this.settings.cascadeStagger + 'ms';
		document.querySelector('#intro-transitionStart-value').textContent = this.settings.transitionStart + '%';
		document.querySelector('#intro-description').textContent =
			'Slides reveal from their centres in a staggered sequence. Changes save automatically.';
	}

	// Starts (or restarts) the intro. With `waitForPage`, `update()` holds the start until
	// the host's page transition has progressed far enough.
	play(waitForPage = false) {
		this.prepare();
		this.waitForPage = waitForPage;
		this.start = null;
		this.progress = 0;
		this.active = true;
		document.querySelector('#intro-status').textContent = RibbonIntroduction.REDUCED_MOTION.matches
			? 'Reduced motion: using a short fade.'
			: 'Playing — scroll to take control.';
		this.requestFrame();
	}

	// Jumps to the fully revealed state and ends the intro.
	// NOTE • Called on every wheel event, press and arrow key, so the status line is only rewritten when it changes.
	finish() {
		this.active = false;
		this.progress = 1;
		this.start = null;
		const status = document.querySelector('#intro-status'),
			text = 'Ready. Replay slide cascade.';
		if (status.textContent !== text) status.textContent = text;
		this.requestFrame();
	}

	// Per-frame step; `time` is the rAF timestamp in ms. Returns true while the intro still
	// needs frames (including while it waits for the host transition).
	update(time) {
		if (!this.active) return false;
		const reduced = RibbonIntroduction.REDUCED_MOTION.matches;

		if (this.start === null) {
			// Let the host cross-dissolve finish before revealing live WebGL behind its snapshot.
			if (this.waitForPage && !reduced) {
				try {
					const root = window.parent.document.documentElement;
					// The host's own wave transition reports progress 0..1 as a data attribute.
					if (root.dataset.navigationWave === 'running') {
						if (Number(root.dataset.navigationWaveProgress || 0) < this.settings.transitionStart / 100)
							return true;
					} else if (
						// Otherwise wait for any running view-transition or `vt-fade` animation on the host.
						window.parent.document
							.getAnimations()
							.some(
								animation =>
									(animation.effect?.pseudoElement?.startsWith('::view-transition') ||
										animation.animationName === 'vt-fade') &&
									(animation.playState === 'running' || animation.pending)
							)
					)
						return true;
				} catch {}
			}
			this.start = time;
			this.waitForPage = false;
		}

		// Elapsed time over total length: the duration plus, for the cascade effect, the stagger steps in ms.
		const { CASCADE_EFFECT, CASCADE_STAGGER_STEPS, REDUCED_FADE_MS } = RibbonIntroduction;
		this.progress = Math.max(
			0,
			Math.min(
				1,
				(time - this.start) /
					(reduced
						? REDUCED_FADE_MS
						: this.settings.duration * 1000 +
							(this.settings.effect === CASCADE_EFFECT
								? CASCADE_STAGGER_STEPS * this.settings.cascadeStagger
								: 0))
			)
		);

		if (this.progress >= 1) {
			this.finish();
			return false;
		}
		return true;
	}
}
