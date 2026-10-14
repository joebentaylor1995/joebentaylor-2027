# Global loader

The shared site layout renders the pulse loader on each initial document load.
Client-side navigation keeps that layout and does not replay the loader. There
are no preview concepts, query switches or chooser controls.

The existing Logo is white on brand-c4, at 120px maximum width (22vw on small
screens). It stays stationary while a single expanding wave masks it away and
reveals the page. Reduced motion uses a short fade.

The loader waits for fonts and eager/high-priority images to decode, with a
1.5-second deadline. A CSS failsafe hides the overlay after six seconds if
hydration fails; JavaScript-disabled visits hide it immediately.

Pages can use isLoaderPending() and site-loader:reveal to coordinate their
entrances. The homepage pauses its intro until that signal; pages mounted after
the initial reveal start immediately. The loader has no dependency on the hero.
