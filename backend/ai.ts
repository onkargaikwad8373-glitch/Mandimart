import { GoogleGenAI } from "@google/genai";
import { translateDynamic } from "./translations";

let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

/**
 * Checks if a string contains any English letters (a-z, A-Z).
 */
function hasEnglishLetters(text: string): boolean {
  return /[a-zA-Z]/.test(text);
}

/**
 * Checks if a string contains Devanagari characters (Indic/Marathi/Hindi range).
 */
function isDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

/**
 * Handles fast, offline-first translation lookup using our local dictionaries.
 */
export function localTranslate(text: string, lang: string): string {
  if (!text || !text.trim() || lang === "en") {
    return (text || "").trim();
  }

  const trimmed = text.trim();

  // If the input is already written fully in Marathi or Hindi (no English letters at all), return it as-is
  if (isDevanagari(trimmed) && !hasEnglishLetters(trimmed)) {
    return trimmed;
  }

  // Attempt to use our dynamic offline local translation dictionary
  return translateDynamic(trimmed, lang as any);
}

/**
 * Translates or transliterates an entire dictionary/record of multiple fields concurrently in a
 * single batched server-side request (bypassing multiple sequential AI calls).
 * Utilizes Gemini if configured, otherwise falls back to MyMemory API, and finally to local dictionary.
 */
async function translateOnlineMyMemory(text: string, lang: string): Promise<string> {
  try {
    const targetLang = lang === "mr" ? "mr" : lang === "hi" ? "hi" : lang;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data: any = await res.json();
    if (data.responseData?.translatedText) {
      return data.responseData.translatedText.trim();
    }
    return localTranslate(text, lang);
  } catch (e) {
    console.error("[MyMemory Fallback Error]:", e);
    return localTranslate(text, lang);
  }
}

export async function translateFields(
  fields: Record<string, string>,
  lang: string
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const toTranslateRemotely: Record<string, string> = {};

  // Step 1: Perform fast, free, offline local translation first for all provided fields
  for (const [key, val] of Object.entries(fields)) {
    if (!val || !val.trim() || lang === "en") {
      result[key] = (val || "").trim();
      continue;
    }

    const offlineVal = localTranslate(val, lang);
    if (!hasEnglishLetters(offlineVal)) {
      // Complete offline match! Clean Marathi/Hindi string obtained, no Gemini call needed.
      result[key] = offlineVal;
    } else {
      // The local dictionary was insufficient. Queue this for the batch remote call.
      toTranslateRemotely[key] = val.trim();
    }
  }

  const remoteKeys = Object.keys(toTranslateRemotely);

  // If no fields require remote processing, return now! (Saves 100% of API limits)
  if (remoteKeys.length === 0) {
    return result;
  }

  // If Gemini API Key is missing, placeholder, or client not initialized, fallback to MyMemory API
  if (!process.env.GEMINI_API_KEY || !ai || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY") {
    const myMemoryPromises = remoteKeys.map(async (key) => {
      const textToTranslate = toTranslateRemotely[key];
      const translatedVal = await translateOnlineMyMemory(textToTranslate, lang);
      result[key] = translatedVal;
    });
    await Promise.all(myMemoryPromises);
    return result;
  }

  // Step 2: Bundle all remaining fields into exactly ONE remote request utilizing the Gemini JSON output capability
  try {
    const entriesPrompt = remoteKeys.map(k => `[${k}]: ${toTranslateRemotely[k]}`).join("\n");
    const prompt = `You are a professional helper and translator for MandiMate, a digital wholesale vegetable market management system.
Your task is to translate or phonetically transliterate English words, names, and notes into language code '${lang}' (mr = Marathi, hi = Hindi).

CRITICAL DIRECTIVES:
1. For vegetable names or quality markings (e.g., "Tomato", "Bhendi", "Premium"), use clear local merchant terminology (e.g. "टोमॅटो", "भेंडी", "प्रीमियम").
2. For person names (e.g., "Aniket", "Suresh Patil"), use PHONETIC TRANSLITERATION so the names sound identical in Marathi/Hindi script.
3. For sentences, notes, or descriptions, translate them naturally to the target language.
4. If an entry is already in the target script, return it exactly as-is.
5. You MUST return ONLY a raw, flat JSON object where the keys match the ones provided, and values are the Marathi/Hindi translations. Do not add markdown backticks, explanations, or quotes.

Fields to analyze:
${entriesPrompt}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const textResponse = response.text?.trim() || "";
    let parsed: Record<string, string> = {};
    try {
      parsed = JSON.parse(textResponse);
    } catch {
      // Simple fallback strip of markdown block if present
      const cleanJson = textResponse.replace(/```json|```/gi, "").trim();
      parsed = JSON.parse(cleanJson);
    }

    for (const key of remoteKeys) {
      if (parsed && typeof parsed[key] === "string" && parsed[key].trim()) {
        result[key] = parsed[key].trim();
        console.log(`[MandiMate AI Remote] Batched translated dynamic key [${key}]: "${toTranslateRemotely[key]}" -> "${result[key]}"`);
      } else {
        result[key] = await translateOnlineMyMemory(toTranslateRemotely[key], lang);
      }
    }
  } catch (err: any) {
    console.error("[MandiMate AI Remote Error] Gemini translation error. Falling back to MyMemory:", err.message || err);
    // Graceful fallback to MyMemory Translate
    const myMemoryPromises = remoteKeys.map(async (key) => {
      const textToTranslate = toTranslateRemotely[key];
      const translatedVal = await translateOnlineMyMemory(textToTranslate, lang);
      result[key] = translatedVal;
    });
    await Promise.all(myMemoryPromises);
  }

  return result;
}

/**
 * Transliterates or translates names/terms from English into Marathi or Hindi.
 * Delegates to translateFields for optimized performance and unified rules logic.
 */
export async function translateText(text: string, lang: string): Promise<string> {
  const result = await translateFields({ val: text }, lang);
  return result.val;
}

