import {
    AutoTokenizer,
    AutoProcessor,
    WhisperForConditionalGeneration,
    AutoModelForSeq2SeqLM,
    TextStreamer,
    full,
    type Processor,
    type PreTrainedTokenizer,
} from '@huggingface/transformers';

const MAX_NEW_TOKENS = 64;

interface ProgressData {
    status: string;
    file?: string;
    progress?: number;
    loaded?: number;
    total?: number;
}

interface GenerateInput {
    audio: Float32Array;
    language: string;
}

interface TranslateInput {
    text: string;
    sourceLanguage: string;
    targetLanguage: string;
}

interface MessageData {
    type: 'load' | 'generate' | 'load-translator' | 'translate';
    data?: GenerateInput | TranslateInput;
}

/**
 * Translation model singleton
 */
class TranslationPipeline {
    static model_id = 'Xenova/nllb-200-distilled-600M';
    static tokenizer: Promise<PreTrainedTokenizer> | null = null;
    static model: Promise<any> | null = null;

    static async getInstance ( progress_callback?: ( ( data: ProgressData ) => void ) ): Promise<[PreTrainedTokenizer, any]> {
        this.tokenizer ??= AutoTokenizer.from_pretrained( this.model_id, {
            progress_callback,
        } );

        this.model ??= AutoModelForSeq2SeqLM.from_pretrained( this.model_id, {
            dtype: 'q8',
            device: 'wasm',
            progress_callback,
        } );

        return Promise.all( [this.tokenizer, this.model] );
    }
}

/**
 * This class uses the Singleton pattern to ensure that only one instance of the model is loaded.
 */
class AutomaticSpeechRecognitionPipeline {
    static model_id: string | null = null;
    static tokenizer: Promise<PreTrainedTokenizer> | null = null;
    static processor: Promise<Processor> | null = null;
    static model: Promise<WhisperForConditionalGeneration> | null = null;

    static async getInstance ( progress_callback?: ( ( data: ProgressData ) => void ) ): Promise<[PreTrainedTokenizer, Processor, WhisperForConditionalGeneration]> {
        this.model_id = 'onnx-community/whisper-base';

        this.tokenizer ??= AutoTokenizer.from_pretrained( this.model_id, {
            progress_callback,
        } );
        this.processor ??= AutoProcessor.from_pretrained( this.model_id, {
            progress_callback,
        } );

        this.model ??= WhisperForConditionalGeneration.from_pretrained( this.model_id, {
            dtype: {
                encoder_model: 'fp32', // 'fp16' works too
                decoder_model_merged: 'q4', // or 'fp32' ('fp16' is broken)
            },
            device: 'webgpu',
            progress_callback,
        } ) as Promise<WhisperForConditionalGeneration>;

        return Promise.all( [this.tokenizer, this.processor, this.model] ) as Promise<[PreTrainedTokenizer, Processor, WhisperForConditionalGeneration]>;
    }
}

let processing = false;

async function generate ( { audio, language }: GenerateInput ): Promise<void> {
    if ( processing ) return;
    processing = true;

    // Tell the main thread we are starting
    self.postMessage( { status: 'start' } );

    // Retrieve the text-generation pipeline.
    const [tokenizer, processor, model] = await AutomaticSpeechRecognitionPipeline.getInstance();

    let startTime: number | undefined;
    let numTokens = 0;
    const callback_function = ( output: string ): void => {
        startTime ??= performance.now();

        let tps: number | undefined;
        if ( numTokens++ > 0 ) {
            tps = numTokens / ( performance.now() - startTime ) * 1000;
        }
        self.postMessage( {
            status: 'update',
            output,
            tps,
            numTokens,
        } );
    };

    const streamer = new TextStreamer( tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function,
    } );

    const inputs = await processor( audio );

    const outputs = await model.generate( {
        ...inputs,
        max_new_tokens: MAX_NEW_TOKENS,
        language,
        streamer,
    } as any );

    const outputText = tokenizer.batch_decode( outputs as any, { skip_special_tokens: true } );

    // Send the output back to the main thread
    self.postMessage( {
        status: 'complete',
        output: outputText,
    } );
    processing = false;
}

