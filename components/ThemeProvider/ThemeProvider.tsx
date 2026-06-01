import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider as NavigationThemeProvider,
} from '@react-navigation/native';
import type { ReactNode } from 'react';

import { useColorScheme } from '@/components/useColorScheme';

type Props = {
  children: ReactNode;
};

export function ThemeProvider({ children }: Props) {
  const colorScheme = useColorScheme();

  return (
    <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {children}
    </NavigationThemeProvider>
  );
}
