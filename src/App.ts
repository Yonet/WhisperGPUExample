import { AudioVisualizer } from './components/AudioVisualizer';
import { Progress } from './components/Progress';
import { LanguageSelector } from './components/LanguageSelector';

const IS_WEBGPU_AVAILABLE = !!( ( navigator as unknown as { gpu?: unknown; } ).gpu );

const WHISPER_SAMPLING_RATE = 16_000;
const MAX_AUDIO_LENGTH = 30; // seconds
const MAX_SAMPLES = WHISPER_SAMPLING_RATE * MAX_AUDIO_LENGTH;

interface WorkerMessageEvent {
    status: 'loading' | 'initiate' | 'progress' | 'done' | 'ready' | 'start' | 'update' | 'complete' | 'loading-translator' | 'translator-ready' | 'translation-complete';
    data?: string;
    file?: string;
    progress?: number;
    total?: number;
    tps?: number;
    output?: string | string[];
}

export class App {
    private worker: Worker | null = null;
    private recorder: MediaRecorder | null = null;
    private audioContext: AudioContext | null = null;

    // State
    private status: string | null = null;
    private loadingMessage: string = '';
    private progressItems: Map<string, Progress> = new Map();
    private text: string = '';
    private tps: number | null = null;
    private language: string = 'en';
    private translationLanguage: string = 'en';
    private translatedText: string = '';
    private translationTime: number | null = null;
    private localTranslationLanguage: string = 'en';
    private localTranslatedText: string = '';
    private localTranslationTime: number | null = null;
    private translatorLoaded: boolean = false;
    private recording: boolean = false;
    private isProcessing: boolean = false;
    private chunks: Blob[] = [];
    private stream: MediaStream | null = null;

    // DOM Elements
    private webgpuError: HTMLDivElement;
    private mainContainer: HTMLDivElement;
    private initialState: HTMLDivElement;
    private loadButton: HTMLButtonElement;
    private audioCanvas: HTMLCanvasElement;
    private textContainer: HTMLDivElement;
    private textDisplay: HTMLParagraphElement;
    private tpsDisplay: HTMLSpanElement;
    private translationContainer: HTMLDivElement;
    private translationDisplay: HTMLParagraphElement;
    private translationTimeDisplay: HTMLSpanElement;
    private localTranslationContainer: HTMLDivElement;
    private localTranslationDisplay: HTMLParagraphElement;
    private localTranslationTimeDisplay: HTMLSpanElement;
    private loadTranslatorButton: HTMLButtonElement;
    private controlsContainer: HTMLDivElement;
    private loadingContainer: HTMLDivElement;
    private loadingText: HTMLParagraphElement;
    private progressContainer: HTMLDivElement;
    private resetButton: HTMLButtonElement;

    // UI Components
    private audioVisualizer: AudioVisualizer;

    constructor( _container: HTMLDivElement ) {

        // Get DOM elements
        this.webgpuError = document.getElementById( 'webgpu-error' ) as HTMLDivElement;
        this.mainContainer = document.getElementById( 'main-container' ) as HTMLDivElement;
        this.initialState = document.getElementById( 'initial-state' ) as HTMLDivElement;
        this.loadButton = document.getElementById( 'load-button' ) as HTMLButtonElement;
        this.audioCanvas = document.getElementById( 'audio-canvas' ) as HTMLCanvasElement;
        this.textContainer = document.getElementById( 'text-container' ) as HTMLDivElement;
        this.textDisplay = document.getElementById( 'text-display' ) as HTMLParagraphElement;
        this.tpsDisplay = document.getElementById( 'tps-display' ) as HTMLSpanElement;
        this.translationContainer = document.getElementById( 'translation-container' ) as HTMLDivElement;
        this.translationDisplay = document.getElementById( 'translation-display' ) as HTMLParagraphElement;
        this.translationTimeDisplay = document.getElementById( 'translation-time-display' ) as HTMLSpanElement;
        this.localTranslationContainer = document.getElementById( 'local-translation-container' ) as HTMLDivElement;
        this.localTranslationDisplay = document.getElementById( 'local-translation-display' ) as HTMLParagraphElement;
        this.localTranslationTimeDisplay = document.getElementById( 'local-translation-time-display' ) as HTMLSpanElement;
        this.loadTranslatorButton = document.getElementById( 'load-translator-button' ) as HTMLButtonElement;
        this.controlsContainer = document.getElementById( 'controls-container' ) as HTMLDivElement;
        this.loadingContainer = document.getElementById( 'loading-container' ) as HTMLDivElement;
        this.loadingText = document.getElementById( 'loading-text' ) as HTMLParagraphElement;
        this.progressContainer = document.getElementById( 'progress-container' ) as HTMLDivElement;
        this.resetButton = document.getElementById( 'reset-button' ) as HTMLButtonElement;

        // Initialize audio visualizer with existing canvas
        this.audioVisualizer = new AudioVisualizer( this.audioCanvas );

        // Initialize language selectors
        const languageSelectElement = document.getElementById( 'language-select' ) as HTMLSelectElement;
        new LanguageSelector( this.language, ( lang: string ) => {
            this.recorder?.stop();
            this.language = lang;
            this.recorder?.start( 1000 );
        }, languageSelectElement );

        const translationLanguageSelectElement = document.getElementById( 'translation-language-select' ) as HTMLSelectElement;
        new LanguageSelector( this.translationLanguage, ( lang: string ) => {
            this.translationLanguage = lang;
            this.translateText();
        }, translationLanguageSelectElement );

        const localTranslationLanguageSelectElement = document.getElementById( 'local-translation-language-select' ) as HTMLSelectElement;
        new LanguageSelector( this.localTranslationLanguage, ( lang: string ) => {
            this.localTranslationLanguage = lang;
            if ( this.translatorLoaded ) {
                this.translateTextLocal();
            }
        }, localTranslationLanguageSelectElement );

        this.initialize();
    }

