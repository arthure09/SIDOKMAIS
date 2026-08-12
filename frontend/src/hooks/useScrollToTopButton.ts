import { useScrollPastThreshold } from './useScrollPastThreshold';

const SCROLL_TOP_THRESHOLD = 2;

// Melacak apakah user udah mulai scroll dari atas, dipakai buat nampilin
// floating "scroll to top" button yang ngambang di atas FloatingTabBar.
// Threshold dibikin kecil biar tombol langsung muncul begitu discroll dikit.
export function useScrollToTopButton() {
  const { onScroll, past, reset } = useScrollPastThreshold(SCROLL_TOP_THRESHOLD);
  // Dipanggil saat konten yang discroll berganti instance (mis. ganti tab),
  // biar tombol nggak nyangkut "visible" dari scroll posisi tab sebelumnya.
  return { onScroll, visible: past, reset };
}
