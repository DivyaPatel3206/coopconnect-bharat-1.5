/** Ask the persistent Copilot something from anywhere in the app. */
export function askAI(prompt: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("coopconnect:ask", { detail: prompt }));
}
export const LANGS: [string, string, string][] = [["en", "English", "en-IN"], ["hi", "हिन्दी", "hi-IN"], ["gu", "ગુજરાતી", "gu-IN"], ["mr", "मराठी", "mr-IN"], ["ta", "தமிழ்", "ta-IN"], ["bn", "বাংলা", "bn-IN"]];