    private initialize (): void {
        if ( !IS_WEBGPU_AVAILABLE ) {
            this.showWebGPUError();
            return;
        }

        this.setupEventListeners();
        this.setupWorker();
        this.setupMediaRecorder();
    }

    private setupEventListeners (): void {
        this.loadButton.addEventListener( 'click', () => {
            this.worker?.postMessage( { type: 'load' } );
            this.status = 'loading';
            this.updateUI();
        } );

        this.loadTranslatorButton.addEventListener( 'click', () => {
            this.worker?.postMessage( { type: 'load-translator' } );
            this.loadTranslatorButton.disabled = true;
            this.loadTranslatorButton.textContent = 'Loading translator...';
        } );

        this.resetButton.addEventListener( 'click', () => {
            this.recorder?.stop();
            this.recorder?.start( 1000 );
        } );
    }

    private setupWorker (): void {
        this.worker = new Worker( new URL( './worker.ts', import.meta.url ), {
            type: 'module'
        } );

        this.worker.addEventListener( 'message', ( e: MessageEvent<WorkerMessageEvent> ) => {
            this.onWorkerMessage( e.data );
        } );
    }

    private onWorkerMessage ( data: WorkerMessageEvent ): void {
        switch ( data.status ) {
            case 'loading':
                this.status = 'loading';
                this.loadingMessage = data.data || '';
                this.updateUI();
                break;

            case 'initiate':
                if ( data.file ) {
                    const progress = new Progress( {
                        file: data.file,
                        percentage: data.progress || 0,
                        total: data.total
                    } );
                    this.progressItems.set( data.file, progress );
                    this.progressContainer.appendChild( progress.getElement() );
                }
                break;

            case 'progress':
                if ( data.file ) {
                    const progress = this.progressItems.get( data.file );
                    if ( progress ) {
                        progress.update( {
                            progress: data.progress,
                            total: data.total
                        } );
                    }
                }
                break;

            case 'done':
                if ( data.file ) {
                    const progress = this.progressItems.get( data.file );
                    if ( progress ) {
                        progress.remove();
                        this.progressItems.delete( data.file );
                    }
                }
                break;

            case 'ready':
                this.status = 'ready';
                this.recorder?.start( 1000 );
                this.updateUI();
                break;

            case 'start':
                this.isProcessing = true;
                this.recorder?.requestData();
                break;

            case 'update':
                if ( data.tps !== undefined ) {
                    this.tps = data.tps;
                    this.updateTPS();
                }
                break;

            case 'complete':
                this.isProcessing = false;
                this.text = Array.isArray( data.output ) ? data.output.join( '' ) : data.output || '';
                this.updateText();
                this.translateText();
                if ( this.translatorLoaded ) {
                    this.translateTextLocal();
                }
                break;

            case 'loading-translator':
                // Translator is loading, could show progress
                break;

            case 'translator-ready':
                this.translatorLoaded = true;
                this.loadTranslatorButton.textContent = 'Translator Loaded';
                this.localTranslationContainer.style.display = 'block';
                if ( this.text ) {
                    this.translateTextLocal();
                }
                break;

            case 'translation-complete':
                this.localTranslatedText = data.output as string || '';
                this.updateLocalTranslation();
                break;
        }
    }

    private setupMediaRecorder (): void {
        if ( navigator.mediaDevices.getUserMedia ) {
            navigator.mediaDevices.getUserMedia( { audio: true } )
                .then( stream => {
                    this.stream = stream;
                    this.audioVisualizer.setStream( stream );

                    this.recorder = new MediaRecorder( stream );
                    this.audioContext = new AudioContext( { sampleRate: WHISPER_SAMPLING_RATE } );

                    this.recorder.onstart = () => {
                        this.recording = true;
                        this.chunks = [];
                    };

                    this.recorder.ondataavailable = ( e ) => {
                        if ( e.data.size > 0 ) {
                            this.chunks.push( e.data );
                            this.processAudioChunks();
                        } else {
                            setTimeout( () => {
                                this.recorder?.requestData();
                            }, 25 );
                        }
                    };

                    this.recorder.onstop = () => {
                        this.recording = false;
                    };
                } )
                .catch( err => console.error( "The following error occurred: ", err ) );
        } else {
            console.error( "getUserMedia not supported on your browser!" );
        }
    }

