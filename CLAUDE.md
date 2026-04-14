# CLAUDE.md

Static band website for Heel, hosted at heel-site. No build system, no package manager, no dependencies.

## Development

Open `index.html` directly in a browser. To preview locally:

```bash
python3 -m http.server 8000
```

## Architecture

Three files plus assets:

- `index.html` — HTML structure only: window chrome, terminal UI, all app windows
- `app.js` — all JavaScript logic (IIFE)
- `styles.css` — all styles

### Assets

- `images/album_front_cover.png` — shown by `fetch --new-releases`
- `images/album_back_cover.png` — referenced by the `segmentation` commands (tracklist, credits)
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

**`VIDEOS`** — array of `{ id, file, href }` for YouTube-linked video files.

### Directory system

`DIR_CHILDREN` maps each `currentDir` key to its valid children. `DIR_PARENTS` maps back up. Multi-segment paths (`cd users/andres`) are supported. `currentDir` values: `root`, `users`, `music`, `video`, `merch`, `music/segmentation`, `music/unreleased`, and member names (`adharsh`, `tayla`, `nick`, `andres`).

Note: the directory is `video` (singular), not `videos`.

### `execute(raw, silent, absolute)`

The core command dispatcher. Key behaviours:
- **Hierarchy check**: single-segment `cd` commands validate that the target is a child of `currentDir` in `DIR_CHILDREN`. This prevents navigating to sibling/parent dirs by name.
- **`absolute = true`**: bypasses the hierarchy check entirely. Always pass this when navigating programmatically from GUI windows (desktop icons, explorer clicks, app open functions), so navigation works regardless of where the terminal currently sits.
- **`silent = true`**: suppresses printing the prompt echo line.

### Commands

| Command | Output |
|---|---|
| `help` | Command list |
| `about` / `cat about.txt` | Band description (typewriter) |
| `fetch --new-releases` | Album art + release info |
| `fetch --upcoming-shows` | Show dates |
| `fetch --socials` | Instagram + booking email |
| `stream --heel` | Spotify / Apple Music / Bandcamp |
| `watch --all` | YouTube links |
| `cd <dir>` | Navigate filesystem (supports `cd users/andres`) |
| `cd ..` | Go up one level |
| `ls` | Directory listing |
| `play <track>` | Play a track by name |
| `pause` / `resume` / `stop` | Audio controls |
| `buy <item>` | Open Square checkout |
| `clear` | Clear terminal |
| `segmentation tracklist` | Track listing (1–10) |
| `segmentation band` | Band member names |
| `segmentation produced_mixed_by` | Producer / mixer credits |
| `segmentation engineered_by` | Engineer credit |
| `segmentation mastered_by` | Mastering credit |
| `segmentation cover_by` | Cover art credit |
| `segmentation thank_you` | Thank-you list |
| `sudo rm -rf` / `delete system32` | Attempts to close the tab |
| `cat cat` | Prints a random cat face emoticon |

Member file commands (context-sensitive to current member dir):
- `cat profile.txt` / `profile` / `./profile.txt` — types out bio
- `cat gear.txt` / `gear` / `./gear.txt` — types out gear list (if member has gear)
- `cat data.txt` / `data` / `./data.txt` — types out likes/data (if member has data)
- `./photo.jpg` / `cat photo.jpg` / `open photo` — reveals member photo with scanline animation

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

The terminal window sits on a Win9x desktop. Additional layers:

**Taskbar** (`#taskbar`) — pinned to the bottom. Contains:
- Start button (`#start-btn`) — toggles the start menu
- Task area (`#taskbar-tasks`) — two static buttons always present: `HL-DOS.exe` and `weltamp.exe`; other app windows append their own buttons dynamically when opened and remove them on close. Clicking a taskbar button restores the window if minimized and brings it to front — it does not toggle minimize.
- Tray (`#taskbar-tray`) — visitor count (from GoatCounter) + live clock

**Start menu** (`#start-menu`) — appears above taskbar on Start click. Has a vertical "HEEL" sidebar and buttons that fire terminal commands directly (`data-cmd` attribute). Clicking outside dismisses it.

**Desktop icons** (`#desktop-icons`) — rendered dynamically from the `desktopDirs` array `['users', 'merch', 'music', 'video']`. Each icon has a CSS class for its graphic:
- `users` → `.folder-icon` (Win9x yellow folder)
- `merch` → `.globe-icon` (CSS blue sphere with latitude/longitude lines)
- `music` → `.app-icon` (grey disc with ♪)
- `video` → `.vlc-icon` (orange traffic cone)

Double-clicking a desktop icon opens its app window AND navigates the terminal using `execute('cd <dir>', false, true)` (absolute mode). Icons highlight when their directory is active in the terminal.

