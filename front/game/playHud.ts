/** Format the nearby-prompt strip without doubling keys already in the world text. */
export function formatNearbyPrompt(text: string, gamepadConnected: boolean): string {
  const trimmed = text.trim()
  if (!trimmed) return gamepadConnected ? '✕ / E' : 'E'
  if (/^(e|✕|x)\b/i.test(trimmed)) return trimmed
  return gamepadConnected ? `✕ / E · ${trimmed}` : `E · ${trimmed}`
}
