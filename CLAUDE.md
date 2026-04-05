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
- `images/album_back_cover.png` — unused
- `images/RussianSleepExperimentGuy.png` — jumpscare image
- `images/users/<name>/` — member photo (one PNG per member, displayed as `photo.jpg` in-terminal)
- `sounds/jumpscare.mp3` — jumpscare audio
- `sounds/music/segmentation/` — 10 MP3s for the Segmentation album
- `sounds/music/unreleased/` — unreleased tracks

## Visual style

Windows 9x/XP window chrome (gray, raised borders, blue gradient title bar) on a teal (`#008080`) desktop background. Terminal content area: black with neon green (`#33ff33`) monospace text. Prompt mimics PowerShell: `PS C:\heel>`. Inspired by the Segmentation album back cover.

## How the terminal works

All content lives in the `COMMANDS` object in `index.html`. Each key is a command string; each value is a function returning an array of line descriptors. The `render()` function converts descriptors to DOM elements; `printLines()` animates them into `#output` with staggered delays.

### Registries

**`MEMBERS`** — one entry per band member:
```javascript
'andres': {
    instrument: 'drums',
    profile: '...',   // text for profile.txt (typewriter effect); null = falls back to instrument line
    gear: '...',      // newline-separated text for gear.txt; omit if none
    data: '...',      // newline-separated text for data.txt; omit if none
    photo: 'images/users/andres/andres_gonzalez.png',  // actual file path
    photoName: 'andres_gonzalez.png',                  // used internally; displayed as photo.jpg
}
```

**`TRACKS`** — keyed by album slug (`segmentation`, `unreleased`), each an array of `{ id, label, file }`.

**`MERCH`** — array of `{ id, href }`. Spaces and underscores in `buy` queries are treated the same.

### Directory system

`DIR_CHILDREN` maps each `currentDir` key to its valid children. `DIR_PARENTS` maps back up. Multi-segment paths (`cd users/andres`) are supported. `currentDir` values: `root`, `users`, `music`, `merch`, `music/segmentation`, `music/unreleased`, and member names (`adharsh`, `tayla`, `nick`, `andres`).

### Commands

| Command | Output |
|---|---|
| `help` | Command list |
| `about` / `cat about.txt` | Band description (typewriter) |
| `fetch --new-releases` | Album art + release info |
| `fetch --upcoming-shows` | Show dates |
| `fetch --social` | Instagram + booking email |
| `stream --heel` | Spotify / Apple Music / Bandcamp |
| `watch --all` | YouTube links |
| `cd <dir>` | Navigate filesystem (supports `cd users/andres`) |
| `cd ..` | Go up one level |
| `ls` | Directory listing |
| `play <track>` | Play a track by name |
| `pause` / `resume` / `stop` | Audio controls |
| `buy <item>` | Open Square checkout |
| `clear` | Clear terminal |

Member file commands (context-sensitive to current member dir):
- `cat profile.txt` / `profile` — types out bio
- `cat gear.txt` / `gear` — types out gear list (if member has gear)
- `cat data.txt` / `data` — types out likes/data (if member has data)
- `photo.jpg` / `cat photo.jpg` / `open photo` — reveals member photo with scanline animation

Tab completion and arrow-key command history are supported. Typos auto-correct to the closest match (shown with a dim `→` hint).

### Line descriptor types

- `blank` — vertical spacer
- `text` — plain output line (`dim`, `center`, `spaced` props)
- `hrow` / `hrow-parent` / `hrow-sub` — help menu rows
- `prompt` — echoed input line
- `error` — unrecognized command message
- `link` — clickable dotted row (platform … handle), opens URL
- `nolink` — same layout, not a link
- `album` — album cover image + listen caption
- `dirlink` — clickable filesystem entry, runs a command on click
- `typewriter` — text that types out character by character (~14ms/char)
- `img-reveal` — image that reveals scanline by scanline from top (150px wide, pixelated)
- `ascii-anim` — text revealed character by character across all rows simultaneously
- `progress` — animated loading bar
- `detect` / `driver` — boot sequence animated lines

### Adding content

- **New command**: add a key/function to `COMMANDS`, add an `hrow` to the `help` return array.
- **New show date**: add `{ t: 'nolink', label: 'mmm dd', value: 'city — venue' }` to `fetch --upcoming-shows`.
- **New member file**: add a field to the member's `MEMBERS` entry, add a conditional `dirlink` in both `dirListing()` and `memberLines()`, add a `cat <file>.txt` command + aliases.
- **New merch item**: add `{ id, href }` to `MERCH`, add a `link` descriptor in the merch `dirListing()` block.
- **New track**: add `{ id, label, file }` to the appropriate `TRACKS` array.

## Desktop UI

The terminal window sits on a Win9x desktop with three additional UI layers:

**Taskbar** (`#taskbar`) — pinned to the bottom. Contains:
- Start button (`#start-btn`) — toggles the start menu
- Task area (`#taskbar-tasks`) — one static button `heel.exe` (always active)
- Tray (`#taskbar-tray`) — visitor count (from GoatCounter) + live clock

**Start menu** (`#start-menu`) — appears above taskbar on Start click. Has a vertical "HEEL" sidebar and buttons that fire terminal commands directly (`data-cmd` attribute). Clicking outside dismisses it.

**Desktop icons** (`#desktop-icons`) — rendered dynamically from a `DESKTOP_ICONS` array, each `{ label, icon, cmd }`. Clicking an icon runs its `cmd` in the terminal. Icons deselect on outside click.

**Window dragging** — the `.window` element is draggable via its `.title-bar`. Constrained to viewport bounds. `body.dragging` class applied during drag to suppress text selection.

**Visitor counter** — fetched from GoatCounter on page load, stored in `visitorCount`. Displayed in the tray and also surfaced during the boot sequence as a `detect` line.

## Boot sequence

BIOS text → driver loading → progress bar → HEEL ASCII animation → `-- WELCOME --` → `[ press any key ]` gate → clear → prompt. On mobile, auto-runs `help` after the gate. Uses `localStorage` is not implemented — boot runs every visit.

## Easter egg

Clicking the `×` title-bar button triggers a jumpscare: white flash, then `RussianSleepExperimentGuy.png` expands from the top-right with `jumpscare.mp3`. Clicking dismisses it.
