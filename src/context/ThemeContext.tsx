import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors } from '@config/themes';
import type { BrandColors } from '@config/themes';

const STORAGE_KEY = '@presellia_theme';

interface ThemeContextValue {
  colors:      BrandColors;
  isDark:      boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors:      darkColors,
  isDark:      true,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true); // dark par défaut

  // Charger la préférence sauvegardée au démarrage
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => { if (saved !== null) setIsDark(saved === 'dark'); })
      .catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      AsyncStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light').catch(() => {});
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ colors: isDark ? darkColors : lightColors, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
