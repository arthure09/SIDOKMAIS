import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../theme/colors';

export const TAB_BAR_HEIGHT = 90;
export const TAB_BAR_FLOAT_SIDE_MARGIN = 36;
export const TAB_BAR_FLOAT_GAP = spacing.base;

// Ruang kosong yang harus disediakan konten scroll di bawah agar tidak
// tertutup FloatingTabBar, dihitung dari state floating-nya (kondisi
// terluas) supaya tetap konsisten walau bar sedang docked.
export function useTabBarClearance(extra: number = spacing.gutter) {
  const insets = useSafeAreaInsets();
  return insets.bottom + TAB_BAR_FLOAT_GAP + TAB_BAR_HEIGHT + extra;
}
