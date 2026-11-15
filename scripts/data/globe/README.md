# Globe geography

`countries.geojson` is the Natural Earth 1:50m country dataset, public domain.
Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson

The site never downloads it. `bun run globe` (`scripts/build-globe.ts`) turns it into the globe's vertex buffers and ships them packed as `public/data/globe/geometry.v<format>.bin`; the pre-commit hook and CI fail when that file is stale.

The live globe renderer is adapted from 12-Studio/JBT-globeGL. Its settled orientation preserves the Europe view selected by Joe, with the Doncaster point anchored at the centre of the responsive card.

The blue background in `public/images/map/blue-gradient.png` is the original Figma image asset from file `1NDLbLnn4mmupUNL6dArhZ`, node `4986:26552`. The static globe image in adjacent node `4986:26553` is intentionally replaced by the interactive WebGL globe.
