import { useCallback, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTabBarStore } from '../store/tabBarStore';
import { useScrollPastThreshold } from './useScrollPastThreshold';

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
  const { onScroll: onShadowScroll, past: scrolled, reset: resetScrolled } = useScrollPastThreshold(SHADOW_THRESHOLD);

  useFocusEffect(
    useCallback(() => {
      wasAtBottom.current = false;
      setDocked(false);
      resetScrolled();
      return () => setDocked(false);
    }, [setDocked, resetScrolled]),
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

      onShadowScroll(e);
    },
    [setDocked, onShadowScroll],
  );

  return { onScroll, scrollEventThrottle: 16, scrolled };
}
