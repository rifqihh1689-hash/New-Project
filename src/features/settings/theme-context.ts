import { createContext, useContext } from 'react'
import type { ThemePreference } from '../../types'

export const ThemeContext = createContext<[ThemePreference, (preference: ThemePreference) => void]>(['system', () => {}])

export function useThemeContext() {
  return useContext(ThemeContext)
}
