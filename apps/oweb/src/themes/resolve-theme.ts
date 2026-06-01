import type { ThemeConfig } from './types.ts'
import { DEFAULT_THEME_CONFIG } from './types.ts'

const STORAGE_KEY = 'oweb-theme'

export function loadThemeFromStorage(): ThemeConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.presetId === 'string' && typeof parsed.accentId === 'string') {
      return parsed as ThemeConfig
    }
    return null
  } catch {
    return null
  }
}

export function resolveInitialTheme(): ThemeConfig {
  return loadThemeFromStorage() ?? DEFAULT_THEME_CONFIG
}

export function saveThemeToStorage(config: ThemeConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    // Storage full or unavailable — ignore
  }
}
