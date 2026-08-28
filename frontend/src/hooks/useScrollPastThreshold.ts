import { useCallback, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

// Melacak apakah scroll offset Y sudah lewat `threshold`. Building block dipakai useHeaderScrollShadow,
// useScrollToTopButton, dan useTabBarDockOnScroll — ketiganya butuh boolean "sudah discroll dari atas?"
// yang sama, cuma buat hal berbeda (shadow header, tombol scroll-to-top, docking tab bar).
export function useScrollPastThreshold(threshold: number) {
  const [past, setPast] = useState(false);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = e.nativeEvent.contentOffset.y > threshold;
      setPast((prev) => (prev === next ? prev : next));
    },
    [threshold],
  );

  const reset = useCallback(() => setPast(false), []);

  return { onScroll, past, reset };
}
