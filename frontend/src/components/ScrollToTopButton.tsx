import { Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme/colors';

// Floating action button buat balik ke atas list dengan cepat. Diposisikan
// `bottom` sesuai tabBarClearance screen pemanggil biar ngambang persis di
// atas FloatingTabBar.
export function ScrollToTopButton({
  visible,
  onPress,
  bottom,
}: {
  visible: boolean;
  onPress: () => void;
  bottom: number;
}) {
  if (!visible) return null;

  return (
    <Pressable onPress={onPress} style={[styles.button, { bottom }]} hitSlop={8}>
      <MaterialIcons name="arrow-upward" size={22} color={colors.onPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: spacing.marginMobile,
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
