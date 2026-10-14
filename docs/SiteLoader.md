# Global loader concepts

Open `/?loaderConcepts` to compare ten logo entrances. The chooser supports replay,
half speed, skip, and a collapsed view. These are concept previews; none is selected
as the production entrance. Normal visits do not import the gallery.

`SiteLoader` lives in the shared site layout, outside page content and the scrolling
container. The animation uses the existing Logo, `--brand-c4` and `--global-white`.
It does not import or depend on the homepage hero.

Pages can listen for `site-loader:prepare` and `site-loader:reveal` to reset and start
their own entrance. The homepage adapter coordinates its ripple and text entrance;
other pages can implement their own adapter or simply appear behind the reveal.
Reduced motion uses a short fade.

After a concept is selected, connect the chosen entrance to initial page readiness
and remove the comparison UI from that path. Keep the full loader for the initial
visit and use the existing page transitions during navigation. Asset readiness and
first-visit policy are deliberately not simulated by the concept gallery.
