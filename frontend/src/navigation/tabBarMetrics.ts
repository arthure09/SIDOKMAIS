import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../theme/colors';

export const TAB_BAR_HEIGHT = 90;

// Ruang kosong yang harus disediakan konten scroll di bawah agar tidak tertutup FloatingTabBar, yang
// full-width menempel ke tepi bawah & samping layar (cuma dikurangi safe-area inset di bawah).
export function useTabBarClearance(extra: number = spacing.gutter) {
  const insets = useSafeAreaInsets();
  return insets.bottom + TAB_BAR_HEIGHT + extra;
}
