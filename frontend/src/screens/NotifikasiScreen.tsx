import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme/colors';
import { ms } from '../theme/responsive';
import { Text } from '../components/Text';
import { ApiError } from '../api/client';
import { fetchNotifikasiList, markNotifikasiRead } from '../api/notifikasi';
import { useAuthStore } from '../store/authStore';
import type { NotifikasiItemApi, NotifikasiTipe } from '../api/types';
import { notifikasiList as notifikasiMockList } from '../mocks/notifikasiMock';
import { useTabBarClearance } from '../navigation/tabBarMetrics';
import { useTabBarDockOnScroll } from '../hooks/useTabBarDockOnScroll';
import { useAnimatedHeaderFade } from '../hooks/useAnimatedHeaderFade';
import { ContentSheet, SHEET_OVERLAP } from '../components/ContentSheet';
import type { NotifikasiStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<NotifikasiStackParamList, 'NotifikasiList'>;

type DisplayKategori = 'Lab' | 'Pasien Baru' | 'Jadwal';

type DisplayItem = {
  id: string;
  kategori: DisplayKategori;
  judul: string;
  pesan: string;
  waktu: string;
  isRead: boolean;
  icon: string;
  bukaLaporanLab?: boolean;
  /** Item demo statis (entity Laporan Lab belum ada modelnya) — tidak pernah manggil API. */
  isDemo?: boolean;
  /** Cuma diisi dari respons API — dipakai buat tampilan ADMIN (lintas dokter). */
  dokterNama?: string;
};

// entity "Laporan Lab" belum ada modelnya (lihat CLAUDE.md) — DetailLaporanLabScreen
// tetap murni UI dekoratif, jadi entry point-nya di sini tetap statis dari mock,
// bukan hasil fetch ke /api/notifikasi (beda entity, jangan disambungin).
const LAB_DEMO_ITEM: DisplayItem | undefined = (() => {
  const mock = notifikasiMockList.find((n) => n.bukaLaporanLab);
  if (!mock) return undefined;
  return {
    id: mock.id,
    kategori: 'Lab',
    judul: mock.judul,
    pesan: mock.pesan,
    waktu: mock.waktu,
    isRead: mock.isRead,
    icon: mock.icon,
    bukaLaporanLab: true,
    isDemo: true,
  };
})();

const TIPE_META: Record<NotifikasiTipe, { kategori: DisplayKategori; judul: string; icon: string }> = {
  PASIEN_BARU: { kategori: 'Pasien Baru', judul: 'Pasien Baru Ditugaskan', icon: 'person-add' },
  REMINDER_OPERASI: { kategori: 'Jadwal', judul: 'Pengingat Operasi', icon: 'event' },
  PERUBAHAN_JADWAL: { kategori: 'Jadwal', judul: 'Perubahan Jadwal', icon: 'event-busy' },
};

// Tint per kategori (reuse token yang udah ada, bukan hex baru) — biar filter
// kategori kebaca cepat dari warna, pola sama kayak NAVIGASI_TINTS di Home.
const KATEGORI_TINT: Record<DisplayKategori, string> = {
  Lab: colors.primaryContainer,
  'Pasien Baru': colors.primary,
  Jadwal: colors.tertiaryContainer,
};

const FILTERS: { label: string; value: DisplayKategori | 'Semua' }[] = [
  { label: 'Semua', value: 'Semua' },
  { label: 'Hasil Lab', value: 'Lab' },
  { label: 'Pasien Baru', value: 'Pasien Baru' },
  { label: 'Jadwal', value: 'Jadwal' },
];

function formatWaktu(iso: string) {
  const date = new Date(iso);
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);

  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) {
    return `Kemarin, ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return `${diffDay} hari lalu`;
}

function toDisplayItem(item: NotifikasiItemApi): DisplayItem {
  const meta = TIPE_META[item.tipe];
  return {
    id: item.id,
    kategori: meta.kategori,
    judul: meta.judul,
    pesan: item.pesan,
    waktu: formatWaktu(item.createdAt),
    isRead: item.isRead,
    icon: meta.icon,
    dokterNama: item.dokter.nama,
  };
}

export function NotifikasiScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { onScroll, scrollEventThrottle, scrolled } = useTabBarDockOnScroll();
  const { headerBackgroundColor, headerShadowOpacity, headerElevation } = useAnimatedHeaderFade(scrolled);
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.pengguna?.role);
  const isAdmin = role === 'ADMIN';
  const [filter, setFilter] = useState<DisplayKategori | 'Semua'>('Semua');
  const [apiItems, setApiItems] = useState<NotifikasiItemApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // LAB_DEMO_ITEM dikecualikan dari markNotifikasiRead (bukan entity asli, lihat
  // komentar di atas) — status baca-nya dilacak lokal aja biar titik unread-nya
  // ilang begitu dibuka, tanpa nyoba nulis ke /api/notifikasi.
  const [labDemoRead, setLabDemoRead] = useState(LAB_DEMO_ITEM?.isRead ?? false);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!token) return;
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const result = await fetchNotifikasiList(token, { page: 1, limit: 50 });
      setApiItems(result.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat notifikasi');
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load({ silent: true });
    setRefreshing(false);
  }, [load]);

  const items = [
    ...(LAB_DEMO_ITEM ? [{ ...LAB_DEMO_ITEM, isRead: labDemoRead }] : []),
    ...apiItems.map(toDisplayItem),
  ].filter((n) => filter === 'Semua' || n.kategori === filter);

  function handlePress(item: DisplayItem) {
    if (item.bukaLaporanLab) {
      setLabDemoRead(true);
      navigation.navigate('DetailLaporanLab');
      return;
    }

    // ADMIN cuma boleh lihat notifikasi dokter lain — mark-as-read tetap
    // hak milik dokter yang bersangkutan, jadi jangan dicoba dari sini.
    const willMarkRead = !item.isDemo && !item.isRead && !!token && role === 'DOKTER';
    if (willMarkRead) {
      setApiItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)));
      markNotifikasiRead(token as string, item.id).catch(() => {
        setApiItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, isRead: false } : n)));
      });
    }

    navigation.navigate('DetailNotifikasi', {
      kategori: item.kategori as 'Pasien Baru' | 'Jadwal',
      judul: item.judul,
      pesan: item.pesan,
      waktu: item.waktu,
      icon: item.icon,
      isRead: item.isRead || willMarkRead,
      dokterNama: isAdmin ? item.dokterNama : undefined,
    });
  }

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.header,
          { paddingTop: insets.top + ms(6), backgroundColor: headerBackgroundColor },
        ]}
      >
        <View>
          <Text style={styles.title}>Notifikasi</Text>
          <Text style={styles.subtitle}>Pembaruan klinis dan jadwal Anda.</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <Pressable
                key={f.value}
                onPress={() => setFilter(f.value)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>

      <ContentSheet shadowOpacity={headerShadowOpacity} elevation={headerElevation}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Tidak ada notifikasi.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
          }
        >
          <View style={{ gap: spacing.gutter }}>
            {items.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => handlePress(item)}
                style={({ pressed }) => [
                  styles.card,
                  !item.isRead && styles.cardUnread,
                  pressed && styles.cardPressed,
                ]}
              >
                {!item.isRead && <View style={styles.unreadDot} />}
                <View
                  style={[
                    styles.iconCircle,
                    item.isRead && styles.iconCircleRead,
                    item.kategori === 'Jadwal' && !item.isRead && styles.iconCircleJadwal,
                  ]}
                >
                  <MaterialIcons
                    name={item.icon as never}
                    size={22}
                    color={item.isRead ? colors.outline : colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTopRow}>
                    <View style={styles.cardTopLeft}>
                      <View
                        style={[
                          styles.kategoriPill,
                          { backgroundColor: `${KATEGORI_TINT[item.kategori]}1A` },
                        ]}
                      >
                        <Text style={[styles.kategoriPillText, { color: KATEGORI_TINT[item.kategori] }]}>
                          {item.kategori}
                        </Text>
                      </View>
                      {item.isDemo && <Text style={styles.demoLabel}>Contoh</Text>}
                    </View>
                    <Text style={styles.waktuText}>{item.waktu}</Text>
                  </View>
                  {isAdmin && item.dokterNama && (
                    <Text style={styles.dokterNamaText} numberOfLines={1}>
                      {item.dokterNama}
                    </Text>
                  )}
                  <Text style={styles.judul} numberOfLines={2}>
                    {item.judul}
                  </Text>
                  <Text style={styles.pesan} numberOfLines={2}>
                    {item.pesan}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
      </ContentSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: colors.error, textAlign: 'center' },
  emptyText: { color: colors.onSurfaceVariant, textAlign: 'center' },
  header: {
    paddingHorizontal: spacing.marginMobile,
    // Sheet di bawah menindih header, jadi padding bawahnya ditambah sebanyak
    // tindihan itu — kalau tidak, baris chip filter ketutupan.
    paddingBottom: ms(10) + SHEET_OVERLAP,
    backgroundColor: colors.background,
    // Garis bawah dilepas: pemisah header sekarang lengkung sheet + shadow-nya,
    // dan garis itu bakal terpotong melintang di tengah lengkungan.
  },
  content: { padding: spacing.marginMobile, gap: spacing.gutter, paddingBottom: ms(32) },
  title: { fontSize: ms(20), fontWeight: '800', color: colors.onBackground },
  subtitle: { fontSize: ms(12), color: colors.outline, marginTop: ms(2) },

  filterScroll: { marginHorizontal: -spacing.marginMobile, marginTop: ms(10) },
  filterRow: { flexDirection: 'row', gap: ms(8), paddingHorizontal: spacing.marginMobile },
  filterChip: {
    paddingHorizontal: ms(14),
    paddingVertical: ms(6),
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}80`,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: ms(12), fontWeight: '600', color: colors.primary },
  filterChipTextActive: { color: colors.onPrimary },

  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: ms(radius.md),
    padding: ms(20),
    flexDirection: 'row',
    gap: ms(16),
    alignItems: 'flex-start',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  cardUnread: {
    shadowOpacity: 0.1,
    elevation: 3,
  },
  cardPressed: { opacity: 0.9 },
  unreadDot: {
    position: 'absolute',
    top: ms(22),
    left: ms(10),
    width: ms(10),
    height: ms(10),
    borderRadius: ms(5),
    backgroundColor: colors.tertiaryFixedDim,
  },
  iconCircle: {
    width: ms(48),
    height: ms(48),
    borderRadius: ms(12),
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: ms(8),
  },
  iconCircleRead: { backgroundColor: colors.surfaceVariant },
  iconCircleJadwal: { backgroundColor: colors.errorContainer },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: ms(4),
  },
  cardTopLeft: { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
  kategoriPill: {
    paddingHorizontal: ms(8),
    paddingVertical: ms(2),
    borderRadius: ms(6),
  },
  kategoriPillText: { fontSize: ms(10), fontWeight: '700' },
  demoLabel: { fontSize: ms(10), fontWeight: '600', fontStyle: 'italic', color: colors.outline },
  waktuText: { fontSize: ms(11), color: colors.outline },
  dokterNamaText: { fontSize: ms(12), fontWeight: '600', color: colors.primary, marginBottom: ms(2) },
  judul: { fontSize: ms(16), fontWeight: '700', color: colors.onBackground, marginBottom: ms(4) },
  pesan: { fontSize: ms(13), color: colors.onSurfaceVariant },
});
