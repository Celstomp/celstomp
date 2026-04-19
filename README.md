# Celstomp

<img width="1920" height="884" alt="image" src="https://github.com/user-attachments/assets/caa9c566-00fc-40dc-9a9c-0eac762d1bee" />


A 2D animation web application built with HTML, CSS, and JavaScript.

## About

Celstomp is a browser-based animation tool designed for traditional frame-by-frame animation. The project started as a personal project to make animation more accessible.

I come from an art background and built this while learning to code.

## Live Site

**Official site:** https://ginyo.space/celstomp/  
**Development testing site:** https://celstomp-indev.nichesite.org/

## Features

- **Canvas**: Configurable aspect ratios (16:9 default), zoom/pan with scroll or pinch
- **Timeline**: Frame-by-frame grid, drag cels, multi-select
- **Tools**: Brush (shape + pressure options), Eraser, Fill Brush, Fill Eraser, Lasso, Rect Select, Eyedropper
- **Layers**: LINE, SHADE, COLOR, FILL, PAPER - with swatches, reordering, opacity, and blend modes. Solo layer mode available.
- **Onion Skin**: Preview prev/next frames (adjustable colors/opacity)
- **Color Picker**: Optional triangle picker mode
- **Palette**: Save/Load palettes, Import/Export JSON support
- **Shortcuts**: Comprehensive keyboard shortcuts (Press `?` in app for list)
- **UI**: Font switcher and dock/island layout
- **Tutorial**: Built-in guided tour with replay
- **Safety**: Unsaved changes protection
- **Export**: MP4 video, GIF, or image sequence
- **Save/Load**: Project files in JSON format

## Credits!!

| Person | Role | Links |
|---|---|---|
| <img src="https://github.com/ginyoa.png?size=80" width="48" height="48" style="border-radius:999px;" /> <br> **Ginyoa** | Project Lead, Creator, Concept Artist | [GitHub](https://github.com/ginyoa) · [Website](https://ginyo.space/) |
| <img src="https://github.com/immalloy.png?size=80" width="48" height="48" style="border-radius:999px;" /> <br> **ImMalloy** | Brush system remake, side panel integration, QoL fixes | [GitHub](https://github.com/ImMalloy) · [Website](https://immalloy.nichesite.org/) · [Play Your Little Oyachi!](https://oyachigame.nichesite.org/) |
| <img src="https://github.com/Microck.png?size=80" width="48" height="48" style="border-radius:999px;" /> <br> **Microck** | GIF export, layer blend modes, tutorial replay, reliability/UX fixes | [GitHub](https://github.com/Microck) · [Website](https://micr.dev/) |
| <img src="https://github.com/IvBautistaS.png?size=80" width="48" height="48" style="border-radius:999px;" /> <br> **IvBautistaS** | Refactored HTML, JavaScript, and CSS | [GitHub](https://github.com/IvBautistaS) |
| <img src="https://github.com/hingler.png?size=80" width="48" height="48" style="border-radius:999px;" /> <br> **hingler** | Refactored monolith into modular supporting scripts | [GitHub](https://github.com/hingler) |
| <img src="https://github.com/Manuel-AAR.png?size=80" width="48" height="48" style="border-radius:999px;" /> <br> **Manuel-AAR** | Added brush icons and basic brush shapes | [GitHub](https://github.com/Manuel-AAR) |
| <img src="https://github.com/phbragap-creator.png?size=80" width="48" height="48" style="border-radius:999px;" /> <br> **phbragap-creator** | Triangle color picker, island/header overlap fixes | [GitHub](https://github.com/phbragap-creator) |


### Key Shortcuts
- **Tools**: 1-8
- **Navigation**: Arrows, Q/W (Cel), E/R (Frame)
- **Playback**: Space
- **Edit**: Ctrl+Z (Undo), Ctrl+Y (Redo), Del (Clear)
- **Brush**: [ / ] (Size), Shift+Drag (Straight line), Alt (Eyedropper)
- **View**: ? (Cheatsheet), O (Onion), F (Fill)

## Setup

### Running Locally

Clone the repository:

```bash
git clone https://github.com/Celstomp/celstomp.git
cd celstomp
```

#### Using Vite (recommended)

```bash
npm install
npm run dev
```

The dev server will start at http://localhost:5173

To create a production build:

```bash
npm run build
npm run preview   # preview the built output
```

#### Using Python (no Node required)

##### Linux / Mac (Terminal)
```bash
./run-dev.command
```

##### Windows
Double-click `run-dev.bat` or run from command prompt:
```cmd
run-dev.bat
```

##### Mac (Double-click)
Double-click `run-dev.command` in Finder

The Python server will start at http://localhost:8000

### Requirements

**Vite workflow:** Node.js 18+ and npm

**Python workflow:** Python 3.x (most systems have this pre-installed)

**Browser:** Chrome, Firefox, Safari, or Edge

## Contributing

Contributions are welcome! Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
