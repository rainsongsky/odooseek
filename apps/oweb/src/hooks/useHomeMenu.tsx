import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

interface HomeMenuState {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

const HomeMenuContext = createContext<HomeMenuState>({
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
})

export function HomeMenuProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const toggle = useCallback(() => setIsOpen((v) => !v), [])
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  return (
    <HomeMenuContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </HomeMenuContext.Provider>
  )
}

export function useHomeMenu() {
  return useContext(HomeMenuContext)
}
