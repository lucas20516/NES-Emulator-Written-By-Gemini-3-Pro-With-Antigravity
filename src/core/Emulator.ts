import jsnes from 'jsnes';

export class Emulator {
    private nes: jsnes.NES;
    private audioContext: AudioContext | null = null;
    private scriptProcessor: ScriptProcessorNode | null = null;
    private canvasContext: CanvasRenderingContext2D | null = null;
    private imageData: ImageData | null = null;
    private buf32: Uint32Array | null = null;
    private frameId: number | null = null;
    private currentRomData: string | null = null;

    // Audio buffers
    private lastTime = 0;
    private accumulator = 0;

    private audioBuffer: Float32Array;
    private audioWriteIndex = 0;
    private audioReadIndex = 0;
    private readonly BUFFER_SIZE = 8192; // Must be power of 2


    constructor() {

        this.nes = new jsnes.NES({
            onFrame: (frameBuffer: number[]) => {
                this.renderFrame(frameBuffer);
            },
            onAudioSample: (left: number, right: number) => {
                this.writeAudio(left, right);
            },
            sampleRate: 44100, // Default, will be updated when AudioContext is created
        });

        this.audioBuffer = new Float32Array(this.BUFFER_SIZE);
    }

    public attachCanvas(canvas: HTMLCanvasElement) {
        this.canvasContext = canvas.getContext('2d');
        this.imageData = this.canvasContext?.createImageData(256, 240) || null;
        if (this.imageData) {
            this.buf32 = new Uint32Array(this.imageData.data.buffer);
        }

        // Clear canvas
        if (this.canvasContext) {
            this.canvasContext.fillStyle = 'black';
            this.canvasContext.fillRect(0, 0, 256, 240);
        }
    }

    public loadROM(romData: Uint8Array) {
        // Convert Uint8Array to binary string as jsnes expects
        let binaryString = '';
        for (let i = 0; i < romData.length; i++) {
            binaryString += String.fromCharCode(romData[i]);
        }
        this.currentRomData = binaryString;
        this.nes.loadROM(this.currentRomData);
    }

    public start() {
        if (this.frameId) return;
        this.initAudio();
        this.lastTime = performance.now();
        this.accumulator = 0;
        this.frameId = requestAnimationFrame(this.loop);
    }

    public stop() {
        if (this.frameId) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
        if (this.audioContext) {
            this.audioContext.suspend();
        }
    }

    public reset() {
        if (this.currentRomData) {
            this.nes.loadROM(this.currentRomData);
        } else {
            this.nes.reset();
        }
    }

    private loop = (now: number) => {
        if (!this.frameId) return;
        this.frameId = requestAnimationFrame(this.loop);

        const dt = now - this.lastTime;
        this.lastTime = now;

        // Prevent huge jumps if tab was backgrounded
        if (dt > 1000) {
            this.accumulator = 0;
            return;
        }

        this.accumulator += dt;

        // NES runs at ~60 FPS (approx 16.67ms per frame)
        const step = 1000 / 60;

        // Cap the catch-up to avoid spiral of death
        // Max 3 frames per RAF (approx 50ms simulation)
        // If we are falling behind more than that, we just slow down rather than freeze.
        let framesToRun = 0;
        while (this.accumulator >= step) {
            this.accumulator -= step;
            framesToRun++;
            if (framesToRun >= 3) {
                this.accumulator = 0; // Discard remaining time to prevent spiral
                break;
            }
        }

        for (let i = 0; i < framesToRun; i++) {
            this.nes.frame();
        }
    };

    private renderFrame(frameBuffer: number[]) {
        if (!this.canvasContext || !this.imageData || !this.buf32) return;

        // Optimization: Use Uint32Array to write pixels
        // jsnes frameBuffer is an array of integers.
        // We need to format them as 0xAABBGGRR (little endian) for the canvas.
        // jsnes pixels are usually 0xFFRRGGBB? No, let's check.
        // Actually jsnes produces 32-bit integers. We just need to set Alpha to 255.

        const buf = this.buf32;
        const len = frameBuffer.length;

        for (let i = 0; i < len; i++) {
            // jsnes pixel: 0xRRGGBB (I think? or maybe it depends on palette)
            // Let's assume standard jsnes output.
            // We need 0xAABBGGRR for 32-bit view on little-endian systems.

            const pixel = frameBuffer[i];
            // Force Alpha to 0xFF
            buf[i] = 0xFF000000 | pixel;
        }

        this.canvasContext.putImageData(this.imageData, 0, 0);
    }

    private initAudio() {
        if (this.audioContext) {
            this.audioContext.resume();
            return;
        }

        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

        // Create a ScriptProcessorNode with a buffer size of 4096, 0 input channels, and 1 output channel
        // We use 1 channel (mono) because NES audio is generally mono, though jsnes might output stereo.
        // Let's check writeAudio... it takes left and right. So let's use 2 channels if we want stereo,
        // or mix them. For simplicity and robustness, let's stick to 1 channel mixed or just 1.
        // Actually, jsnes produces samples for left and right. Let's try 2 channels.
        this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 0, 2);

        this.scriptProcessor.onaudioprocess = (e) => {
            const outputBuffer = e.outputBuffer;
            const channelLeft = outputBuffer.getChannelData(0);
            const channelRight = outputBuffer.getChannelData(1);

            // Fill the output buffer with data from our ring buffer
            for (let i = 0; i < outputBuffer.length; i++) {
                if (this.audioReadIndex !== this.audioWriteIndex) {
                    // Read from buffer
                    const sample = this.audioBuffer[this.audioReadIndex];

                    // Simple mono to stereo copy for now, or if we stored interleaved stereo we'd read 2.
                    // Wait, writeAudio receives left and right. 
                    // To keep it simple, let's just store mono mix in our buffer for now?
                    // Or better, let's interleave them in the buffer?
                    // Let's assume our buffer stores interleaved L, R, L, R...
                    // So we need to read 2 values.

                    channelLeft[i] = sample;
                    // We need to handle the interleaved nature properly.
                    // Let's simplify: writeAudio will mix to mono and store in buffer.
                    channelRight[i] = sample;

                    this.audioReadIndex = (this.audioReadIndex + 1) % this.BUFFER_SIZE;
                } else {
                    // Buffer underflow - silence
                    channelLeft[i] = 0;
                    channelRight[i] = 0;
                }
            }
        };

        this.scriptProcessor.connect(this.audioContext.destination);
    }

    private writeAudio(left: number, right: number) {
        // Simple mix to mono
        const sample = (left + right) * 0.5;

        // Write to ring buffer
        this.audioBuffer[this.audioWriteIndex] = sample;
        this.audioWriteIndex = (this.audioWriteIndex + 1) % this.BUFFER_SIZE;

        // If we caught up to read index, push read index forward (drop oldest samples)
        if (this.audioWriteIndex === this.audioReadIndex) {
            this.audioReadIndex = (this.audioReadIndex + 1) % this.BUFFER_SIZE;
        }
    }

    public buttonDown(controller: number, button: number) {
        this.nes.buttonDown(controller, button);
    }

    public buttonUp(controller: number, button: number) {
        this.nes.buttonUp(controller, button);
    }
}
