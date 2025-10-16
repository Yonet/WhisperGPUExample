export class AudioVisualizer {
    private canvas: HTMLCanvasElement;
    private audioContext: AudioContext | null = null;
    private animationId: number | null = null;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }

    setStream(stream: MediaStream | null): void {
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        if (stream) {
            this.visualize(stream);
        }
    }

    private visualize(stream: MediaStream): void {
        const audioContext = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
        this.audioContext = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);

        const canvasCtx = this.canvas.getContext('2d');
        if (!canvasCtx) return;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const drawVisual = () => {
            this.animationId = requestAnimationFrame(drawVisual);
            analyser.getByteTimeDomainData(dataArray);

            canvasCtx.fillStyle = 'rgb(255, 255, 255)';
            canvasCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            canvasCtx.lineWidth = 2;
            canvasCtx.strokeStyle = 'rgb(0, 0, 0)';
            canvasCtx.beginPath();

            const sliceWidth = this.canvas.width * 1.0 / bufferLength;

            let x = 0;
            for (let i = 0; i < bufferLength; ++i) {
                const v = dataArray[i] / 128.0;
                const y = v * this.canvas.height / 2;

                if (i === 0) {
                    canvasCtx.moveTo(x, y);
                } else {
                    canvasCtx.lineTo(x, y);
                }

                x += sliceWidth;
            }

            canvasCtx.lineTo(this.canvas.width, this.canvas.height / 2);
            canvasCtx.stroke();
        };

        drawVisual();
    }

    destroy(): void {
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
    }
}
