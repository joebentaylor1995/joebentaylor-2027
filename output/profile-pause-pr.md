Opening Profile over Projects previously left the ribbon, All Projects grid, and video decoders running underneath it. Covered page scenes now stop rendering and playing media until the modal's closing animation finishes, then resume with their position preserved.

The same pause state covers Home animations, native and consent-gated YouTube video, case-study footer effects, and page scrolling. Ribbon readiness now follows its first actual rendered frame so opening Profile during preloading cannot leave an unpainted renderer marked ready.

Validation:
- Type checking, lint, and the production build pass.
- 28 distinct targeted browser checks passed across development and production runs, including desktop/tablet/mobile ribbon playback, the grid, modal lifecycle, case studies, navigation, portrait continuity, and preloading.
- The grid reproduction went from 1,275 background draw calls and five playing videos in 700 ms to zero background draws and zero playing videos while Profile is open.

CI baseline: the existing full Playwright suite fails on main ([run 39226134700](https://github.com/joebentaylor1995/joebentaylor-2027/actions/runs/39226134700)); its build step passes. The targeted coverage above was exercised locally against configured CMS content.
