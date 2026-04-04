# CLAUDE.md

Static band website for Heel, hosted at heel-site. No build system, no package manager, no dependencies.

## Development

Open `index.html` directly in a browser. To preview locally:

```bash
python3 -m http.server 8000
```

## Architecture

- `index.html` — home page, promotes Segmentation album
- `listen.html` — streaming links (Spotify, Apple Music, Bandcamp)
- `watch.html` — YouTube links (release show + visualizers)
- `socials.html` — social media links
- `shows.html` — upcoming shows (plain text, no links)
- `styles.css` — shared styles for all pages

### Visual style

Windows 9x/XP window chrome (gray, raised borders, blue gradient title bar) floating on a dark background. Terminal content area: black with neon green (`#33ff33`) monospace text. Inspired by the Segmentation album back cover.

### Adding content

- **New link on an existing page**: add a `<li>` inside `.link-list` in the relevant HTML file.
- **New nav section**: add a new HTML file following the same window/menu-bar/content structure, and add an `<a>` to the `.menu-bar` in all pages.
- **New show**: add a `<div class="show-item">` in `shows.html`.

### Visitor counter

`index.html` has a placeholder in `.counter-area`. Replace the `<span>` with an embed code from a free counter service (e.g. hitwebcounter.com).
