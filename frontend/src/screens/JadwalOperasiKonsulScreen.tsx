import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme/colors';
import { ms } from '../theme/responsive';
import { Text } from '../components/Text';
import { TextInput } from '../components/TextInput';
import { ScrollToTopButton } from '../components/ScrollToTopButton';
import { ApiError } from '../api/client';
import { fetchOperasiList } from '../api/operasi';
import { fetchKonsultasiList } from '../api/konsultasi';
import { useAuthStore } from '../store/authStore';
import type {
  KonsultasiListItem,
  OperasiListItem,
  OperasiStatus,
  StatusKonsultasi,
} from '../api/types';
import { labelJenisKunjungan } from '../utils/jenisKunjungan';
import { useTabBarClearance } from '../navigation/tabBarMetrics';
import { useTabBarDockOnScroll } from '../hooks/useTabBarDockOnScroll';
import { useScrollToTopButton } from '../hooks/useScrollToTopButton';
import { useAnimatedHeaderFade } from '../hooks/useAnimatedHeaderFade';
import { useCollapseOnScroll } from '../hooks/useCollapseOnScroll';
import type { OperasiStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<OperasiStackParamList, 'JadwalOperasiKonsul'>;

function formatHariIni() {
  return new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatJam(value: string) {
  return new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatTanggalSingkat(value: string) {
  return new Date(value).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
}

// Prioritas grup status buat tampilan "Semua": yang lagi berlangsung/terjadwal
// perlu ditindaklanjuti duluan, baru riwayat selesai, baru yang batal paling bawah.
const STATUS_SORT_ORDER: Record<string, number> = {
  IN_PROGRESS: 0,
  ONGOING: 0,
  SCHEDULED: 1,
  COMPLETED: 2,
  CANCELLED: 3,
};

function sortByStatusThenNearestDate<T>(
  items: T[],
  getStatus: (item: T) => string,
  getDate: (item: T) => string,
): T[] {
  const now = Date.now();
  return [...items].sort((a, b) => {
    const statusDiff = (STATUS_SORT_ORDER[getStatus(a)] ?? 99) - (STATUS_SORT_ORDER[getStatus(b)] ?? 99);
    if (statusDiff !== 0) return statusDiff;
    const distA = Math.abs(new Date(getDate(a)).getTime() - now);
    const distB = Math.abs(new Date(getDate(b)).getTime() - now);
    return distA - distB;
  });
}

const OPERASI_STATUS_META: Record<
  OperasiStatus,
  { label: string; icon: string; bg: string; fg: string }
> = {
  IN_PROGRESS: { label: 'Berlangsung', icon: 'sync', bg: colors.tertiaryContainer, fg: colors.onTertiaryContainer },
  SCHEDULED: { label: 'Terjadwal', icon: 'schedule', bg: colors.primaryContainer, fg: colors.onPrimaryContainer },
  COMPLETED: { label: 'Selesai', icon: 'check-circle', bg: colors.deepTealDark, fg: colors.onPrimary },
  CANCELLED: { label: 'Batal', icon: 'cancel', bg: colors.errorContainer, fg: colors.onErrorContainer },
};

const KONSUL_STATUS_META: Record<
  StatusKonsultasi,
  { label: string; icon: string; bg: string; fg: string }
> = {
  MENUNGGU_JAWABAN: {
    label: 'Menunggu Jawaban',
    icon: 'hourglass-empty',
    bg: colors.primaryContainer,
    fg: colors.onPrimaryContainer,
  },
  SUDAH_DIJAWAB: {
    label: 'Sudah Dijawab',
    icon: 'check-circle',
    bg: colors.deepTealDark,
    fg: colors.onPrimary,
  },
};

// Dua tab, dua kosakata status yang tidak beririsan: Operasi punya siklus
// jadwal (terjadwal/berlangsung/batal), Konsultasi punya dua state surat
// (menunggu jawaban/sudah dijawab). Satu daftar filter untuk keduanya akan
// menawarkan "Batal" pada konsul, yang tidak pernah ada.
type StatusFilter = 'ALL' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | StatusKonsultasi;

const OPERASI_STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Semua' },
  { value: 'SCHEDULED', label: 'Terjadwal' },
  { value: 'COMPLETED', label: 'Selesai' },
  { value: 'CANCELLED', label: 'Batal' },
];

const KONSUL_STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Semua' },
  { value: 'MENUNGGU_JAWABAN', label: 'Menunggu Jawaban' },
  { value: 'SUDAH_DIJAWAB', label: 'Sudah Dijawab' },
];

const TOGGLE_INSET = ms(4);

export function JadwalOperasiKonsulScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { onScroll: onDockScroll, scrollEventThrottle, scrolled } = useTabBarDockOnScroll();
  const { onScroll: onTopButtonScroll, visible: showScrollTop, reset: resetScrollTop } = useScrollToTopButton();
  const { headerBackgroundColor, headerShadowOpacity, headerElevation } = useAnimatedHeaderFade(scrolled);
  // Satu baris per langkah: filter sembunyi duluan, search bar menyusul kalau
  // scroll ke bawah masih lanjut. Toggle Konsultasi/Operasi sengaja tidak ikut —
  // itu penanda posisi, bukan kontrol yang bisa hilang tanpa bikin bingung.
  const { onScroll: onHeaderScroll, top: searchRow, bottom: filterRow } = useCollapseOnScroll();
  const konsulScrollRef = useRef<ScrollView>(null);
  const operasiScrollRef = useRef<ScrollView>(null);
  const token = useAuthStore((s) => s.token);
  const [tab, setTab] = useState<'OPERASI' | 'KONSUL'>('OPERASI');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    resetScrollTop();
    // Filter ikut direset: nilainya milik kosakata status tab sebelumnya, jadi
    // "Batal" yang terbawa ke tab Konsultasi akan menyaring habis semua kartu.
    setStatusFilter('ALL');
  }, [tab, resetScrollTop]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      onDockScroll(e);
      onTopButtonScroll(e);
      onHeaderScroll(e);
    },
    [onDockScroll, onTopButtonScroll, onHeaderScroll],
  );

  function scrollToTop() {
    const ref = tab === 'KONSUL' ? konsulScrollRef : operasiScrollRef;
    ref.current?.scrollTo({ y: 0, animated: true });
  }

  const [toggleWidth, setToggleWidth] = useState(0);
  const toggleIndicatorX = useRef(new Animated.Value(0)).current;
  const toggleItemWidth = Math.max(toggleWidth / 2 - TOGGLE_INSET, 0);

  useEffect(() => {
    if (!toggleItemWidth) return;
    Animated.spring(toggleIndicatorX, {
      toValue: tab === 'OPERASI' ? toggleItemWidth : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 60,
    }).start();
  }, [tab, toggleItemWidth, toggleIndicatorX]);

  const onToggleLayout = (e: LayoutChangeEvent) => setToggleWidth(e.nativeEvent.layout.width);

  const [operasiItems, setOperasiItems] = useState<OperasiListItem[]>([]);
  const [operasiLoading, setOperasiLoading] = useState(true);
  const [operasiError, setOperasiError] = useState<string | null>(null);

  const [konsultasiItems, setKonsultasiItems] = useState<KonsultasiListItem[]>([]);
  const [konsultasiLoading, setKonsultasiLoading] = useState(true);
  const [konsultasiError, setKonsultasiError] = useState<string | null>(null);
  const konsultasiLoaded = useRef(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadOperasi = useCallback(async (opts?: { silent?: boolean }) => {
    if (!token) return;
    if (!opts?.silent) setOperasiLoading(true);
    setOperasiError(null);
    try {
      const result = await fetchOperasiList(token, { page: 1, limit: 50 });
      setOperasiItems(result.data);
    } catch (err) {
      setOperasiError(err instanceof ApiError ? err.message : 'Gagal memuat jadwal operasi');
    } finally {
      if (!opts?.silent) setOperasiLoading(false);
    }
  }, [token]);

  const loadKonsultasi = useCallback(async (opts?: { silent?: boolean }) => {
    if (!token) return;
    if (!opts?.silent) setKonsultasiLoading(true);
    setKonsultasiError(null);
    try {
      const result = await fetchKonsultasiList(token, { page: 1, limit: 50 });
      setKonsultasiItems(result.data);
    } catch (err) {
      setKonsultasiError(err instanceof ApiError ? err.message : 'Gagal memuat daftar konsultasi');
    } finally {
      if (!opts?.silent) setKonsultasiLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadOperasi();
  }, [loadOperasi]);

  useEffect(() => {
    if (tab === 'KONSUL' && !konsultasiLoaded.current) {
      konsultasiLoaded.current = true;
      loadKonsultasi();
    }
  }, [tab, loadKonsultasi]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (tab === 'KONSUL') {
      konsultasiLoaded.current = true;
      await loadKonsultasi({ silent: true });
    } else {
      await loadOperasi({ silent: true });
    }
    setRefreshing(false);
  }, [tab, loadKonsultasi, loadOperasi]);

  function handleOperasiPress(item: OperasiListItem) {
    if (item.status === 'CANCELLED') return;
    navigation.navigate('DetailJadwalOperasi', { operasiId: item.id });
  }

  // Tidak ada state final yang bikin kartu non-tappable seperti operasi
  // CANCELLED: surat konsul yang belum dijawab justru yang paling perlu dibuka.
  function handleKonsultasiPress(item: KonsultasiListItem) {
    navigation.navigate('DetailKonsul', { konsultasiId: item.id });
  }

  const searchTerm = search.trim().toLowerCase();

  const filteredOperasiItems = sortByStatusThenNearestDate(
    (statusFilter === 'ALL' ? operasiItems : operasiItems.filter((item) => item.status === statusFilter)).filter(
      (item) =>
        !searchTerm ||
        item.kunjungan.pasien.nama.toLowerCase().includes(searchTerm) ||
        item.kunjungan.pasien.norm.toLowerCase().includes(searchTerm),
    ),
    (item) => item.status,
    (item) => item.tanggalOperasi,
  );
  // Tanpa sortByStatusThenNearestDate: konsul bukan jadwal, jadi "tanggal
  // terdekat dari sekarang" tidak berarti apa-apa di sini. Server sudah
  // mengurutkan menunggu-jawaban dulu, lalu permintaan terbaru.
  const filteredKonsultasiItems = (
    statusFilter === 'ALL'
      ? konsultasiItems
      : konsultasiItems.filter((item) => item.status === statusFilter)
  ).filter(
    (item) =>
      !searchTerm ||
      item.pasien.nama.toLowerCase().includes(searchTerm) ||
      item.pasien.norm.toLowerCase().includes(searchTerm),
  );

  const statusFilters = tab === 'KONSUL' ? KONSUL_STATUS_FILTERS : OPERASI_STATUS_FILTERS;

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.headerArea,
          {
            paddingTop: insets.top + ms(8),
            backgroundColor: headerBackgroundColor,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowRadius: 8,
            shadowOpacity: headerShadowOpacity,
            elevation: headerElevation,
          },
        ]}
      >
        <View style={styles.toggleGroup}>
          <View style={styles.dateFilter}>
            <MaterialIcons name="calendar-month" size={14} color={colors.onSurfaceVariant} />
            <Text style={styles.dateFilterText}>Hari Ini, {formatHariIni()}</Text>
          </View>
          <View style={styles.toggle} onLayout={onToggleLayout}>
            {toggleItemWidth > 0 && (
              <Animated.View
                style={[
                  styles.toggleIndicator,
                  { width: toggleItemWidth, transform: [{ translateX: toggleIndicatorX }] },
                ]}
              />
            )}
            <Pressable onPress={() => setTab('KONSUL')} style={styles.toggleButton}>
              <Text style={[styles.toggleText, tab === 'KONSUL' && styles.toggleTextActive]}>
                Konsultasi
              </Text>
            </Pressable>
            <Pressable onPress={() => setTab('OPERASI')} style={styles.toggleButton}>
              <Text style={[styles.toggleText, tab === 'OPERASI' && styles.toggleTextActive]}>
                Operasi
              </Text>
            </Pressable>
          </View>
        </View>
        <Animated.View style={searchRow.style} onLayout={searchRow.onLayout}>
          <Animated.View style={[styles.rowSlot, searchRow.innerStyle]}>
            <View style={styles.searchWrapper}>
              <MaterialIcons name="search" size={20} color={colors.primary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Cari Nama atau No. RM..."
                placeholderTextColor={colors.outline}
                style={styles.searchInput}
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch('')} hitSlop={8}>
                  <MaterialIcons name="close" size={18} color={colors.onSurfaceVariant} />
                </Pressable>
              )}
            </View>
          </Animated.View>
        </Animated.View>
        {/* Pembungkus yang menanggung marginHorizontal negatif (bleed chip ke tepi
            layar), bukan ScrollView di dalamnya: useCollapseOnScroll memasang
            overflow hidden di sini, jadi kalau margin negatifnya ada di anak,
            chip paling pinggir malah kepotong. */}
        <Animated.View
          style={[styles.statusFilterScroll, filterRow.style]}
          onLayout={filterRow.onLayout}
        >
          <Animated.View style={[styles.rowSlot, filterRow.innerStyle]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.statusFilterRow}
            >
              {statusFilters.map((f) => {
                const active = statusFilter === f.value;
                return (
                  <Pressable
                    key={f.value}
                    onPress={() => setStatusFilter(f.value)}
                    style={[styles.statusFilterChip, active && styles.statusFilterChipActive]}
                  >
                    <Text style={[styles.statusFilterText, active && styles.statusFilterTextActive]}>
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>
        </Animated.View>

      </Animated.View>

      <View style={styles.sheet}>
      {tab === 'KONSUL' ? (
        konsultasiLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : konsultasiError ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{konsultasiError}</Text>
          </View>
        ) : filteredKonsultasiItems.length === 0 ? (
          <View style={styles.center}>
            <MaterialIcons name="chat-bubble" size={40} color={colors.outlineVariant} />
            <Text style={styles.comingSoonTitle}>
              {konsultasiItems.length === 0
                ? 'Belum ada konsultasi yang ditujukan kepada Anda'
                : 'Tidak ada konsultasi dengan status ini'}
            </Text>
          </View>
        ) : (
          <ScrollView
            ref={konsulScrollRef}
            contentContainerStyle={[styles.listContent, { paddingBottom: tabBarClearance }]}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={scrollEventThrottle}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
            }
          >
            {filteredKonsultasiItems.map((item) => {
              const meta = KONSUL_STATUS_META[item.status];
              const jenisLabel = labelJenisKunjungan(item.jenisKunjungan);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => handleKonsultasiPress(item)}
                  style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                >
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTime}>
                        {formatTanggalSingkat(item.tanggalPermintaan)},{' '}
                        {formatJam(item.tanggalPermintaan)}
                      </Text>
                      <Text style={styles.cardPatient}>{item.pasien.nama}</Text>
                      <Text style={styles.cardTindakan}>{item.diagnosisKerja}</Text>
                    </View>
                    <View style={styles.cardPills}>
                      <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                        <MaterialIcons name={meta.icon as never} size={14} color={meta.fg} />
                        <Text style={[styles.statusPillText, { color: meta.fg }]}>{meta.label}</Text>
                      </View>
                      {/* Cuma CITO yang diberi badge. "BIASA" adalah default dan
                          mencetaknya di setiap kartu justru menenggelamkan yang
                          benar-benar mendesak. */}
                      {item.prioritas === 'CITO' && (
                        <View style={styles.citoPill}>
                          <MaterialIcons name="priority-high" size={14} color={colors.onErrorContainer} />
                          <Text style={styles.citoPillText}>CITO</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.cardDivider} />
                  <View style={styles.cardBottom}>
                    <View style={styles.cardBottomItem}>
                      <MaterialIcons name="outgoing-mail" size={18} color={colors.primary} />
                      <Text style={styles.cardBottomText} numberOfLines={1} ellipsizeMode="tail">
                        Dari {item.dokterPengirim.nama}
                      </Text>
                    </View>
                    {jenisLabel && (
                      <View style={styles.cardBottomItem}>
                        <MaterialIcons name="meeting-room" size={18} color={colors.primary} />
                        <Text style={styles.cardBottomText} numberOfLines={1} ellipsizeMode="tail">
                          {jenisLabel}
                        </Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )
      ) : operasiLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : operasiError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{operasiError}</Text>
        </View>
      ) : filteredOperasiItems.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.comingSoonTitle}>
            {operasiItems.length === 0 ? 'Belum ada jadwal operasi' : 'Tidak ada jadwal dengan status ini'}
          </Text>
        </View>
      ) : (
        <ScrollView
          ref={operasiScrollRef}
          contentContainerStyle={[styles.listContent, { paddingBottom: tabBarClearance }]}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={scrollEventThrottle}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
          }
        >
          {filteredOperasiItems.map((item) => {
            const meta = OPERASI_STATUS_META[item.status];
            const cancelled = item.status === 'CANCELLED';
            return (
              <Pressable
                key={item.id}
                disabled={cancelled}
                onPress={() => handleOperasiPress(item)}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTime}>
                      {formatTanggalSingkat(item.tanggalOperasi)}, {formatJam(item.tanggalOperasi)}
                    </Text>
                    <Text style={styles.cardPatient}>{item.kunjungan.pasien.nama}</Text>
                    <Text style={styles.cardTindakan}>{item.jenisTindakan}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                    <MaterialIcons name={meta.icon as never} size={14} color={meta.fg} />
                    <Text style={[styles.statusPillText, { color: meta.fg }]}>{meta.label}</Text>
                  </View>
                </View>
                <View style={styles.cardDivider} />
                <View style={styles.cardBottom}>
                  <View style={styles.cardBottomItem}>
                    <MaterialIcons name="meeting-room" size={18} color={colors.primary} />
                    <Text style={styles.cardBottomText} numberOfLines={1} ellipsizeMode="tail">
                      {item.ruangan.nama}
                    </Text>
                  </View>
                  <View style={styles.cardBottomItem}>
                    <MaterialIcons name="person" size={18} color={colors.primary} />
                    <Text style={styles.cardBottomText} numberOfLines={1} ellipsizeMode="tail">
                      {item.kunjungan.dokter.nama}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      </View>

      <ScrollToTopButton visible={showScrollTop} onPress={scrollToTop} bottom={tabBarClearance} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  sheet: { flex: 1 },
  headerArea: {
    padding: spacing.marginMobile,
    paddingBottom: ms(12),
    // zIndex biar shadow header jatuh DI ATAS list: tanpa itu sheet di bawahnya
    // digambar belakangan dan menutupi bayangannya sendiri.
    zIndex: 1,
  },
  // Jarak antar band jadi padding di tiap baris, bukan `gap` di headerArea:
  // gap tetap berlaku buat anak setinggi nol, jadi baris yang tersembunyi
  // masih menyisakan celah kosong.
  rowSlot: { paddingTop: ms(8) },
  // dateFilter + toggle digabung 1 kelompok (gap rapat) biar headerArea cuma
  // punya 3 "band" (toggleGroup, search, filter chip), bukan 4 baris rata —
  // tanggal jadi caption yang nempel ke toggle, bukan baris independen sendiri.
  toggleGroup: { gap: ms(4) },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceVariant,
    borderRadius: radius.full,
    padding: ms(4),
    width: '100%',
  },
  toggleButton: { flex: 1, paddingVertical: ms(8), borderRadius: radius.full, alignItems: 'center' },
  toggleIndicator: {
    position: 'absolute',
    top: TOGGLE_INSET,
    bottom: TOGGLE_INSET,
    left: TOGGLE_INSET,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  toggleText: { fontSize: ms(12), fontWeight: '800', color: colors.onSurfaceVariant },
  toggleTextActive: { color: colors.onPrimary },
  dateFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(6),
    paddingHorizontal: ms(4),
  },
  dateFilterText: { fontSize: ms(12), fontWeight: '600', color: colors.onSurfaceVariant },

  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(12),
    backgroundColor: colors.surfaceVariant,
    borderRadius: radius.full,
    paddingHorizontal: ms(16),
    paddingVertical: ms(7),
    width: '100%',
  },
  searchInput: { flex: 1, fontSize: ms(14), color: colors.onSurface, paddingVertical: 0 },

  statusFilterScroll: { marginHorizontal: -spacing.marginMobile },
  statusFilterRow: {
    flexDirection: 'row',
    flexGrow: 1,
    justifyContent: 'center',
    gap: ms(8),
    paddingHorizontal: spacing.marginMobile,
  },
  statusFilterChip: {
    paddingHorizontal: ms(14),
    paddingVertical: ms(6),
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}80`,
  },
  statusFilterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  statusFilterText: { fontSize: ms(12), fontWeight: '600', color: colors.primary },
  statusFilterTextActive: { color: colors.onPrimary },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: ms(8), padding: ms(32) },
  comingSoonTitle: { fontSize: ms(16), fontWeight: '700', color: colors.onSurfaceVariant },
  errorText: { color: colors.error, textAlign: 'center' },

  listContent: { padding: spacing.marginMobile, paddingTop: ms(8), gap: spacing.gutter },
  card: {
    backgroundColor: colors.backgroundWhite,
    borderRadius: ms(radius.md),
    padding: spacing.cardPadding,
    gap: ms(16),
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  cardPressed: { opacity: 0.92 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTime: { fontSize: ms(12), fontWeight: '600', color: colors.outline },
  cardPatient: { fontSize: ms(20), fontWeight: '700', color: colors.onSurface, marginTop: ms(4) },
  cardTindakan: { fontSize: ms(14), color: colors.onSurfaceVariant, marginTop: ms(2) },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(4),
    paddingHorizontal: ms(12),
    paddingVertical: ms(6),
    borderRadius: radius.full,
  },
  statusPillText: { fontSize: ms(12), fontWeight: '600' },
  // Dua pill bertumpuk di pojok kanan kartu, rata kanan supaya tepinya lurus
  // dengan pill status di kartu-kartu yang tidak punya CITO.
  cardPills: { alignItems: 'flex-end', gap: ms(6) },
  citoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(2),
    paddingLeft: ms(6),
    paddingRight: ms(10),
    paddingVertical: ms(4),
    borderRadius: radius.full,
    backgroundColor: colors.errorContainer,
  },
  citoPillText: { fontSize: ms(11), fontWeight: '800', color: colors.onErrorContainer },
  cardDivider: { height: 1, backgroundColor: colors.surfaceVariant },
  cardBottom: { flexDirection: 'row', gap: ms(16) },
  cardBottomItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: ms(6), minWidth: 0 },
  cardBottomText: { flexShrink: 1, fontSize: ms(14), color: colors.onSurfaceVariant },
});
