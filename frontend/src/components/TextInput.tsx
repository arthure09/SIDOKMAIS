import { TextInput as RNTextInput, StyleSheet, type TextInputProps } from 'react-native';
import { fontFamilyForWeight } from '../theme/typography';

export function TextInput({ style, ...props }: TextInputProps) {
  const flat = StyleSheet.flatten(style);
  const fontFamily = fontFamilyForWeight(flat?.fontWeight);
  return <RNTextInput {...props} style={[{ fontFamily }, style]} />;
}
