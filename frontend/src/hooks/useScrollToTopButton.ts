import { useCallback, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

const SCROLL_TOP_THRESHOLD = 2;

// Melacak apakah user udah mulai scroll dari atas, dipakai buat nampilin
// floating "scroll to top" button yang ngambang di atas FloatingTabBar.
// Threshold dibikin kecil biar tombol langsung muncul begitu discroll dikit.
export function useScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = e.nativeEvent.contentOffset.y > SCROLL_TOP_THRESHOLD;
    setVisible((prev) => (prev === next ? prev : next));
  }, []);

  // Dipanggil saat konten yang discroll berganti instance (mis. ganti tab),
  // biar tombol nggak nyangkut "visible" dari scroll posisi tab sebelumnya.
  const reset = useCallback(() => setVisible(false), []);

  return { onScroll, visible, reset };
}