    private processAudioChunks (): void {
        if ( !this.recorder || !this.recording || this.isProcessing || this.status !== 'ready' ) {
            return;
        }

        if ( this.chunks.length > 0 ) {
            const blob = new Blob( this.chunks, { type: this.recorder.mimeType } );
            const fileReader = new FileReader();

            fileReader.onloadend = async () => {
                const arrayBuffer = fileReader.result as ArrayBuffer;
                if ( !this.audioContext ) return;

                const decoded = await this.audioContext.decodeAudioData( arrayBuffer );
                let audio = decoded.getChannelData( 0 );
                if ( audio.length > MAX_SAMPLES ) {
                    audio = audio.slice( -MAX_SAMPLES );
                }

                this.worker?.postMessage( { type: 'generate', data: { audio, language: this.language } } );
            };

            fileReader.readAsArrayBuffer( blob );
        } else {
            this.recorder?.requestData();
        }
    }

    private updateUI (): void {
        // Hide/show sections based on status
        if ( this.status === null ) {
            this.initialState.style.display = 'block';
            this.loadingContainer.style.display = 'none';
            this.textContainer.style.display = 'none';
            this.translationContainer.style.display = 'none';
            this.controlsContainer.style.display = 'none';
        } else if ( this.status === 'loading' ) {
            this.initialState.style.display = 'none';
            this.loadingContainer.style.display = 'block';
            this.loadingText.textContent = this.loadingMessage;
            this.textContainer.style.display = 'none';
            this.translationContainer.style.display = 'none';
            this.controlsContainer.style.display = 'none';
        } else if ( this.status === 'ready' ) {
            this.initialState.style.display = 'none';
            this.loadingContainer.style.display = 'none';
            this.textContainer.style.display = 'block';
            this.translationContainer.style.display = 'block';
            this.localTranslationContainer.style.display = this.translatorLoaded ? 'block' : 'none';
            this.controlsContainer.style.display = 'flex';
        }
    }

    private showWebGPUError (): void {
        this.webgpuError.style.display = 'flex';
        this.mainContainer.style.display = 'none';
    }

    private updateText (): void {
        this.textDisplay.textContent = this.text;
    }

    private updateTPS (): void {
        if ( this.tps ) {
            this.tpsDisplay.textContent = `${this.tps.toFixed( 2 )} tok/s`;
        }
    }

    private async translateText (): Promise<void> {
        if ( !this.text || this.text.trim() === '' ) {
            this.translatedText = '';
            this.translationTime = null;
            this.updateTranslation();
            return;
        }

        const startTime = performance.now();

        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${this.language}&tl=${this.translationLanguage}&dt=t&q=${encodeURIComponent( this.text )}`;

            const response = await fetch( url );
            const data = await response.json();



            if ( data && data[0] ) {
                this.translatedText = data[0].map( ( item: [string, unknown, unknown, unknown] ) => item[0] ).join( '' );
                const endTime = performance.now();
                this.translationTime = endTime - startTime;
            } else {
                this.translatedText = 'Translation failed';
            }
        } catch ( error ) {
            console.error( 'Translation error:', error );
            this.translatedText = 'Translation error';
            this.translationTime = null;
        }

        this.updateTranslation();
    }

    private updateTranslation (): void {
        this.translationDisplay.textContent = this.translatedText;

        if ( this.translationTime !== null ) {
            this.translationTimeDisplay.textContent = `${this.translationTime.toFixed( 0 )}ms`;
        } else {
            this.translationTimeDisplay.textContent = '';
        }
    }

    private translateTextLocal (): void {
        if ( !this.text || this.text.trim() === '' ) {
            this.localTranslatedText = '';
            this.localTranslationTime = null;
            this.updateLocalTranslation();
            return;
        }

        const startTime = performance.now();

        this.worker?.postMessage( {
            type: 'translate',
            data: {
                text: this.text,
                sourceLanguage: this.language,
                targetLanguage: this.localTranslationLanguage
            }
        } );

        // Store start time to calculate when we receive the result
        ( this as any )._localTranslationStartTime = startTime;
    }

    private updateLocalTranslation (): void {
        this.localTranslationDisplay.textContent = this.localTranslatedText;

        // Calculate time if we have a start time
        if ( ( this as any )._localTranslationStartTime ) {
            this.localTranslationTime = performance.now() - ( this as any )._localTranslationStartTime;
            delete ( this as any )._localTranslationStartTime;
        }

        if ( this.localTranslationTime !== null ) {
            this.localTranslationTimeDisplay.textContent = `${this.localTranslationTime.toFixed( 0 )}ms`;
        } else {
            this.localTranslationTimeDisplay.textContent = '';
        }
    }

    destroy (): void {
        this.worker?.terminate();
        this.recorder?.stop();
        this.stream?.getTracks().forEach( track => track.stop() );
        this.audioVisualizer.destroy();
    }
}
