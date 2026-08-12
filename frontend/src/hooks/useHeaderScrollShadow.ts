import { useScrollPastThreshold } from './useScrollPastThreshold';

const SHADOW_THRESHOLD = 2;

// Melacak apakah konten sudah discroll dari posisi paling atas, dipakai buat
// nge-toggle shadow header di screen yang nggak butuh dock FloatingTabBar
// (lihat useTabBarDockOnScroll buat screen yang butuh keduanya).
export function useHeaderScrollShadow() {
  const { onScroll, past } = useScrollPastThreshold(SHADOW_THRESHOLD);
  return { onScroll, scrollEventThrottle: 16, scrolled: past };
}
