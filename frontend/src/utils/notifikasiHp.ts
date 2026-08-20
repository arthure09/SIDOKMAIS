// Notifikasi yang muncul di tray HP (bukan yang di dalam app). Pakai notifee,
// jadi WAJIB dev build — `npx expo prebuild && npx expo run:android` atau
// EAS dev build. Di Expo Go native module-nya tidak ada.
//
// ponytail: require ditunda + ditelan kalau gagal, supaya app tetap boot di
// Expo Go (cuma tanpa notifikasi HP). Kalau dev build sudah jadi satu-satunya
// target, ganti balik ke `import notifee from '@notifee/react-native'`.
type NotifeeModule = typeof import('@notifee/react-native');

let cached: NotifeeModule | null | undefined;

function getNotifee(): NotifeeModule | null {
  if (cached === undefined) {
    try {
      cached = require('@notifee/react-native') as NotifeeModule;
    } catch {
      cached = null;
    }
  }
  return cached;
}

/**
 * Ambil yang belum pernah dimunculkan, lalu tandai semuanya sudah dilihat.
 * `baseline` = poll pertama: isinya cuma dijadikan penanda, tidak dinotifikasi
 * (kalau tidak, tiap buka app semua notifikasi lama muncul lagi).
 * `sudahDilihat` dimutasi di sini — pemanggilnya cuma perlu satu Set.
 */
export function serapNotifikasi<T extends { id: string }>(
  data: T[],
  sudahDilihat: Set<string>,
  baseline: boolean,
): T[] {
  const baru = baseline ? [] : data.filter((n) => !sudahDilihat.has(n.id));
  for (const n of data) sudahDilihat.add(n.id);
  return baru;
}

const CHANNEL_ID = 'notifikasi-dokter';

/** Minta izin + siapkan channel Android. `false` = notifikasi HP tidak tersedia. */
export async function siapkanNotifikasiHp(): Promise<boolean> {
  const mod = getNotifee();
  if (!mod) return false;

  const { authorizationStatus } = await mod.default.requestPermission();
  if (authorizationStatus < mod.AuthorizationStatus.AUTHORIZED) return false;

  await mod.default.createChannel({
    id: CHANNEL_ID,
    name: 'Notifikasi Dokter',
    importance: mod.AndroidImportance.HIGH,
  });
  return true;
}

export async function tampilkanNotifikasiHp(id: string, judul: string, pesan: string) {
  const mod = getNotifee();
  if (!mod) return;

  await mod.default.displayNotification({
    id,
    title: judul,
    body: pesan,
    android: { channelId: CHANNEL_ID, pressAction: { id: 'default' } },
    // iOS menelan notifikasi yang muncul saat app lagi dibuka kalau ini tidak
    // diset — dan polling kita memang cuma jalan di foreground, jadi tanpa ini
    // di iPhone tidak akan kelihatan apa-apa.
    ios: { foregroundPresentationOptions: { banner: true, list: true, sound: true } },
  });
}
