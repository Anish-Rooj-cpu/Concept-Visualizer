# Engineering Concepts Visualizer (ECV)

> **"If you can visualize it, you can truly understand it."**

An interactive learning platform that transforms abstract engineering mathematics into intuitive, hands-on visualizations. Stop memorizing formulas — start exploring systems.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Visit%20Site-00c8ff?style=flat-square&logo=github)](https://anish-rooj-cpu.github.io/Concept-Visualizer/)
[![Visualizations](https://img.shields.io/badge/Visualizations-18-7c3aed?style=flat-square)]()
[![Tech](https://img.shields.io/badge/Stack-HTML%20%7C%20CSS%20%7C%20JS-34d399?style=flat-square)]()
[![License](https://img.shields.io/badge/License-MIT-f0abfc?style=flat-square)]()

---

## 🌐 Live Demo

**👉 [anish-rooj-cpu.github.io/Concept-Visualizer](https://anish-rooj-cpu.github.io/Concept-Visualizer/)**

---

## 📸 Overview

ECV covers four engineering domains with 18 fully interactive tools — no static graphs, no frameworks, no paywalls. Each module is built from scratch with a focus on **real-time feedback**, **intuition-first design**, and **zero setup**.

---

## 🗂️ Visualization Modules

### 📊 Control Systems

| Module | Description |
|---|---|
| **Root Locus** | Watch poles migrate across the s-plane as gain K varies. Stability boundaries shown live. |
| **Nyquist Plot** | Analyze closed-loop stability from the open-loop frequency response. Encirclements counted automatically. |
| **Compensator Design** | Compare lead, lag, and lead-lag compensators side by side. Observe Bode plot impact in real time. |
| **State Space** | Explore phase portraits, eigenvectors, and system trajectories for 2nd-order LTI systems. |
| **S–Z Mapping** | Visualize how the s-plane maps to the z-plane under bilinear and impulse-invariant transforms. |
| **PID Controller Tuner** ✨ | Tune Kp, Ki, Kd on multiple plant models. Live step response, error signal, control effort, and performance metrics (rise time, overshoot, settling time, SSE). |

---

### 📡 Signal Processing

| Module | Description |
|---|---|
| **Convolution & Correlation** | Step-by-step sliding animation of discrete convolution and cross-correlation. |
| **Sampling & Aliasing** | Experience the Nyquist theorem interactively — see aliasing happen as sample rate drops. |
| **Fourier Transform** | Build signals from harmonics and decompose waveforms into their frequency spectrum. |
| **Butterfly Structure** | Trace the Cooley–Tukey FFT signal flow graph with twiddle factors highlighted at each stage. |
| **Edge Detection** | Apply Sobel, Prewitt, and Canny operators to images and observe gradient magnitude maps. |
| **FIR Filter Designer** ✨ | Design lowpass, highpass, bandpass, and bandstop filters using the Window Method (Hamming, Blackman, Kaiser, etc.). Live frequency response, phase, impulse response, and window plots. |

---

### 🔄 Transform Domain Analysis

| Module | Description |
|---|---|
| **Laplace Transform** | Place poles and zeros in the s-plane and instantly observe the time-domain step response and stability. |
| **Z Transform** | Explore discrete-time systems via pole-zero placement inside/outside the unit circle. |

---

### 💻 Computer Architecture

| Module | Description |
|---|---|
| **Pipelining** | Animate instruction flow through pipeline stages; visualize hazards, stalls, and compute speedup. |
| **Cache Memory** | Simulate direct-mapped and set-associative caches with configurable address traces. Hit/miss rate analysis. |

---

### ⚡ VLSI / Digital Design

| Module | Description |
|---|---|
| **Static Timing Analysis** | Visualize setup and hold time windows across combinational logic paths. |
| **CMOS Inverter VTC** | Plot the Voltage Transfer Characteristic of a CMOS inverter as W/L ratios and supply voltages change. |

---

## 🎯 Why This Project Exists

Engineering topics are hard because:

- They are **mathematically dense** — equations alone don't build intuition
- System behavior is **dynamic** — a static textbook diagram can't show a pole migrating
- **Visualization is missing** from most curricula

ECV addresses all three by converting equations into visual, interactive tools that let you experiment and observe cause-and-effect in real time.

---

## 🛠️ Tech Stack

```
HTML5      →  Structure & semantics
CSS3       →  Styling, animations, responsive layout
JavaScript →  Simulation logic, Canvas 2D rendering, DSP algorithms
```

**No build tools. No bundlers. No frameworks.** Every visualization runs directly in the browser, making the codebase readable and educational in itself.

Notable implementations:
- **RK4 numerical integration** (PID Controller — closed-loop simulation)
- **DTFT via direct summation** (FIR Filter — 512-point frequency response)
- **Modified Bessel I₀** for Kaiser window (FIR Filter Designer)
- **Canvas 2D API** for all plots and animations
- **IntersectionObserver** for scroll-triggered reveals and animated counters

---

## 📁 Project Structure

```
Concept-Visualizer/
├── index.html              ← Home page (card grid, filtering, hero)
├── styles.css              ← Global design system (dark theme, cards, layout)
├── script.js               ← Home page interactivity (filter, reveal, counters)
├── shared.css              ← Shared design tokens for all inner pages
├── about.html              ← About the project
├── sitemap.xml             ← SEO sitemap
└── pages/
    ├── compensator/        ← Lead/Lag Compensator
    ├── convolution/        ← Convolution & Correlation
    ├── nyquist/            ← Nyquist Plot
    ├── root-locus/         ← Root Locus
    ├── sz-mapping/         ← S–Z Plane Mapping
    ├── sampling-aliasing/  ← Sampling & Aliasing
    ├── pid-controller/     ← PID Controller Tuner ✨
    ├── fir-filter/         ← FIR Filter Designer ✨
    ├── State Space/        ← State Space Visualization
    ├── Pipelining/         ← CPU Pipelining
    ├── Fourier Transform/  ← Fourier Transform
    ├── Laplace Transform/  ← Laplace Transform
    ├── Z Transform/        ← Z Transform
    ├── Butterfly Structure/← FFT Butterfly
    ├── Cache Memory/       ← Cache Simulator
    ├── STA/                ← Static Timing Analysis
    ├── CMOS VTC/           ← CMOS Inverter VTC
    └── Edge Detection/     ← Image Edge Detection
```

Each page folder contains its own `index.html`, `styles.css`, and `script.js`, inheriting shared design tokens from `shared.css` at the root.

---

## 🚀 Getting Started

No installation required. Clone and open directly in a browser:

```bash
git clone https://github.com/anish-rooj-cpu/Concept-Visualizer.git
cd Concept-Visualizer
# Open index.html in any modern browser
```

Or just visit the **[live site](https://anish-rooj-cpu.github.io/Concept-Visualizer/)**.

---

## 🚧 Planned Enhancements

- [ ] **Bode Plot Visualizer** — gain/phase margin directly on the plot
- [ ] **Phase & Gain Margin** — overlay on Nyquist and Bode
- [ ] **IIR Filter Designer** — Butterworth, Chebyshev, elliptic
- [ ] **FSM Simulator** — draw state machines, simulate input sequences
- [ ] **Eigenvalue Visualizer** — linear transforms and their geometric effect
- [ ] **Communication Systems** — AM/FM modulation, constellation diagrams
- [ ] **Pole Assignment / LQR** — full state-feedback controller design
- [ ] **Dark/light theme toggle**

---

## 🤝 Contributing

Contributions are welcome. You can help by:

- **Adding new visualization modules** — follow the `shared.css` design system
- **Improving existing tools** — accuracy, UI, mobile responsiveness
- **Optimizing performance** — Canvas rendering, heavy computation
- **Reporting bugs** — open an issue with browser and steps to reproduce

When adding a new page, add a card to `index.html`, link it in `sitemap.xml`, and use `shared.css` for consistent styling.

---

## 👨‍💻 Author

Built by **Anish Rooj** — Electronics and Telecommunication Engineering student with a focus on Digital Design, Computer Architecture, and System-Level Understanding.

> Build → Visualize → Understand

---

## ⭐ Support

If ECV has helped you understand a concept that confused you before, consider giving the repo a star — it helps others find it.

[![Star on GitHub](https://img.shields.io/github/stars/anish-rooj-cpu/Concept-Visualizer?style=social)](https://github.com/anish-rooj-cpu/Concept-Visualizer)
