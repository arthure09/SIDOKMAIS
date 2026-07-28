import { useCallback, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTabBarStore } from '../store/tabBarStore';

const DOCK_THRESHOLD = 24;
const SHADOW_THRESHOLD = 2;

// Docks FloatingTabBar saat scroll konten screen mencapai dasar, dan
// mengembalikannya ke floating saat discroll naik lagi. Juga melacak apakah
// konten sudah discroll dari posisi paling atas (`scrolled`), dipakai buat
// nge-toggle shadow header. Pasang `onScroll` + `scrollEventThrottle` hasil
// hook ini ke ScrollView/FlatList screen yang tampil di bawah tab navigator.
export function useTabBarDockOnScroll() {
  const setDocked = useTabBarStore((s) => s.setDocked);
  const wasAtBottom = useRef(false);
  const [scrolled, setScrolled] = useState(false);

  useFocusEffect(
    useCallback(() => {
      wasAtBottom.current = false;
      setDocked(false);
      setScrolled(false);
      return () => setDocked(false);
    }, [setDocked]),
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const scrollable = contentSize.height > layoutMeasurement.height + DOCK_THRESHOLD;
      const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
      const atBottom = scrollable && distanceFromBottom <= DOCK_THRESHOLD;

      if (atBottom !== wasAtBottom.current) {
        wasAtBottom.current = atBottom;
        setDocked(atBottom);
      }

      setScrolled((prev) => {
        const next = contentOffset.y > SHADOW_THRESHOLD;
        return prev === next ? prev : next;
      });
    },
    [setDocked],
  );

  return { onScroll, scrollEventThrottle: 16, scrolled };
}
