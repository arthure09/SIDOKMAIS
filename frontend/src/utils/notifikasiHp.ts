// Notifikasi yang muncul di tray HP (bukan yang di dalam app). Local
// notification lewat expo-notifications — jalan di Expo Go maupun dev build,
// jadi tidak perlu perancah tambahan untuk menjaga app tetap boot. Modul
// native lain (mis. @notifee/react-native) tidak tersedia di Expo Go dan
// baru meledak saat method dipanggil, bukan saat import.
import * as Notifications from 'expo-notifications';

const CHANNEL_ID = 'notifikasi-dokter';

// Tanpa handler ini expo-notifications menelan notifikasi yang datang selagi
// app dibuka — dan polling kita memang cuma jalan di foreground, jadi tanpa
// ini tidak akan ada yang kelihatan sama sekali.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Minta izin + siapkan channel Android. `false` = notifikasi HP tidak tersedia
 * (izin ditolak). Tidak pernah melempar — pemanggilnya memakai .then() tanpa
 * .catch(), jadi rejection di sini berarti red screen saat app dibuka.
 */
export async function siapkanNotifikasiHp(): Promise<boolean> {
  try {
    const { granted } = await Notifications.requestPermissionsAsync();
    if (!granted) return false;

    // No-op di iOS; channel wajib ada di Android biar importance-nya terpakai.
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Notifikasi Dokter',
      importance: Notifications.AndroidImportance.HIGH,
    });
    return true;
  } catch (err) {
    if (__DEV__) console.warn('Gagal menyiapkan notifikasi HP', err);
    return false;
  }
}

/** Tampilkan satu notifikasi ke tray HP. Tidak pernah melempar. */
export async function tampilkanNotifikasiHp(id: string, judul: string, pesan: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title: judul, body: pesan },
      // ChannelAwareTriggerInput: tampil langsung seperti `trigger: null`, bedanya
      // Android tahu harus lewat channel yang mana. Diabaikan di iOS.
      trigger: { channelId: CHANNEL_ID },
    });
  } catch (err) {
    // Satu notifikasi gagal tidak boleh menghentikan sisa loop polling —
    // id-nya sudah ditandai "sudah dilihat", jadi tidak akan diulang.
    if (__DEV__) console.warn('Gagal menampilkan notifikasi HP', err);
  }
}
