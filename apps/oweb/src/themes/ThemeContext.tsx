import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { getPreset } from './presets.ts'
import { applyTheme } from './theme-engine.ts'
import type { PresetId, ThemeConfig, ThemePreset } from './types.ts'
import { DEFAULT_THEME_CONFIG } from './types.ts'

const STORAGE_KEY = 'oweb-theme'

interface ThemeContextValue {
  config: ThemeConfig
  preset: ThemePreset
  setPreset: (presetId: PresetId) => void
  setAccent: (accentId: string) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function loadFromLocalStorage(): ThemeConfig | null {
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

function saveToLocalStorage(config: ThemeConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    // Storage full or unavailable — ignore
  }
}

function resolveInitialTheme(): ThemeConfig {
  return loadFromLocalStorage() ?? DEFAULT_THEME_CONFIG
}

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [config, setConfig] = useState<ThemeConfig>(() => resolveInitialTheme())
  const initialized = useRef(false)

  useEffect(() => {
    applyTheme(config)
    if (initialized.current) {
      saveToLocalStorage(config)
    }
    initialized.current = true
  }, [config])

  const setPreset = useCallback((presetId: PresetId) => {
    setConfig(() => {
      const newPreset = getPreset(presetId)
      return { presetId, accentId: newPreset.defaultAccentId }
    })
  }, [])

  const setAccent = useCallback((accentId: string) => {
    setConfig((prev) => ({ ...prev, accentId }))
  }, [])

  const preset = getPreset(config.presetId)

  return (
    <ThemeContext.Provider value={{ config, preset, setPreset, setAccent }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
