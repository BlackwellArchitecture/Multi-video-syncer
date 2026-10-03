# Multi-video-syncer

A high-performance, dark-themed utilitarian desktop and web application for synchronizing multiple local video feeds (such as 1080p 60fps 4GB+ gameplay recordings from multiple players in the same match, security camera feeds, or multi-angle event POVs).

Inspired by ViewSync, featuring frame-by-frame anchor calibration, sub-frame drift management, and an interactive master timeline scrubber.

---

## Why This Architecture (Solving 4GB 1080p 60fps Playback Stutter)

When opening 4GB 1080p 60fps recordings in a standard web browser:
1. **Zero-RAM Disk Range-Streaming Protocol (`media-stream://`)**: Rather than loading multi-gigabyte video files into browser memory via blob URLs (which triggers severe RAM exhaustion, garbage collection freezes, and slow seek times), the desktop application streams only the active 2MB–4MB byte ranges directly from your SSD/HDD on demand via HTTP 206 range requests. It consumes virtually zero RAM.
2. **Direct3D 11/12 GPU Zero-Copy Hardware Acceleration**: Forces GPU video decoding (NVDEC, Intel QuickSync, AMD AMF) through Chromium flags (`--enable-zero-copy`, `--enable-gpu-rasterization`, `--ignore-gpu-blocklist`, `--enable-hardware-overlays`), allowing multiple concurrent 1080p 60fps streams to play simultaneously without dropped frames.
3. **Event-Driven Anchor Synchronization**: Instead of executing continuous per-frame hard seeks that flush the GPU decoder buffer 60 times a second, the synchronization engine locks to the primary video feed's hardware presentation clock and only re-anchors on interaction events (play, pause, scrub release, frame stepping).

---

## Features

- **Multi-Video Input**: Load any number of local video files via native OS file dialog or drag-and-drop. Supports `.mp4`, `.webm`, `.mkv`, `.mov`, `.avi`, and `.ts` containers.
- **Frame-by-Frame Precision Anchor Calibration**:
  - Calibrate the start synchronization point of each video down to the exact millisecond and frame.
  - Stepping controls: `-5s`, `-1s`, `-1F`, `Play/Pause`, `+1F`, `+1s`, `+5s`.
  - Mouse wheel frame stepping: Roll your mouse wheel over any video viewport to step forward or backward frame-by-frame.
  - Direct timecode input: Type an exact timestamp (`HH:MM:SS.mmm` or seconds) and press Enter to jump.
  - "SET ANCHOR HERE" locks the reference sync event ($T = 0$).
  - "JUMP ANCHOR" quickly inspects the saved anchor point.
- **Multi-View Security Camera (CCTV) Wall**:
  - Grid layouts: `AUTO`, `1x2`, `2x1`, `2x2`, and `3x2`.
  - On-Screen Display (OSD): Overlays camera tags (`CAM 01: Player A`), live timecodes, frame counters, and status badges.
  - Feed Maximization: Click the maximize button on any camera cell to inspect that POV full-screen, and click again to return to the grid.
  - Out-of-Bounds Feed Protection: Feeds that started after or ended before the anchor point display clean standby/ended indicators without desynchronizing active feeds.
- **Master Control Timeline**:
  - Real-time scrubbing across all active video feeds simultaneously with throttled requestAnimationFrame seeking.
  - Settles and re-anchors on release (`pointerup`).
  - Displays relative offset time from anchor (`+00:01:24.500`) and relative frame offset.
  - Visual Anchor marker ($T = 0$) and video duration coverage bands.
  - Variable playback speed (`0.25x`, `0.5x`, `0.75x`, `1.0x`, `1.25x`, `1.5x`, `2.0x`).
  - Loop playback toggle.
  - Manual Force Resync button and shortcut (<kbd>R</kbd>).
- **Audio Routing**:
  - Solo listen to any camera feed (`CAM 1`, `CAM 2`, etc.), listen to all feeds, or mute all with a master volume slider to prevent deafening audio overlaps.
- **Session Config Export / Import**:
  - Save and load synchronization sessions as JSON (`anchorTime`, FPS, camera labels, file paths). In the desktop application, importing a session configuration automatically reloads the video files directly from disk.
- **Built-in Synthetic Test Feeds**:
  - "LOAD TEST FEEDS" generates synthetic test recordings with synchronized match countdowns and flash events for instant testing without needing local footage.

---

## Keyboard Shortcuts

### Multi-View Watch Mode
| Key | Action |
| --- | --- |
| `Space` | Play / Pause all videos in sync |
| `Left Arrow` | Step backward 1 frame |
| `Right Arrow` | Step forward 1 frame |
| `J` | Step backward 1 second |
| `L` | Step forward 1 second |
| `A` or `Home` | Snap master clock to Anchor ($T = 0$) |
| `R` | Force instant re-anchor synchronization |
| `M` | Toggle mute / solo audio |
| `F` | Toggle fullscreen monitor |

### Anchor Calibration Mode
| Key | Action |
| --- | --- |
| `Space` | Play / Pause hovered video preview |
| `Left Arrow` | Step hovered video backward 1 frame |
| `Right Arrow` | Step hovered video forward 1 frame |
| `Mouse Wheel` | Scroll over video to step frame-by-frame |
| `J` / `L` | Step hovered video backward / forward 1 second |
| `A` | Set anchor timestamp at current position |

---

## Setup & Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher recommended)
- npm (bundled with Node.js)

### Installation
Clone the repository and install dependencies:

```bash
git clone https://github.com/BlackwellArchitecture/Multi-video-syncer.git
cd Multi-video-syncer
npm install
```

### Running the Application

#### Option 1: Desktop Application (Recommended for 4GB 1080p 60fps files)
On Windows, double-click:
```
run-app.bat
```
Or start via terminal:
```bash
npm start
```

#### Option 2: Browser Fallback
You can also open `index.html` directly in modern web browsers (Chrome, Edge, Firefox, Brave):
```bash
# Python static server
python -m http.server 8080

# Or Node.js serve
npx serve .
```

---

## Project Structure

```
├── index.html            # Main UI structure and layout
├── main.js               # Electron main process (GPU switches, media-stream protocol, IPC)
├── preload.js            # Secure context bridge for native dialogs
├── package.json          # Application configuration and dependencies
├── run-app.bat           # Windows one-click desktop launcher
├── css/
│   └── styles.css        # Dark utilitarian CCTV theme and responsive grid
└── js/
    ├── app.js            # Main application controller and UI state
    ├── sync-engine.js    # Master virtual clock and event-driven sync engine
    ├── video-item.js     # Video entity model and frame calculation helpers
    ├── demo-generator.js # In-browser synthetic test clip generator
    └── icons.js          # SVG vector icons (strictly zero emojis)
```

---

## License

ISC License.
