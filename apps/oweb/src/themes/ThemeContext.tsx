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
import { resolveInitialTheme, saveThemeToStorage } from './resolve-theme.ts'
import { applyTheme } from './theme-engine.ts'
import type { PresetId, ThemeConfig, ThemePreset } from './types.ts'

export { resolveInitialTheme } from './resolve-theme.ts'

interface ThemeContextValue {
  config: ThemeConfig
  preset: ThemePreset
  setPreset: (presetId: PresetId) => void
  setAccent: (accentId: string) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [config, setConfig] = useState<ThemeConfig>(() => {
    const initial = resolveInitialTheme()
    applyTheme(initial)
    return initial
  })
  const initialized = useRef(false)

  useEffect(() => {
    applyTheme(config)
    if (initialized.current) {
      saveThemeToStorage(config)
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
