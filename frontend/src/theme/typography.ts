import type { TextStyle } from 'react-native';
import {
  useFonts,
  NunitoSans_300Light,
  NunitoSans_400Regular,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
  NunitoSans_800ExtraBold,
} from '@expo-google-fonts/nunito-sans';

export function useNunitoSansFonts() {
  return useFonts({
    NunitoSans_300Light,
    NunitoSans_400Regular,
    NunitoSans_600SemiBold,
    NunitoSans_700Bold,
    NunitoSans_800ExtraBold,
  });
}

export function fontFamilyForWeight(weight?: TextStyle['fontWeight']): string {
  switch (String(weight)) {
    case '300':
      return 'NunitoSans_300Light';
    case '600':
      return 'NunitoSans_600SemiBold';
    case '700':
    case 'bold':
      return 'NunitoSans_700Bold';
    case '800':
      return 'NunitoSans_800ExtraBold';
    default:
      return 'NunitoSans_400Regular';
  }
}
