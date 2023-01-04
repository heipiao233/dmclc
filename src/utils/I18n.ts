let lang: string;
let defaultFallback: string;
type Lang = {
    [id: string]: string;
} & {
    fallback?: string;
}
const cache: Record<string, Lang> = {};
export function setup(current: string, fallback: string) {
    lang = current;
    defaultFallback = fallback;
}

export async function translate(id: string, forceLang?: string): Promise<string> {
    const useLang = forceLang ?? lang;
    if(!(useLang in cache)) {
        await loadLang(useLang);
    }
    if(cache[useLang] === undefined) return id;
    const res = cache[useLang][id];
    if (res === undefined) {
        if (useLang === defaultFallback) {
            return id;
        }
        return await translate(id, cache[useLang].fallback ?? defaultFallback);
    }
    return res;
}
async function loadLang(lang: string) {
    if(lang.includes("/")) return;
    cache[lang] = (await import(`../locales/${lang}.json`, {
        assert: { type: "json" }
    })).default;
}

