import { useCallback, useEffect, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { ActivityIndicator, Animated, FlatList, Modal, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../api/client';
import { fetchPasienList } from '../api/pasien';
import { useAuthStore } from '../store/authStore';
import { colors, radius, spacing } from '../theme/colors';
import { Text } from '../components/Text';
import { TextInput } from '../components/TextInput';
import { ScrollToTopButton } from '../components/ScrollToTopButton';
import type { AssignmentStatus, JenisKunjungan, PasienListItem, UrutanPasien } from '../api/types';
import { JENIS_KUNJUNGAN_LABEL, labelJenisKunjungan } from '../utils/jenisKunjungan';
import { useTabBarClearance } from '../navigation/tabBarMetrics';
import { useTabBarDockOnScroll } from '../hooks/useTabBarDockOnScroll';
import { useScrollToTopButton } from '../hooks/useScrollToTopButton';
import { useAnimatedHeaderFade } from '../hooks/useAnimatedHeaderFade';
import { useCollapseOnScroll } from '../hooks/useCollapseOnScroll';
import type { PasienStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<PasienStackParamList, 'PasienList'>;

type Opsi<T> = { label: string; value: T };

// Dua dropdown, bukan enam chip: dua kelompok filter yang berdiri sendiri tidak
// muat satu baris di layar ponsel, dan yang dibungkus jadi dua baris ikut
// menaikkan tinggi header yang menyusut-mengembang waktu scroll.
const STATUS_OPTIONS: Opsi<AssignmentStatus | undefined>[] = [
  { label: 'Semua', value: undefined },
  { label: 'Aktif', value: 'ACTIVE' },
  { label: 'Selesai', value: 'COMPLETED' },
];

// Tanpa pilihan = urut nama A-Z, bawaan server. "Terbaru"/"terlama" mengacu ke
// tanggal kunjungan terakhir — kolom yang sama yang tampil di kaki tiap kartu.
const URUTAN_OPTIONS: Opsi<UrutanPasien | undefined>[] = [
  { label: 'Nama A-Z', value: undefined },
  { label: 'Kunjungan terbaru', value: 'terbaru' },
  { label: 'Kunjungan terlama', value: 'terlama' },
];

const JENIS_OPTIONS: Opsi<JenisKunjungan | undefined>[] = [
  { label: 'Semua', value: undefined },
  // Dibangun dari peta label, bukan diketik ulang, supaya tidak melenceng dari
  // label yang dipakai badge di kartu.
  ...(['RAWAT_JALAN', 'IGD', 'RAWAT_INAP'] as JenisKunjungan[]).map((value) => ({
    label: JENIS_KUNJUNGAN_LABEL[value],
    value,
  })),
];

// Tombol + bottom sheet, mengikuti pola dropdown bulan di DataPendapatanScreen.
// Waktu tidak ada yang dipilih tombolnya menampilkan nama dimensinya
// ("Status"), bukan "Semua" — dua tombol bertuliskan "Semua" bersebelahan tidak
// memberi tahu apa pun soal isinya.
function FilterDropdown<T>({
  judul,
  labelKosong,
  opsi,
  nilai,
  onPilih,
}: {
  judul: string;
  labelKosong: string;
  opsi: Opsi<T>[];
  nilai: T;
  onPilih: (nilai: T) => void;
}) {
  const insets = useSafeAreaInsets();
  const [terbuka, setTerbuka] = useState(false);
  const aktif = nilai !== undefined;
  const label = aktif ? (opsi.find((o) => o.value === nilai)?.label ?? labelKosong) : labelKosong;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${judul}: ${label}`}
        onPress={() => setTerbuka(true)}
        style={({ pressed }) => [styles.dropdown, aktif && styles.dropdownAktif, pressed && styles.ditekan]}
      >
        <Text style={[styles.dropdownText, aktif && styles.dropdownTextAktif]}>{label}</Text>
        <MaterialIcons
          name="expand-more"
          size={18}
          color={aktif ? colors.onPrimary : colors.onSurfaceVariant}
        />
      </Pressable>

      <Modal visible={terbuka} transparent animationType="fade" onRequestClose={() => setTerbuka(false)}>
        <Pressable style={styles.backdrop} onPress={() => setTerbuka(false)} />
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.gutter }]}>
          <Text style={styles.sheetTitle}>{judul}</Text>
          {opsi.map((o) => {
            const terpilih = o.value === nilai;
            return (
              <Pressable
                key={o.label}
                accessibilityRole="button"
                onPress={() => {
                  onPilih(o.value);
                  setTerbuka(false);
                }}
                style={({ pressed }) => [styles.sheetItem, pressed && styles.ditekan]}
              >
                <Text style={[styles.sheetItemText, terpilih && styles.sheetItemTextActive]}>
                  {o.label}
                </Text>
                {terpilih && <MaterialIcons name="check" size={20} color={colors.primary} />}
              </Pressable>
            );
          })}
        </View>
      </Modal>
    </>
  );
}

const STATUS_BADGE: Record<AssignmentStatus, { label: string; bg: string; fg: string }> = {
  ACTIVE: { label: 'AKTIF', bg: colors.primary, fg: colors.onPrimary },
  COMPLETED: { label: 'SELESAI', bg: colors.deepTealDark, fg: colors.onPrimary },
};

function formatTanggal(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function initials(nama: string) {
  const parts = nama.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

// Hasil terakhir per kombinasi filter, disimpan di level modul — bukan di
// state, karena navigator meng-unmount layar ini tiap kali dokter membuka detail
// pasien lalu kembali.
//
// Tujuannya BUKAN menghemat request: request tetap jalan tiap kali. Yang
// dihilangkan adalah layar kosong selama menunggunya. Di mode SIMRS satu
// permintaan daftar pasien makan 1,5-2 detik, dan menatap spinner selama itu
// setiap kali kembali dari detail adalah keluhan yang paling terasa.
//
// Catatan: cache sederhana tanpa TTL dan tanpa batas ukuran, hidup selama
// proses app. Aman di sini karena kuncinya cuma kombinasi filter (belasan
// kemungkinan, masing-masing 50 baris). Kalau nanti jadi infinite scroll atau
// filternya bercabang banyak, ganti ke LRU atau langsung pakai React Query.
const cacheDaftar = new Map<string, PasienListItem[]>();

function kunciCache(f: {
  search: string;
  status?: AssignmentStatus;
  jenis?: JenisKunjungan;
  urutkan?: UrutanPasien;
}) {
  return `${f.search}|${f.status ?? ''}|${f.jenis ?? ''}|${f.urutkan ?? ''}`;
}

export function PasienListScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { onScroll: onDockScroll, scrollEventThrottle, scrolled } = useTabBarDockOnScroll();
  const { onScroll: onTopButtonScroll, visible: showScrollTop } = useScrollToTopButton();
  const { headerBackgroundColor, headerShadowOpacity, headerElevation } = useAnimatedHeaderFade(scrolled);
  // Satu baris per langkah: filter sembunyi duluan, search bar menyusul kalau
  // scroll ke bawah masih lanjut; ke arah sebaliknya search bar duluan yang balik.
  const { onScroll: onHeaderScroll, top: searchRow, bottom: filterRow } = useCollapseOnScroll();
  const listRef = useRef<FlatList<PasienListItem>>(null);
  const token = useAuthStore((s) => s.token);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AssignmentStatus | undefined>(undefined);
  const [jenis, setJenis] = useState<JenisKunjungan | undefined>(undefined);
  const [urutkan, setUrutkan] = useState<UrutanPasien | undefined>(undefined);
  const [items, setItems] = useState<PasienListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      onDockScroll(e);
      onTopButtonScroll(e);
      onHeaderScroll(e);
    },
    [onDockScroll, onTopButtonScroll, onHeaderScroll],
  );

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!token) return;

    const kunci = kunciCache({ search, status, jenis, urutkan });
    const tersimpan = cacheDaftar.get(kunci);

    // Sudah pernah dimuat dengan filter yang sama -> tampilkan detik itu juga,
    // data barunya menyusul diam-diam. Spinner cuma muncul kalau memang belum
    // ada apa-apa untuk ditampilkan.
    if (tersimpan) {
      setItems(tersimpan);
      setLoading(false);
    } else if (!opts?.silent) {
      setLoading(true);
    }

    setError(null);
    try {
      const result = await fetchPasienList(token, {
        search,
        status,
        jenisKunjungan: jenis,
        urutkan,
        page: 1,
        limit: 50,
      });
      cacheDaftar.set(kunci, result.data);
      setItems(result.data);
    } catch (err) {
      // Layar yang sudah berisi data lama tidak diganti jadi layar error —
      // data agak basi jauh lebih berguna daripada layar kosong, dan pull-to-
      // refresh tetap tersedia kalau dokter mau memaksa.
      if (!tersimpan) {
        setError(err instanceof ApiError ? err.message : 'Gagal memuat data pasien');
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [token, search, status, jenis, urutkan]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load({ silent: true });
    setRefreshing(false);
  }, [load]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.header,
          {
            paddingTop: insets.top,
            backgroundColor: headerBackgroundColor,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowRadius: 8,
            shadowOpacity: headerShadowOpacity,
            elevation: headerElevation,
          },
        ]}
      >
        <Animated.View style={searchRow.style} onLayout={searchRow.onLayout}>
          <Animated.View style={[styles.searchSlot, searchRow.innerStyle]}>
            <View style={styles.searchWrapper}>
              <MaterialIcons name="search" size={20} color={colors.primary} />
              <TextInput
                value={searchInput}
                onChangeText={setSearchInput}
                placeholder="Cari Nama atau No. RM..."
                placeholderTextColor={colors.outline}
                style={styles.searchInput}
              />
              {searchInput.length > 0 && (
                <Pressable onPress={() => setSearchInput('')} hitSlop={8}>
                  <MaterialIcons name="close" size={18} color={colors.onSurfaceVariant} />
                </Pressable>
              )}
            </View>
          </Animated.View>
        </Animated.View>

        <Animated.View style={filterRow.style} onLayout={filterRow.onLayout}>
          {/* Digeser mendatar, bukan dibungkus ke baris kedua: tiga dropdown
              tidak muat sekaligus begitu labelnya terisi pilihan ("Kunjungan
              terbaru"), dan baris kedua menaikkan tinggi header yang
              menyusut-mengembang waktu scroll. */}
          <Animated.ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={filterRow.innerStyle}
            contentContainerStyle={styles.filterRow}
          >
            <FilterDropdown
              judul="Status pasien"
              labelKosong="Status"
              opsi={STATUS_OPTIONS}
              nilai={status}
              onPilih={setStatus}
            />
            <FilterDropdown
              judul="Jenis kunjungan"
              labelKosong="Jenis Kunjungan"
              opsi={JENIS_OPTIONS}
              nilai={jenis}
              onPilih={setJenis}
            />
            <FilterDropdown
              judul="Urutkan"
              labelKosong="Urutkan"
              opsi={URUTAN_OPTIONS}
              nilai={urutkan}
              onPilih={setUrutkan}
            />
          </Animated.ScrollView>
        </Animated.View>
      </Animated.View>

      <View style={styles.sheet}>
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
          <Text style={styles.emptyText}>Tidak ada pasien ditemukan.</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: tabBarClearance }]}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={scrollEventThrottle}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
          }
          renderItem={({ item }) => {
            const badge = STATUS_BADGE[item.status];
            const jenisLabel = labelJenisKunjungan(item.jenisKunjungan);
            return (
              <Pressable
                onPress={() =>
                  navigation.navigate('PasienDetail', { pasienId: item.id, nama: item.nama })
                }
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{initials(item.nama)}</Text>
                    </View>
                    <View style={styles.cardHeaderInfo}>
                      <Text style={styles.cardName} numberOfLines={1} ellipsizeMode="tail">
                        {item.nama}
                      </Text>
                      <Text style={styles.cardRm}>RM: {item.norm}</Text>
                    </View>
                  </View>
                  {/* Dua badge dikumpulkan rata kanan, bukan dipisah ke footer
                      dekat tanggal kunjungan — meski kategori itu sifat
                      kunjungan bukan sifat tetap pasien, dokter membacanya
                      sebagai satu kesatuan "keadaan pasien ini sekarang". */}
                  <View style={styles.cardPills}>
                    <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: badge.fg }]}>
                        {badge.label}
                      </Text>
                    </View>
                    {jenisLabel && (
                      <View style={styles.jenisBadge}>
                        <Text style={styles.jenisBadgeText}>{jenisLabel}</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.diagnosisBox}>
                  <Text style={styles.diagnosisLabel}>Diagnosis</Text>
                  <Text style={styles.diagnosisValue}>
                    {item.diagnosaSingkat ?? 'Belum ada diagnosa'}
                  </Text>
                </View>

                <View style={styles.cardFooter}>
                  <View>
                    <Text style={styles.footerLabel}>Kunjungan Terakhir</Text>
                    <Text style={styles.footerValue}>
                      {formatTanggal(item.tanggalKunjunganTerakhir)}
                    </Text>
                  </View>
                  <View style={styles.footerRight}>
                    <Text style={styles.footerLabel}>Jadwal Berikutnya</Text>
                    <Text style={[styles.footerValue, styles.footerValuePrimary]}>
                      {formatTanggal(item.tanggalKunjunganBerikutnya)}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
      </View>

      <ScrollToTopButton
        visible={showScrollTop}
        onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
        bottom={tabBarClearance}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: colors.error, textAlign: 'center' },
  emptyText: { color: colors.onSurfaceVariant, textAlign: 'center' },

  header: {
    // Jarak bawah ditaruh di header, bukan di baris filter: baris filter ikut
    // menyusut waktu disembunyikan, jadi kalau jaraknya nempel di sana search
    // bar berakhir persis di tepi header dan list lewat menempel di bawahnya.
    paddingBottom: 12,
    // zIndex biar shadow header jatuh DI ATAS list: tanpa itu sheet di bawahnya
    // digambar belakangan dan menutupi bayangannya sendiri.
    zIndex: 1,
  },
  sheet: { flex: 1 },
  // Jarak atas search bar padding di kotak yang menyusut, bukan margin di search
  // bar-nya: margin tidak ikut terhitung di tinggi yang diukur useCollapseOnScroll.
  searchSlot: { paddingTop: spacing.base },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: spacing.marginMobile,
    backgroundColor: colors.surfaceVariant,
    borderRadius: radius.full,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.onSurface,
    paddingVertical: 0,
  },

  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.marginMobile,
    // Jarak atas sengaja padding, bukan margin: margin tidak ikut terhitung di
    // tinggi yang diukur useCollapseOnScroll, jadi kalau pakai margin barisnya
    // menyisakan celah kosong waktu sudah tersembunyi. Jarak bawahnya pindah ke
    // styles.header supaya tidak ikut hilang waktu baris ini menyusut.
    paddingTop: 12,
  },
  ditekan: { opacity: 0.7 },

  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.surfaceVariant,
  },
  dropdownAktif: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dropdownText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurface,
  },
  dropdownTextAktif: {
    color: colors.onPrimary,
  },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000066' },
  // `sheet` di atas sudah dipakai panel konten layar ini — ini yang modal.
  modalSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surfaceContainerLowest,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.cardPadding,
  },
  sheetTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.outline,
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: spacing.base,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.marginMobile,
    paddingVertical: 14,
  },
  sheetItemText: { fontSize: 15, color: colors.onSurface },
  sheetItemTextActive: { fontWeight: '800', color: colors.primary },

  listContent: {
    padding: spacing.marginMobile,
    gap: spacing.gutter,
  },
  card: {
    backgroundColor: colors.backgroundWhite,
    borderRadius: radius.md,
    padding: spacing.cardPadding,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.95,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  cardHeaderInfo: {
    flexShrink: 1,
    minWidth: 0,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onBackground,
  },
  cardRm: {
    fontSize: 12,
    color: colors.outline,
    marginTop: 2,
  },
  statusBadge: {
    flexShrink: 0,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // Rata kanan supaya tepi kedua badge lurus, dan kartu tanpa badge kategori
  // tetap sejajar dengan yang punya.
  cardPills: {
    alignItems: 'flex-end',
    gap: 6,
    flexShrink: 0,
  },
  jenisBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSoft,
  },
  // Huruf besar & jarak huruf disamakan dengan statusBadgeText: begitu keduanya
  // bertumpuk, beda kapitalisasi bikin yang bawah terbaca seperti elemen lain
  // yang kebetulan nyasar ke situ, bukan pasangan badge di atasnya.
  jenisBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.primary,
  },

  diagnosisBox: {
    backgroundColor: colors.surfaceBright,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.surfaceVariant,
  },
  diagnosisLabel: {
    fontSize: 12,
    color: colors.outline,
    marginBottom: 4,
  },
  diagnosisValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onSurface,
  },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceVariant,
  },
  footerRight: {
    alignItems: 'flex-end',
  },
  footerLabel: {
    fontSize: 12,
    color: colors.outline,
    marginBottom: 2,
  },
  footerValue: {
    fontSize: 14,
    color: colors.onSurface,
  },
  footerValuePrimary: {
    color: colors.primary,
    fontWeight: '600',
  },
});
