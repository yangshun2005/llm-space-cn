/**
 * Derives a short label for an avatar (at most two letters). Prefers the first
 * number in the name (e.g. "Doubao 2.0 Pro" → "2.0", "GPT 5" → "5"); otherwise
 * initials of the first two words (e.g. "OpenAI Codex" → "OC", "Aurora Doubao
 * Pro Max" → "AD"); otherwise camelCase capitals for a single word (e.g.
 * "DeepSeek" → "DS", "MiniMax" → "MM").
 */
export default function extractInitials(name: string): string {
  name = name.replace(/-/, " ");
  const number = /\d+(?:\.\d+)?/.exec(name);
  if (number) return number[0];

  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0]![0]! + words[1]![0]!).toUpperCase();
  }

  const firstWord = words[0] ?? "";
  const capitals = firstWord.match(/[A-Z]/g);
  if (capitals && capitals.length >= 2) {
    return capitals.slice(0, 2).join("");
  }

  return name.slice(0, 2).toUpperCase();
}
