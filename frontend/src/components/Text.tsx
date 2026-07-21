import { Text as RNText, StyleSheet, type TextProps } from 'react-native';
import { fontFamilyForWeight } from '../theme/typography';

export function Text({ style, ...props }: TextProps) {
  const flat = StyleSheet.flatten(style);
  const fontFamily = fontFamilyForWeight(flat?.fontWeight);
  return <RNText {...props} style={[{ fontFamily }, style]} />;
}