async function loadTranslator (): Promise<void> {
    self.postMessage( {
        status: 'loading-translator',
        data: 'Loading translation model...'
    } );

    // Load the translation pipeline
    await TranslationPipeline.getInstance( ( x: ProgressData ) => {
        self.postMessage( x );
    } );

    self.postMessage( { status: 'translator-ready' } );
}

async function translate ( { text, sourceLanguage, targetLanguage }: TranslateInput ): Promise<void> {
    try {
        const [tokenizer, model] = await TranslationPipeline.getInstance();

        // NLLB language codes (simplified mapping)
        const langMap: Record<string, string> = {
            'en': 'eng_Latn',
            'es': 'spa_Latn',
            'fr': 'fra_Latn',
            'de': 'deu_Latn',
            'it': 'ita_Latn',
            'pt': 'por_Latn',
            'ru': 'rus_Cyrl',
            'zh': 'zho_Hans',
            'ja': 'jpn_Jpan',
            'ko': 'kor_Hang',
            'ar': 'arb_Arab',
            'hi': 'hin_Deva',
            'tr': 'tur_Latn',
            'pl': 'pol_Latn',
            'nl': 'nld_Latn',
            'sv': 'swe_Latn',
            'id': 'ind_Latn',
            'vi': 'vie_Latn',
            'th': 'tha_Thai',
            'uk': 'ukr_Cyrl',
            'el': 'ell_Grek',
            'cs': 'ces_Latn',
            'ro': 'ron_Latn',
            'da': 'dan_Latn',
            'fi': 'fin_Latn',
            'hu': 'hun_Latn',
            'no': 'nob_Latn',
            'he': 'heb_Hebr',
            'fa': 'pes_Arab',
        };

        const tgtLang = langMap[targetLanguage] || 'ita_Latn';

        // Tokenize the text
        const inputs = tokenizer( text );

        // Get the target language token ID
        const tgtLangId = tokenizer.model.convert_tokens_to_ids( [tgtLang] )[0];

        // Generate translation
        const outputs = await model.generate( {
            ...inputs,
            forced_bos_token_id: tgtLangId,
            max_length: 200,
        } );

        // Decode the output
        const decoded = tokenizer.batch_decode( outputs, { skip_special_tokens: true } );

        self.postMessage( {
            status: 'translation-complete',
            output: decoded[0],
        } );
    } catch ( error ) {
        console.error( 'Translation error:', error );
        self.postMessage( {
            status: 'translation-complete',
            output: 'Translation error',
        } );
    }
}

async function load (): Promise<void> {
    self.postMessage( {
        status: 'loading',
        data: 'Loading model...'
    } );

    // Load the pipeline and save it for future use.
    const [, , model] = await AutomaticSpeechRecognitionPipeline.getInstance( ( x: ProgressData ) => {
        // We also add a progress callback to the pipeline so that we can
        // track model loading.
        self.postMessage( x );
    } );

    self.postMessage( {
        status: 'loading',
        data: 'Compiling shaders and warming up model...'
    } );

    // Run model with dummy input to compile shaders
    await model.generate( {
        input_features: full( [1, 80, 3000], 0.0 ),
        max_new_tokens: 1,
    } as any );
    self.postMessage( { status: 'ready' } );
}

// Listen for messages from the main thread
self.addEventListener( 'message', async ( e: MessageEvent<MessageData> ) => {
    const { type, data } = e.data;

    switch ( type ) {
        case 'load':
            load();
            break;

        case 'generate':
            if ( data ) {
                generate( data as GenerateInput );
            }
            break;

        case 'load-translator':
            loadTranslator();
            break;

        case 'translate':
            if ( data ) {
                translate( data as TranslateInput );
            }
            break;
    }
} );
