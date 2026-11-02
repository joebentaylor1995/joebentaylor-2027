'use strict';

// Export
// ------------
// Adds the "Hide UI" switch and the 3x PNG export to the settings panel, with the H and E
// shortcuts. Loaded last: it uses `canvas`, `ready`, `raf`, `exportPixelRatio`, `render`,
// `requestRender` and `gridView` from app.js.

// Controls
// ------------
const exportControls = document.createElement('div');
exportControls.innerHTML =
	'<label class="switch-row">Hide UI <input id="hide-ui" type="checkbox"></label>' +
	'<p class="grid-note">Press H or tap with two fingers to restore UI.</p>' +
	'<div class="panel-actions"><button id="export-retina" type="button">Export 3× PNG</button></div>' +
	'<p class="grid-note" id="export-status">Exports the canvas only, without UI.</p>';
document.querySelector('#settings .panel-actions').before(exportControls);

// Hide UI
// ------------
const hideUIControl = document.querySelector('#hide-ui');

function hideInterface(hidden) {
	document.body.classList.toggle('hide-interface', hidden);
	hideUIControl.checked = hidden;
}

hideUIControl.onchange = () => hideInterface(hideUIControl.checked);

window.addEventListener('keydown', e => {
	if (e.key.toLowerCase() === 'h' && !e.metaKey && !e.ctrlKey && !['INPUT', 'TEXTAREA'].includes(e.target.tagName))
		hideInterface(!hideUIControl.checked);
	if (e.key === 'Escape' && hideUIControl.checked) hideInterface(false);
});

// A two-finger tap on the canvas brings the UI back (touch has no H key).
canvas.addEventListener(
	'touchstart',
	e => {
		if (e.touches.length === 2 && hideUIControl.checked) hideInterface(false);
	},
	{ passive: true }
);

// PNG export
// ------------
document.querySelector('#export-retina').onclick = () => {
	const status = document.querySelector('#export-status');
	if (!ready) {
		status.textContent = 'Wait for projects to finish loading.';
		return;
	}

	try {
		// Stop the loop, draw one frame at 3x pixel ratio, then read the canvas back.
		cancelAnimationFrame(raf);
		raf = 0;
		exportPixelRatio = 3;
		render(performance.now());

		const link = document.createElement('a');
		link.download = `${gridView?.target ? 'all-projects' : 'featured'}-${innerWidth * 3}x${innerHeight * 3}.png`;
		link.href = canvas.toDataURL('image/png');
		link.click();
		status.textContent = `Exported ${canvas.width} × ${canvas.height} PNG.`;
	} catch (error) {
		status.textContent = 'Could not export: ' + error.message;
	} finally {
		// Back to the normal pixel ratio and restart the render loop.
		exportPixelRatio = 0;
		requestRender();
	}
};

// Everything except the canvas is hidden while `hide-interface` is set on the body.
const exportStyle = document.createElement('style');
exportStyle.textContent = 'body.hide-interface > :not(canvas):not(script):not(style){visibility:hidden!important}';
document.head.append(exportStyle);

// E exports, unless a modifier is held or a text field has focus.
window.addEventListener('keydown', e => {
	if (
		e.key.toLowerCase() === 'e' &&
		!e.metaKey &&
		!e.ctrlKey &&
		!e.altKey &&
		!['INPUT', 'TEXTAREA'].includes(e.target.tagName)
	)
		document.querySelector('#export-retina').click();
});
