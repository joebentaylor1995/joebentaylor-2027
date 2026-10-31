'use strict';

// Loader wave
// ------------
// Full-screen post-process that reveals the ribbon with an expanding, lens-like wave.
// Created by app.js (`loaderWave`) with its WebGL context: app.js draws the scene into this
// pass's framebuffer between `begin()` and `end()`, and sets `progress` (0..1) and `settings`.
// GL resources are created lazily on first use and released by `dispose()`.

// A temporary screen-space pass: the live ribbon is refracted, not just masked.
class RibbonLoaderWave {
	constructor(gl) {
		this.gl = gl;
		this.progress = 0;
		this.resources = null;

		// Shader tuning. Every key except originX / originY is also a uniform of the same name;
		// origin is a percentage of the screen, the rest are multipliers (1 = neutral).
		this.settings = {
			originX: 50,
			originY: 50,
			width: 1,
			softness: 1,
			lensWidth: 1,
			lensFalloff: 1,
			strength: 1,
			bend: 1.2,
			lensChroma: 1,
			lensShadow: 1,
			rings: 0,
			frequency: 3.5,
			decay: 4.6,
			reflection: 1,
			caustic: 1,
		};
	}

	// Compiles the program and allocates the buffer, scene texture, framebuffer and depth buffer.
	create() {
		const gl = this.gl;

		const compile = (type, source) => {
			const shader = gl.createShader(type);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
			return shader;
		};

		// Shaders
		const vertex = compile(
			gl.VERTEX_SHADER,
			`
				attribute vec2 position;
				varying vec2 uv;
				void main() {
					uv = position * .5 + .5;
					gl_Position = vec4(position, 0., 1.);
				}
			`
		);

		const fragment = compile(
			gl.FRAGMENT_SHADER,
			`
				precision highp float;
				varying vec2 uv;
				uniform sampler2D scene;
				uniform float progress, aspect, width, softness, lensWidth, lensFalloff, strength, bend, lensChroma, lensShadow, rings, frequency, decay, reflection, caustic;
				uniform vec2 origin;
				void main() {
					// Distance from the wave origin, scaled by aspect so the wave is circular on screen.
					vec2 radial = (uv - origin) * vec2(aspect, 1.);
					float distance = length(radial);

					// Fade the effect in over the first 6% and out over the last 12% of progress.
					float envelope = smoothstep(0., .06, progress) * (1. - smoothstep(.88, 1., progress));

					// The wavefront grows from just inside the origin to just past the farthest corner.
					float feather = max(.001, .16 * width * softness);
					float radius = mix(-feather * 2., length(max(origin, 1. - origin) * vec2(aspect, 1.)) + feather * 2., progress);

					// Signed distance to the front, then a bell-shaped lens (meniscus) centred on it.
					float edge = (distance - radius) / (.22 * max(.01, width) * max(.1, lensWidth));
					float meniscus = exp(-pow(abs(edge), max(1., lensFalloff * 2.))) * envelope * strength;

					// Optional decaying ripples trailing behind the front.
					float trailing = min(edge, 0.);
					float ripple = sin(trailing * frequency) * exp(trailing * decay) * smoothstep(0., .4, -edge) * rings * envelope * strength;

					// Refraction: push the sample point radially, with a slight red/blue split.
					vec2 normal = radial / max(distance, .001) * (meniscus * .85 + ripple) * bend;
					vec2 offset = normal / vec2(aspect, 1.) * .095;
					vec2 chroma = offset * .02 * lensChroma;
					vec3 colour = texture2D(scene, clamp(uv + offset, 0., 1.)).rgb;
					colour.r = texture2D(scene, clamp(uv + offset + chroma, 0., 1.)).r;
					colour.b = texture2D(scene, clamp(uv + offset - chroma, 0., 1.)).b;

					// Inside the front shows the scene; outside is flat dark grey (18/255).
					float revealed = 1. - smoothstep(-feather, feather, distance - radius);
					colour = mix(vec3(18. / 255.), colour, revealed);

					// Lighting on the lens: darken slightly, then add fresnel rim and a specular highlight.
					vec3 n = normalize(vec3(-normal * 1.8, 1.));
					float fresnel = pow(1. - n.z, 3.);
					float shine = pow(max(0., dot(n, normalize(vec3(-.45, .65, 1.)))), 32.);
					colour *= 1. - clamp(meniscus * .035 * lensShadow, 0., .9);
					colour += meniscus * (vec3(.72, .84, .9) * fresnel * .12 + vec3(1.) * shine * .06) * reflection;

					// Faint caustic glow just behind the front.
					colour += vec3(.8, .91, 1.) * exp(-pow((edge + .65) * 2., 2.)) * envelope * strength * .025 * caustic;
					gl_FragColor = vec4(colour, 1.);
				}
			`
		);

		const program = gl.createProgram();
		gl.attachShader(program, vertex);
		gl.attachShader(program, fragment);
		gl.linkProgram(program);
		gl.deleteShader(vertex);
		gl.deleteShader(fragment);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));

		// One oversized triangle that covers the whole viewport.
		const buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

		// Offscreen target the scene is rendered into (sized in `begin()`).
		const texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, texture);
		for (const parameter of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER])
			gl.texParameteri(gl.TEXTURE_2D, parameter, gl.LINEAR);
		for (const parameter of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T])
			gl.texParameteri(gl.TEXTURE_2D, parameter, gl.CLAMP_TO_EDGE);
		const framebuffer = gl.createFramebuffer(),
			depth = gl.createRenderbuffer();

		const uniforms = {};
		for (const name of ['scene', 'progress', 'aspect', 'origin', ...Object.keys(this.settings)])
			uniforms[name] = gl.getUniformLocation(program, name);

		this.resources = {
			program,
			buffer,
			texture,
			framebuffer,
			depth,
			uniforms,
			position: gl.getAttribLocation(program, 'position'),
			width: 0,
			height: 0,
		};
	}

	// Redirects drawing into the offscreen framebuffer, resizing it to the canvas when needed.
	// Returns false once the wave has finished (`progress` >= 1), when no pass is needed.
	begin() {
		if (this.progress >= 1) return false;
		if (!this.resources) this.create();

		const gl = this.gl,
			r = this.resources,
			w = gl.canvas.width,
			h = gl.canvas.height;

		gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);

		if (r.width !== w || r.height !== h) {
			r.width = w;
			r.height = h;
			gl.bindTexture(gl.TEXTURE_2D, r.texture);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.texture, 0);
			gl.bindRenderbuffer(gl.RENDERBUFFER, r.depth);
			gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
			gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, r.depth);
			if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
				throw Error('Ribbon wave framebuffer unavailable');
		}
		return true;
	}

	// Draws the captured scene to the canvas through the wave shader.
	end() {
		const gl = this.gl,
			r = this.resources;

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.BLEND);
		gl.useProgram(r.program);
		gl.bindBuffer(gl.ARRAY_BUFFER, r.buffer);
		gl.enableVertexAttribArray(r.position);
		gl.vertexAttribPointer(r.position, 2, gl.FLOAT, false, 0, 0);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, r.texture);
		gl.uniform1i(r.uniforms.scene, 0);
		gl.uniform1f(r.uniforms.progress, this.progress);
		gl.uniform1f(r.uniforms.aspect, r.width / r.height);
		gl.uniform2f(r.uniforms.origin, this.settings.originX / 100, this.settings.originY / 100);

		// originX / originY have no uniform of their own, so they are skipped here.
		for (const [key, value] of Object.entries(this.settings))
			if (r.uniforms[key]) gl.uniform1f(r.uniforms[key], value);

		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}

	// Frees every GL resource; `create()` runs again if the pass is needed later.
	dispose() {
		const r = this.resources;
		if (!r) return;

		const gl = this.gl;
		gl.deleteProgram(r.program);
		gl.deleteBuffer(r.buffer);
		gl.deleteTexture(r.texture);
		gl.deleteFramebuffer(r.framebuffer);
		gl.deleteRenderbuffer(r.depth);
		this.resources = null;
	}
}
