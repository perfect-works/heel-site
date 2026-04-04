# CLAUDE.md

Static band website for Heel, hosted at heel-site. No build system, no package manager, no dependencies.

## Development

Open `index.html` directly in a browser. To preview locally:

```bash
python3 -m http.server 8000
```

## Architecture

Two files plus assets:

- `index.html` — entire site: window chrome, terminal UI, and all JS logic
- `styles.css` — all styles

### Assets

- `images/album_front_cover.png` — shown by `fetch --new-releases`
- `images/album_back_cover.png` — (unused in UI currently)
- `images/RussianSleepExperimentGuy.png` — jumpscare image
- `sounds/jumpscare.mp3` — jumpscare audio

## Visual style

Windows 9x/XP window chrome (gray, raised borders, blue gradient title bar) on a teal (`#008080`) desktop background. Terminal content area: black with neon green (`#33ff33`) monospace text. Prompt mimics PowerShell: `PS C:\Users\heel>`. Inspired by the Segmentation album back cover.

## How the terminal works

All content lives in the `COMMANDS` object in `index.html`. Each key is a command string; each value is a function returning an array of line descriptors. The `render()` function converts descriptors to DOM elements; `printLines()` animates them into `#output` with staggered delays.

### Commands

| Command | Output |
|---|---|
| `help` | Command list with tree-style subcommands |
| `fetch --new-releases` | Album art + "SEGMENTATION — OUT NOW" |
| `fetch --upcoming-shows` | Show dates (plain, no links) |
| `fetch --social` | Instagram link |
| `stream --heel` | Spotify / Apple Music / Bandcamp links |
| `watch --all` | YouTube links (release show + visualizers) |
| `clear` | Clears terminal output |

Tab completion and arrow-key command history are supported.

### Line descriptor types

- `blank` — vertical spacer
- `text` — plain output line (supports `dim`, `center`, `spaced` props)
- `hrow` / `hrow-parent` / `hrow-sub` — help menu rows (cmd + desc, with tree chars for sub-flags)
- `prompt` — echoed input line
- `error` — unrecognized command message
- `link` — clickable dotted row (platform … handle)
- `nolink` — same layout, not a link
- `album` — album cover image + "CLICK HERE TO LISTEN" caption

### Adding content

- **New command**: add a key/function pair to `COMMANDS` in `index.html`, and add an `hrow` entry to the `help` command's return array.
- **New link in an existing command**: add a `{ t: 'link', label, href, value }` descriptor to the relevant command's return array.
- **New show date**: add a `{ t: 'nolink', label: 'mmm dd', value: 'city — venue' }` to `fetch --upcoming-shows`.

## Easter egg

Clicking the `×` title-bar button triggers a jumpscare: white flash (`#flash-overlay`), then `RussianSleepExperimentGuy.png` expands from the top-right corner with `jumpscare.mp3`. Clicking the image dismisses it.
