import { useColorScheme } from 'react-native';

const light = {
  bg: '#F4F5F7',
  card: '#FFFFFF',
  text: '#15171A',
  muted: '#6B7280',
  border: '#E3E5E9',
  accent: '#1F8A5B',
  accentText: '#FFFFFF',
  over: '#C2410C',
  track: '#E6E8EC',
  danger: '#B42318',
  chip: '#EEF0F3',
};

export type Theme = typeof light;

const dark: Theme = {
  bg: '#0F1113',
  card: '#1A1D21',
  text: '#F2F3F5',
  muted: '#9AA1AC',
  border: '#2A2E34',
  accent: '#34B37A',
  accentText: '#0B1A12',
  over: '#F97316',
  track: '#2A2E34',
  danger: '#F04438',
  chip: '#24282D',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
