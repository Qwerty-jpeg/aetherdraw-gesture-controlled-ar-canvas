# AetherDraw: Gesture-Controlled AR Canvas

[aureliabutton]

AetherDraw is a futuristic, gesture-controlled Augmented Reality (AR) drawing application that transforms your webcam feed into a creative canvas. Leveraging the power of MediaPipe Hands for precise hand tracking and React for a reactive UI, users can draw in the air using simple finger gestures.

The application features an 'Illustrative' design style with sketchy graphics and playful elements, making technology feel human and whimsical.

## ✨ Key Features

- **AR Canvas Layer**: A transparent canvas overlaying the webcam feed where drawing strokes are rendered in real-time based on index finger position.
- **Gesture Recognition Engine**: A dedicated logic layer using MediaPipe to detect specific hand configurations:
  - ☝️ **Index Finger Up**: Draw
  - ✋ **Open Palm**: Eraser / Hover
  - ✌️ **Victory Sign**: Change Color
- **Floating Tool Palette**: A whimsical, sketch-style UI that reacts to gestures, showing current tool status.
- **Smart Smoothing**: Algorithms to smooth out jittery hand movements for clean, artistic strokes.
- **Responsive Layout**: Mobile-first design that works beautifully on desktop and tablets.

## 🛠️ Technology Stack

- **Frontend Framework**: React 18
- **Computer Vision**: MediaPipe Hands (@mediapipe/tasks-vision)
- **Styling**: Tailwind CSS, ShadCN UI
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **State Management**: Zustand
- **Routing**: React Router DOM
- **Build Tool**: Vite
- **Deployment**: Cloudflare Workers

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.0.0 or higher)
- Node.js (v18 or higher)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/aetherdraw-ar-canvas.git
   cd aetherdraw-ar-canvas
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

### Development

Start the development server:

```bash
bun run dev
```

This will start the Vite development server, typically at `http://localhost:5173`.

### Building for Production

To create a production build:

```bash
bun run build
```

## 📦 Deployment

This project is configured for deployment on Cloudflare Workers.

[aureliabutton]

### Manual Deployment

1. Authenticate with Cloudflare:
   ```bash
   npx wrangler login
   ```

2. Deploy the project:
   ```bash
   bun run deploy
   ```

## 🎮 Usage Guide

1. **Allow Camera Access**: When prompted, allow the browser to access your webcam.
2. **Calibrate**: Ensure your hand is clearly visible in the frame.
3. **Draw**: Point your index finger up to start drawing on the screen.
4. **Hover**: Open your palm to stop drawing and move the cursor without leaving a trail.
5. **Change Color**: Show a "Peace" (Victory) sign to cycle through available colors.
6. **Clear Board**: Use the on-screen controls to clear the canvas.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.