**Window dragging** — all `.window` elements are draggable via their `.title-bar`. Constrained to viewport bounds. `body.dragging` class applied during drag to suppress text selection.

**Window focus / z-index** — managed by `vlcBringToFront(focused)`. Uses a global `zTop` counter (starts at 25): each call increments `zTop` and assigns it only to the focused window. Other windows keep their current z-index, preserving natural stacking order. Registered for: `terminal`, `player`, `vlc`, `merch`, `explorer`.

**Visitor counter** — fetched from GoatCounter on page load, stored in `visitorCount`. Displayed in the tray and also surfaced during the boot sequence as a `detect` line.

## App Windows

Four floating Win9x-style windows sit on the desktop alongside the terminal. All are draggable, minimizable (title bar `_` button collapses body, taskbar button toggles), and closeable (taskbar button removed on close). Each appends/removes its own taskbar button.

### weltamp.exe — music player
- Element: `#player-window` / `.player-window`
- Starts hidden (`display:none`). Opened by: `openPlayer()` — double-clicking the music desktop icon, or clicking the persistent `weltamp.exe` taskbar button when the player is closed
- Contains: LCD track display, progress bar, prev/play/stop/next controls, album tabs (Segmentation / Demos), playlist
- Taskbar button (`#task-weltamp`) is static in the HTML (always visible). Active when player is open, inactive when closed.

### HLC.exe — video player
- Element: `#vlc-window` / `.vlc-window`
- Opened by: `openVlc(videoId, title)` — double-clicking video desktop icon, clicking a video dirlink in the terminal, or typing a `.mp4` filename
- Contains: YouTube embed (privacy-enhanced), drag overlay, playback controls, progress bar
- Also navigates terminal to `cd video` on open
- Taskbar label: `HLC.exe`

### internet.exe — merch browser
- Element: `#merch-window` / `.merch-window`
- Opened by: `openMerchBrowser()` — double-clicking the merch desktop icon or typing `buy <item>`
- Styled as Internet Explorer with Back/Forward/Home toolbar and address bar (`http://www.heelband.com/store/`)
- Title bar: `HEEL Online Store - Internet Explorer`
- Contains a grid of merch items; clicking one opens the item detail view
- Taskbar label: `internet.exe`

### explorer.exe — Welt Explorer (users folder)
- Element: `#explorer-window` / `.explorer-window`
- Opened by: `openExplorer()` — double-clicking the users desktop icon
- Title bar: `users - Welt Explorer` (updates to `<name> - Welt Explorer` when inside a member folder)
- Toolbar: Back button + address bar (`C:\heel\users\`)
- **Two views**:
  - **Users view**: shows 4 member folder icons; double-clicking navigates into that member
  - **Member view**: shows that member's files (`photo.jpg`, `profile.txt`, optionally `gear.txt` / `data.txt`); double-clicking a file focuses the terminal and runs the file command
- **Bidirectional terminal sync**: `updateExplorerState()` is called from `updatePrompt()` on every navigation. If the explorer is open and `currentDir` is `users` or a member name, the explorer re-renders to match. This means typing `cd andres` in the terminal also updates the explorer.
- **Back button**: runs `cd ..` in terminal (which sets `currentDir` back to `users`)
- **Opening**: calls `execute('cd users', false, true)` to navigate terminal; also renders users view directly
- **IMPORTANT**: `explorerStatusEl` (`#explorer-status`) must exist in the HTML. If it's missing, `explorerRenderUsers()` throws a TypeError inside `updatePrompt()`, silently breaking `cd users` terminal output.
- Taskbar label: `explorer.exe`

## Boot sequence

BIOS text → driver loading → progress bar → HEEL ASCII animation → `-- WELCOME --` → `[ press any key ]` gate → clear → prompt. On mobile, auto-runs `help` after the gate. `localStorage` is not used — boot runs every visit. Minimizing the terminal while maximized automatically un-maximizes (restoring desktop icons).

## Terminal close behavior

- **Desktop**: `×` button hides the terminal window (not jumpscare); `HL-DOS.exe` taskbar button remains and reopens it.
- **Mobile**: `×` button hides the terminal and returns to the mobile home screen (desktop icons).

## Jumpscare

`#jumpscare` is a standalone `position: fixed` Win9x-style window (680×480px, centered, `z-index: 9999`), independent of the terminal. Triggered by:
- Start menu → Shut Down...

Plays `sounds/jumpscare.mp3`, auto-dismisses after 1.5s, or click/`×` to dismiss early.

## Easter eggs

- `cat cat` — prints a random cat face emoticon
- `sudo rm -rf` / `sudo rm -rf /` / `delete system32` — calls `window.close()` (browser may block)
