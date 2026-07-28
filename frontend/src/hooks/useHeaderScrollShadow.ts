import { useCallback, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

const SHADOW_THRESHOLD = 2;

// Melacak apakah konten sudah discroll dari posisi paling atas, dipakai buat
// nge-toggle shadow header di screen yang nggak butuh dock FloatingTabBar
// (lihat useTabBarDockOnScroll buat screen yang butuh keduanya).
export function useHeaderScrollShadow() {
  const [scrolled, setScrolled] = useState(false);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = e.nativeEvent.contentOffset.y > SHADOW_THRESHOLD;
    setScrolled((prev) => (prev === next ? prev : next));
  }, []);

  return { onScroll, scrollEventThrottle: 16, scrolled };
}
