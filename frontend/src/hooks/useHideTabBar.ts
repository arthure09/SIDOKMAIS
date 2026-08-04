import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useTabBarStore } from '../store/tabBarStore';

// Sembunyikan FloatingTabBar (slide-down keluar layar) selagi screen ini
// fokus, balikin lagi begitu blur/unmount. Dipakai screen full-bleed yang
// nggak boleh ketutupan tab bar, mis. LihatPdfLabScreen.
export function useHideTabBar() {
  const setHidden = useTabBarStore((s) => s.setHidden);

  useFocusEffect(
    useCallback(() => {
      setHidden(true);
      return () => setHidden(false);
    }, [setHidden]),
  );
}
