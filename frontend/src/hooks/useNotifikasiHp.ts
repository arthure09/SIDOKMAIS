import { useEffect } from 'react';
import { fetchNotifikasiList } from '../api/notifikasi';
import { useAuthStore } from '../store/authStore';
import { TIPE_META } from '../screens/NotifikasiScreen';
import { serapNotifikasi } from '../utils/serapNotifikasi';
import { siapkanNotifikasiHp, tampilkanNotifikasiHp } from '../utils/notifikasiHp';

// 10 detik saat dev biar tesnya tidak nunggu lama; 60 detik di build rilis
// supaya tidak boros baterai & request.
const INTERVAL_MS = __DEV__ ? 10_000 : 60_000;

/**
 * Polling notifikasi belum terbaca, yang baru dimunculkan ke tray HP.
 * Dipanggil sekali di App.
 *
 * ponytail: polling foreground, bukan push. App yang ditutup/di-background
 * lama tidak dapat notifikasi — untuk itu perlu FCM/APNs (server kirim push,
 * expo-notifications cuma yang menampilkan). Cukup selama fase dummy data.
 */
export function useNotifikasiHp() {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.pengguna?.role);

  useEffect(() => {
    if (!token || role !== 'DOKTER') return;

    // ponytail: baseline in-memory — yang sudah ada saat app dibuka dianggap
    // "sudah dilihat" biar tidak dinotifikasi ulang tiap restart. Kalau perlu
    // tahan restart, simpan id-nya ke SecureStore lewat authStorage.
    const sudahDilihat = new Set<string>();
    let baseline = true;
    let batal = false;

    async function poll() {
      try {
        const { data } = await fetchNotifikasiList(token as string, {
          isRead: false,
          page: 1,
          limit: 20,
        });
        if (batal) return;
        const baru = serapNotifikasi(data, sudahDilihat, baseline);
        baseline = false;
        for (const n of baru) {
          await tampilkanNotifikasiHp(n.id, TIPE_META[n.tipe].judul, n.pesan);
        }
      } catch {
        // offline / token kedaluwarsa — diamkan, poll berikutnya coba lagi.
      }
    }

    let timer: ReturnType<typeof setInterval> | undefined;
    siapkanNotifikasiHp().then((siap) => {
      if (!siap || batal) return;
      poll();
      timer = setInterval(poll, INTERVAL_MS);
    });

    return () => {
      batal = true;
      if (timer) clearInterval(timer);
    };
  }, [token, role]);
}
