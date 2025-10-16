function titleCase(str: string): string {
    str = str.toLowerCase();
    return (str.match(/\w+.?/g) || [])
        .map((word: string) => {
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join("");
}

// List of supported languages:
// https://help.openai.com/en/articles/7031512-whisper-api-faq
// https://github.com/openai/whisper/blob/248b6cb124225dd263bb9bd32d060b6517e067f8/whisper/tokenizer.py#L79
const LANGUAGES: Record<string, string> = {
    en: "english",
    zh: "chinese",
    de: "german",
    es: "spanish/castilian",
    ru: "russian",
    ko: "korean",
    fr: "french",
    ja: "japanese",
    pt: "portuguese",
    tr: "turkish",
    pl: "polish",
    ca: "catalan/valencian",
    nl: "dutch/flemish",
    ar: "arabic",
    sv: "swedish",
    it: "italian",
    id: "indonesian",
    hi: "hindi",
    fi: "finnish",
    vi: "vietnamese",
    he: "hebrew",
    uk: "ukrainian",
    el: "greek",
    ms: "malay",
    cs: "czech",
    ro: "romanian/moldavian/moldovan",
    da: "danish",
    hu: "hungarian",
    ta: "tamil",
    no: "norwegian",
    th: "thai",
    ur: "urdu",
    hr: "croatian",
    bg: "bulgarian",
    lt: "lithuanian",
    la: "latin",
    mi: "maori",
    ml: "malayalam",
    cy: "welsh",
    sk: "slovak",
    te: "telugu",
    fa: "persian",
    lv: "latvian",
    bn: "bengali",
    sr: "serbian",
    az: "azerbaijani",
    sl: "slovenian",
    kn: "kannada",
    et: "estonian",
    mk: "macedonian",
    br: "breton",
    eu: "basque",
    is: "icelandic",
    hy: "armenian",
    ne: "nepali",
    mn: "mongolian",
    bs: "bosnian",
    kk: "kazakh",
    sq: "albanian",
    sw: "swahili",
    gl: "galician",
    mr: "marathi",
    pa: "punjabi/panjabi",
    si: "sinhala/sinhalese",
    km: "khmer",
    sn: "shona",
    yo: "yoruba",
    so: "somali",
    af: "afrikaans",
    oc: "occitan",
    ka: "georgian",
    be: "belarusian",
    tg: "tajik",
    sd: "sindhi",
    gu: "gujarati",
    am: "amharic",
    yi: "yiddish",
    lo: "lao",
    uz: "uzbek",
    fo: "faroese",
    ht: "haitian creole/haitian",
    ps: "pashto/pushto",
    tk: "turkmen",
    nn: "nynorsk",
    mt: "maltese",
    sa: "sanskrit",
    lb: "luxembourgish/letzeburgesch",
    my: "myanmar/burmese",
    bo: "tibetan",
    tl: "tagalog",
    mg: "malagasy",
    as: "assamese",
    tt: "tatar",
    haw: "hawaiian",
    ln: "lingala",
    ha: "hausa",
    ba: "bashkir",
    jw: "javanese",
    su: "sundanese",
};

export class LanguageSelector {
    private select: HTMLSelectElement;
    private language: string;
    private onChange: (language: string) => void;

    constructor(language: string, onChange: (language: string) => void, selectElement?: HTMLSelectElement) {
        this.language = language;
        this.onChange = onChange;

        if (selectElement) {
            this.select = selectElement;
            this.populateSelect();
        } else {
            this.select = this.createElement();
        }
    }

    private createElement(): HTMLSelectElement {
        const select = document.createElement('select');
        select.className = 'language-select';
        this.select = select;
        this.populateSelect();
        return select;
    }

    private populateSelect(): void {
        this.select.value = this.language;
        const names = Object.values(LANGUAGES).map(titleCase);

        Object.keys(LANGUAGES).forEach((key, i) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = names[i];
            this.select.appendChild(option);
        });

        this.select.addEventListener('change', (event) => {
            const target = event.target as HTMLSelectElement;
            this.language = target.value;
            this.onChange(this.language);
        });
    }

    getElement(): HTMLSelectElement {
        return this.select;
    }

    getValue(): string {
        return this.language;
    }

    setValue(language: string): void {
        this.language = language;
        this.select.value = language;
    }
}
