# Whisper WebGPU (TypeScript)

Real-time in-browser speech recognition using Whisper and WebGPU, written in TypeScript.

This is a TypeScript version of the original `webgpu-whisper` example, with full type safety and better IDE support.

## Features

- 🎙️ Real-time speech recognition
- 🌐 Runs entirely in the browser (no server required)
- ⚡ Powered by WebGPU for fast inference
- 🔒 Private - all processing happens locally
- 🌍 Multi-language support (99+ languages)
- 📝 Fully typed with TypeScript

## Getting Started

### Install dependencies

```bash
npm install
```

### Run development server

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

## Tech Stack

- **Transformers.js** for running Whisper models
- **WebGPU** for accelerated inference
- **Vite** for fast development and building
- **Tailwind CSS** for styling

## How it works

1. The app loads the Whisper-base model (~200MB) from Hugging Face
2. It requests microphone access and starts recording audio
3. Audio is continuously processed and transcribed in real-time
4. All processing happens in a Web Worker to keep the UI responsive
5. Results are streamed back and displayed as they're generated

## Browser Support

Requires a browser with WebGPU support:

- Chrome/Edge 113+
- Safari/iOS 16.4+ (experimental)

## License

Same as the parent Transformers.js project.
