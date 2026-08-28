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
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme/colors';
import { ms } from '../theme/responsive';
import { Text } from '../components/Text';
import { TextInput } from '../components/TextInput';
import { ScrollToTopButton } from '../components/ScrollToTopButton';
import { FilterTanggal } from '../components/FilterTanggal';
import { ApiError } from '../api/client';
import { fetchOperasiList } from '../api/operasi';
import { fetchKonsultasiList } from '../api/konsultasi';
import { fetchKunjunganList } from '../api/kunjungan';
import { useAuthStore } from '../store/authStore';
import type {
  LingkupJadwal,
  KonsultasiListItem,
  KunjunganListItem,
  OperasiListItem,
  OperasiStatus,
  StatusKonsultasi,
  StatusKunjungan,
} from '../api/types';
import { labelJenisKunjungan } from '../utils/jenisKunjungan';
import { toDateParam } from '../utils/tanggal';
import { useTabBarClearance } from '../navigation/tabBarMetrics';
import { useTabBarDockOnScroll } from '../hooks/useTabBarDockOnScroll';
import { useScrollToTopButton } from '../hooks/useScrollToTopButton';
import { useAnimatedHeaderFade } from '../hooks/useAnimatedHeaderFade';
import { useCollapseOnScroll } from '../hooks/useCollapseOnScroll';
import type { OperasiStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<OperasiStackParamList, 'JadwalOperasiKonsul'>;

function formatJam(value: string) {
  return new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

/** Apakah `iso` jatuh pada tanggal kalender `hariIni` ('YYYY-MM-DD')? */
function padaHariIni(iso: string, hariIni: string) {
  return toDateParam(new Date(iso)) === hariIni;
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

// Kunjungan poliklinik memakai kosakata status yang sama dengan Operasi, hanya
// "berlangsung"-nya bernama ONGOING, bukan IN_PROGRESS.
const KUNJUNGAN_STATUS_META: Record<
  StatusKunjungan,
  { label: string; icon: string; bg: string; fg: string }
> = {
  ONGOING: OPERASI_STATUS_META.IN_PROGRESS,
  SCHEDULED: OPERASI_STATUS_META.SCHEDULED,
  COMPLETED: OPERASI_STATUS_META.COMPLETED,
  CANCELLED: OPERASI_STATUS_META.CANCELLED,
};

// Tiga tab, tiga kosakata status yang tidak saling beririsan: Poliklinik &
// Operasi punya siklus jadwal (terjadwal/berlangsung/selesai/batal), Surat
// Konsul cuma punya dua state surat (menunggu jawaban/sudah dijawab). Satu
// daftar filter untuk semuanya akan menawarkan "Batal" pada surat konsul,
// yang tidak pernah ada.
type StatusFilter = 'ALL' | OperasiStatus | StatusKunjungan | StatusKonsultasi;

const OPERASI_STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Semua' },
  { value: 'SCHEDULED', label: 'Terjadwal' },
  { value: 'COMPLETED', label: 'Selesai' },
  { value: 'CANCELLED', label: 'Batal' },
];

const POLI_STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Semua' },
  { value: 'SCHEDULED', label: 'Terjadwal' },
  { value: 'ONGOING', label: 'Berlangsung' },
  { value: 'COMPLETED', label: 'Selesai' },
  { value: 'CANCELLED', label: 'Batal' },
];

const KONSUL_STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Semua' },
  { value: 'MENUNGGU_JAWABAN', label: 'Menunggu Jawaban' },
  { value: 'SUDAH_DIJAWAB', label: 'Sudah Dijawab' },
];

// Urutan di sini = urutan tombol di toggle = posisi indikatornya. "Poliklinik"
// duluan karena itu yang paling sering ditanya dokter ("hari ini saya ada
// apa"). Label sengaja tidak memakai kata "Konsul" sendirian: di repo ini kata
// itu bisa berarti dua hal berbeda — Kunjungan poliklinik (lihat komentar
// "Modul Konsul" di backend/src/routes/kunjungan.routes.js) DAN surat konsul
// antar-dokter (model Konsultasi). Tab ini yang memisahkan keduanya, jadi
// namanya harus eksplisit.
const TABS = [
  { value: 'POLI', label: 'Poliklinik' },
  { value: 'OPERASI', label: 'Operasi' },
  { value: 'KONSUL', label: 'Surat Konsul' },
] as const;

type TabValue = (typeof TABS)[number]['value'];

// "Pasien saya" sengaja tidak dinamai "Semua" — yang ditambahkan bukan seluruh
// rumah sakit, melainkan kunjungan/operasi pasien dokter ini yang ditangani
// dokter lain. Label "Semua" akan bikin dokter mengira dia melihat jadwal RS.
const LINGKUP_FILTERS: { value: LingkupJadwal; label: string }[] = [
  { value: 'saya', label: 'Jadwal saya' },
  { value: 'pasien', label: 'Pasien saya' },
];

// Cakupan bawaan tiap tab, ditulis sependek mungkin karena tempatnya di dalam
// chip filter tanggal, tepat di sebelah chip yang mengatur hal yang sama
// persis — dua elemen, satu pekerjaan, jadi yang menjelaskan dilebur ke yang
// mengatur.
function labelCakupan(tab: TabValue) {
  if (tab === 'POLI') return 'Hari ini';
  if (tab === 'OPERASI') return 'Belum selesai';
  return 'Belum dijawab';
}

const TOGGLE_INSET = ms(4);

export function JadwalOperasiKonsulScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { onScroll: onDockScroll, scrollEventThrottle, scrolled } = useTabBarDockOnScroll();
  const { onScroll: onTopButtonScroll, visible: showScrollTop, reset: resetScrollTop } = useScrollToTopButton();
  const { headerBackgroundColor, headerShadowOpacity, headerElevation } = useAnimatedHeaderFade(scrolled);
  // Satu baris per langkah: filter sembunyi duluan, search bar menyusul kalau
  // scroll ke bawah masih lanjut. Toggle Konsultasi/Operasi sengaja tidak ikut —
  // itu penanda posisi, bukan kontrol yang bisa hilang tanpa bikin bingung.
  const {
    onScroll: onHeaderScroll,
    top: searchRow,
    bottom: filterRow,
    reset: resetHeaderRows,
  } = useCollapseOnScroll();
  const poliScrollRef = useRef<ScrollView>(null);
  const konsulScrollRef = useRef<ScrollView>(null);
  const operasiScrollRef = useRef<ScrollView>(null);
  const token = useAuthStore((s) => s.token);
  const [tab, setTab] = useState<TabValue>('POLI');

  // Tile ringkasan di Home ("Pasien"/"Operasi"/"Kunjungan") lompat kemari
  // lewat param `tab`. Dikonsumsi sekali per fokus lalu param-nya dibersihkan
  // (`setParams`) — tanpa dibersihkan, switch tab manual berikutnya lewat
  // FloatingTabBar (yang tidak membawa param apa pun) akan tetap membaca nilai
  // lama dari navigasi sebelumnya. Bottom tab navigator TIDAK meng-unmount
  // screen ini waktu OperasiTab ditinggalkan (cuma popToTopOnBlur, itu pun
  // cuma memengaruhi screen yang di-push di atasnya), jadi state `tab` di sini
  // tidak reset sendiri — harus dikonsumsi eksplisit lewat efek fokus.
  useFocusEffect(
    useCallback(() => {
      if (route.params?.tab) {
        setTab(route.params.tab);
        navigation.setParams({ tab: undefined });
      }
    }, [route.params?.tab, navigation]),
  );

  // "Hari ini" disimpan sebagai state, bukan dihitung ulang tiap render.
  // Alasannya: kalau app ditinggal terbuka melewati tengah malam, `new Date()`
  // di dalam render memang berganti hari, tapi datanya TIDAK ikut dimuat ulang
  // — jadi labelnya bilang "21 Agustus" sementara isinya masih jadwal tanggal
  // 20. Dengan satu state, label dan data selalu menunjuk tanggal yang sama,
  // dan pergantian hari cuma perlu diperiksa di satu tempat.
  const [hariIni, setHariIni] = useState(() => toDateParam(new Date()));

  // Rentang tanggal pilihan dokter. Kalau diisi, dia MENGGANTI aturan bawaan
  // ("belum selesai + hari ini") dan layar menampilkan persis isi rentang itu —
  // dokter sedang menengok arsip, bukan melihat pekerjaan hari ini, jadi
  // memaksakan aturan bawaan di atasnya cuma bikin hasilnya sulit ditebak.
  const [dariFilter, setDariFilter] = useState<Date | null>(null);
  const [sampaiFilter, setSampaiFilter] = useState<Date | null>(null);
  const rentangAktif = dariFilter !== null || sampaiFilter !== null;
  const paramRentang = {
    dari: dariFilter ? toDateParam(dariFilter) : undefined,
    sampai: sampaiFilter ? toDateParam(sampaiFilter) : undefined,
  };

  // Diperiksa tiap layar ini kembali dibuka: itu momen paling wajar tanggalnya
  // sudah berganti (app ditutup semalam, dibuka lagi pagi harinya).
  useFocusEffect(
    useCallback(() => {
      const sekarang = toDateParam(new Date());
      setHariIni((prev) => (prev === sekarang ? prev : sekarang));
    }, []),
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  // Cakupan Jadwal, default "saya". Cakupan luas ("semua kunjungan/operasi
  // pasien saya") menampilkan 709 kunjungan untuk satu dokter di data asli,
  // padahal cuma 105 yang melibatkan dia, dan 100% isi tab Operasi ternyata
  // milik dokter lain karena dokter itu bukan dokter bedah — makanya
  // default-nya dipersempit ke "saya".
  //
  // Tidak berlaku di tab Konsultasi: konsul sudah discoping server ke dokter
  // tujuan, jadi tidak ada cakupan lain yang masuk akal di sana.
  const [lingkup, setLingkup] = useState<LingkupJadwal>('saya');
  const [search, setSearch] = useState('');

  useEffect(() => {
    resetScrollTop();
    // Search bar + chip filter dikembalikan ke posisi tampil. Tiap tab punya
    // ScrollView sendiri yang mount ulang di posisi 0, sementara state
    // sembunyi/tampilnya satu untuk seluruh screen — tanpa baris ini, header
    // yang tersembunyi di tab sebelumnya ikut terbawa ke tab yang listnya
    // sedang di puncak, dan di tab kosong (dokter tanpa jadwal operasi) tidak
    // ada scroll apa pun yang bisa memunculkannya lagi.
    resetHeaderRows();
    // Filter ikut direset: nilainya milik kosakata status tab sebelumnya, jadi
    // "Batal" yang terbawa ke tab Konsultasi akan menyaring habis semua kartu.
    setStatusFilter('ALL');
  }, [tab, resetScrollTop, resetHeaderRows]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      onDockScroll(e);
      onTopButtonScroll(e);
      onHeaderScroll(e);
    },
    [onDockScroll, onTopButtonScroll, onHeaderScroll],
  );

  function scrollToTop() {
    const ref =
      tab === 'KONSUL' ? konsulScrollRef : tab === 'POLI' ? poliScrollRef : operasiScrollRef;
    ref.current?.scrollTo({ y: 0, animated: true });
  }

  const [toggleWidth, setToggleWidth] = useState(0);
  const toggleIndicatorX = useRef(new Animated.Value(0)).current;
  // Lebar dalam dikurangi padding kiri+kanan toggle, lalu dibagi jumlah tab —
  // ikut TABS.length, tidak dipatok angka, supaya benar waktu tabnya jadi 3.
  const toggleItemWidth = Math.max((toggleWidth - TOGGLE_INSET * 2) / TABS.length, 0);

  useEffect(() => {
    if (!toggleItemWidth) return;
    Animated.spring(toggleIndicatorX, {
      toValue: TABS.findIndex((t) => t.value === tab) * toggleItemWidth,
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

  const [poliItems, setPoliItems] = useState<KunjunganListItem[]>([]);
  const [poliLoading, setPoliLoading] = useState(true);
  const [poliError, setPoliError] = useState<string | null>(null);
  // Terisi kalau server mundur ke tanggal lain karena hari ini kosong (replika
  // SIMRS bisa berhenti tersinkronisasi). Ditampilkan sebagai catatan di atas
  // daftar; tanpa itu data lama terbaca sebagai jadwal hari ini.
  const [poliTanggalData, setPoliTanggalData] = useState<string | null>(null);

  const loadedKeys = useRef<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const loadOperasi = useCallback(async (opts?: { silent?: boolean }) => {
    if (!token) return;
    if (!opts?.silent) setOperasiLoading(true);
    setOperasiError(null);
    try {
      const result = await fetchOperasiList(token, { page: 1, limit: 50, lingkup, ...paramRentang });
      setOperasiItems(result.data);
    } catch (err) {
      setOperasiError(err instanceof ApiError ? err.message : 'Gagal memuat jadwal operasi');
    } finally {
      if (!opts?.silent) setOperasiLoading(false);
    }
  }, [token, lingkup, paramRentang.dari, paramRentang.sampai]);

  const loadKonsultasi = useCallback(async (opts?: { silent?: boolean }) => {
    if (!token) return;
    if (!opts?.silent) setKonsultasiLoading(true);
    setKonsultasiError(null);
    try {
      const result = await fetchKonsultasiList(token, { page: 1, limit: 50, ...paramRentang });
      setKonsultasiItems(result.data);
    } catch (err) {
      setKonsultasiError(err instanceof ApiError ? err.message : 'Gagal memuat daftar konsultasi');
    } finally {
      if (!opts?.silent) setKonsultasiLoading(false);
    }
  }, [token, paramRentang.dari, paramRentang.sampai]);

  // Poliklinik = kunjungan HARI INI saja (dari == sampai). Tab lain sengaja
  // tidak dibatasi tanggal: operasi & surat konsul dilihat sebagai daftar
  // berjalan, sedangkan pertanyaan yang dijawab tab ini spesifik "hari ini
  // saya ada pasien apa".
  const loadPoli = useCallback(async (opts?: { silent?: boolean }) => {
    if (!token) return;
    if (!opts?.silent) setPoliLoading(true);
    setPoliError(null);
    try {
      const pakaiTanggalBawaan = !paramRentang.dari && !paramRentang.sampai;
      const result = await fetchKunjunganList(token, {
        dari: paramRentang.dari ?? hariIni,
        sampai: paramRentang.sampai ?? hariIni,
        page: 1,
        limit: 50,
        lingkup,
        // Cuma boleh mundur kalau dokter TIDAK memilih tanggal sendiri.
        bolehMundur: pakaiTanggalBawaan,
      });
      setPoliItems(result.data);
      setPoliTanggalData(result.tanggalData ?? null);
    } catch (err) {
      setPoliError(err instanceof ApiError ? err.message : 'Gagal memuat jadwal poliklinik');
    } finally {
      if (!opts?.silent) setPoliLoading(false);
    }
  }, [token, hariIni, lingkup, paramRentang.dari, paramRentang.sampai]);

  const loaders: Record<TabValue, (opts?: { silent?: boolean }) => Promise<void>> = {
    POLI: loadPoli,
    OPERASI: loadOperasi,
    KONSUL: loadKonsultasi,
  };
  const loadersRef = useRef(loaders);
  loadersRef.current = loaders;

  // Satu efek untuk tiga tab: yang aktif dimuat sekali, sisanya baru waktu
  // dibuka — memuat tiap tab lewat efek terpisah berarti tiga cabang yang
  // beda-beda untuk dijaga tetap sinkron.
  //
  // Kunci muatnya ikut menyertakan tanggal untuk tab POLI. Jadi waktu harinya
  // berganti, kuncinya berubah dan jadwal hari ini dimuat ulang dengan
  // sendirinya — tanpa perlu efek kedua khusus pergantian hari.
  // `lingkup` WAJIB ikut jadi bagian kunci: tanpa itu, mengganti cakupan tidak
  // mengubah kunci, efek ini menganggap kombinasinya sudah pernah dimuat, dan
  // chip-nya berpindah tanpa satu pun baris berubah.
  useEffect(() => {
    const kunci = `${tab}:${lingkup}:${hariIni}:${paramRentang.dari ?? ''}~${paramRentang.sampai ?? ''}`;
    if (loadedKeys.current.has(kunci)) return;
    loadedKeys.current.add(kunci);
    loadersRef.current[tab]();
  }, [tab, lingkup, hariIni, paramRentang.dari, paramRentang.sampai]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadersRef.current[tab]({ silent: true });
    setRefreshing(false);
  }, [tab]);

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

  // ATURAN CAKUPAN dua tab ini: apa pun yang BELUM SELESAI selalu ikut
  // tampil, tanggal berapa pun.
  //
  // Surat yang belum dijawab dan operasi yang belum berjalan justru itu yang
  // perlu ditindaklanjuti — menyembunyikannya hanya karena tanggalnya bukan
  // hari ini adalah cara paling cepat membuat pekerjaan terlewat. Operasi
  // minggu depan juga tetap tampil: dokter bedah perlu bersiap dari sekarang.
  //
  // Yang dibatasi ke hari ini cuma yang SUDAH kelar (selesai/batal/dijawab) —
  // itu riwayat, dan tanpa batas tanggal daftar ini pelan-pelan berubah jadi
  // arsip yang harus di-scroll melewati pekerjaan hari ini.
  // `statusFilter !== 'ALL'` ikut melonggarkan saringan ini: kalau dokter
  // menekan chip "Selesai", dia memang sedang meminta riwayat, dan menyaringnya
  // lebih dulu di sini membuat chip itu mustahil berisi — persis bug yang
  // dilaporkan (chip Selesai selalu kosong padahal ada 4.512 operasi selesai).
  const operasiRelevan = operasiItems.filter(
    (item) =>
      rentangAktif ||
      statusFilter !== 'ALL' ||
      item.status === 'SCHEDULED' ||
      item.status === 'IN_PROGRESS' ||
      padaHariIni(item.tanggalOperasi, hariIni),
  );

  const konsultasiRelevan = konsultasiItems.filter(
    (item) =>
      rentangAktif ||
      statusFilter !== 'ALL' ||
      item.status === 'MENUNGGU_JAWABAN' ||
      padaHariIni(item.tanggalPermintaan, hariIni),
  );

  const filteredOperasiItems = sortByStatusThenNearestDate(
    (statusFilter === 'ALL' ? operasiRelevan : operasiRelevan.filter((item) => item.status === statusFilter)).filter(
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
      ? konsultasiRelevan
      : konsultasiRelevan.filter((item) => item.status === statusFilter)
  ).filter(
    (item) =>
      !searchTerm ||
      item.pasien.nama.toLowerCase().includes(searchTerm) ||
      item.pasien.norm.toLowerCase().includes(searchTerm),
  );

  const filteredPoliItems = sortByStatusThenNearestDate(
    (statusFilter === 'ALL'
      ? poliItems
      : poliItems.filter((item) => item.statusKunjungan === statusFilter)
    ).filter(
      (item) =>
        !searchTerm ||
        item.pasien.nama.toLowerCase().includes(searchTerm) ||
        item.pasien.norm.toLowerCase().includes(searchTerm),
    ),
    (item) => item.statusKunjungan,
    (item) => item.tanggalMasuk,
  );

  const statusFilters =
    tab === 'KONSUL'
      ? KONSUL_STATUS_FILTERS
      : tab === 'POLI'
        ? POLI_STATUS_FILTERS
        : OPERASI_STATUS_FILTERS;

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
          <View style={styles.toggle} onLayout={onToggleLayout}>
            {toggleItemWidth > 0 && (
              <Animated.View
                style={[
                  styles.toggleIndicator,
                  { width: toggleItemWidth, transform: [{ translateX: toggleIndicatorX }] },
                ]}
              />
            )}
            {TABS.map((t) => (
              <Pressable key={t.value} onPress={() => setTab(t.value)} style={styles.toggleButton}>
                <Text style={[styles.toggleText, tab === t.value && styles.toggleTextActive]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Animated.View style={searchRow.style} onLayout={searchRow.onLayout}>
          <Animated.View style={[styles.rowSlot, styles.cariRow, searchRow.innerStyle]}>
            <View style={styles.searchWrapper}>
              <MaterialIcons name="search" size={20} color={colors.primary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Cari nama / No. RM"
                placeholderTextColor={colors.outline}
                style={styles.searchInput}
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch('')} hitSlop={8}>
                  <MaterialIcons name="close" size={18} color={colors.onSurfaceVariant} />
                </Pressable>
              )}
            </View>
            <FilterTanggal
              judul="Filter Rentang Tanggal"
              labelKosong={labelCakupan(tab)}
              dari={dariFilter}
              sampai={sampaiFilter}
              onChange={(dari, sampai) => {
                setDariFilter(dari);
                setSampaiFilter(sampai);
              }}
            />
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
              {/* Cakupan duluan, lalu pemisah, baru status. Dua hal yang beda:
                  cakupan menentukan jadwal SIAPA, status menyaring isinya.
                  Konsultasi tidak punya cakupan — sudah discoping ke dokter
                  tujuan di server. */}
              {tab !== 'KONSUL' &&
                LINGKUP_FILTERS.map((f) => {
                  const active = lingkup === f.value;
                  return (
                    <Pressable
                      key={f.value}
                      onPress={() => setLingkup(f.value)}
                      style={[styles.statusFilterChip, active && styles.statusFilterChipActive]}
                    >
                      <Text style={[styles.statusFilterText, active && styles.statusFilterTextActive]}>
                        {f.label}
                      </Text>
                    </Pressable>
                  );
                })}
              {tab !== 'KONSUL' && <View style={styles.filterPemisah} />}
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
      {tab === 'POLI' ? (
        poliLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : poliError ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{poliError}</Text>
          </View>
        ) : filteredPoliItems.length === 0 ? (
          <View style={styles.center}>
            <MaterialIcons name="event-available" size={40} color={colors.outlineVariant} />
            <Text style={styles.comingSoonTitle}>
              {poliItems.length === 0
                ? lingkup === 'saya'
                  ? 'Tidak ada jadwal atas nama Anda'
                  : 'Tidak ada jadwal pasien hari ini'
                : 'Tidak ada jadwal dengan status ini'}
            </Text>
            {/* Sama seperti tab Operasi: kosong di cakupan "saya" adalah keadaan
                normal (dokter sedang tidak praktik hari itu), bukan kegagalan
                memuat. Petunjuknya menyebut chip yang memang ada di layar. */}
            {poliItems.length === 0 && lingkup === 'saya' && (
              <Text style={styles.emptyHint}>
                Coba <Text style={styles.emptyHintTekan}>Pasien saya</Text> untuk melihat kunjungan
                pasien Anda oleh dokter lain.
              </Text>
            )}
            {/* Dugaan replikasi tertinggal hanya masuk akal di cakupan luas:
                kalau se-rumah-sakit pun tidak ada kunjungan, barulah datanya
                yang patut dicurigai. Di cakupan "saya", kosong jauh lebih
                mungkin berarti dokternya memang tidak praktik. */}
            {poliItems.length === 0 && lingkup === 'pasien' && (
              <Text style={styles.comingSoonSub}>
                Data kunjungan terbaru di SIMRS mungkin belum sampai hari ini.
              </Text>
            )}
          </View>
        ) : (
          <ScrollView
            ref={poliScrollRef}
            contentContainerStyle={[styles.listContent, { paddingBottom: tabBarClearance }]}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={scrollEventThrottle}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
            }
          >
            {poliTanggalData ? (
              <View style={styles.catatanTanggal}>
                <MaterialIcons name="info-outline" size={16} color={colors.primary} />
                <Text style={styles.catatanTanggalText}>
                  Tidak ada kunjungan hari ini. Menampilkan {formatTanggalSingkat(poliTanggalData)},
                  data terakhir yang tersedia di SIMRS.
                </Text>
              </View>
            ) : null}
            {filteredPoliItems.map((item) => {
              const meta = KUNJUNGAN_STATUS_META[item.statusKunjungan];
              const jenisLabel = labelJenisKunjungan(item.jenisKunjungan);
              return (
                <Pressable
                  key={item.id}
                  style={styles.card}
                  onPress={() => navigation.navigate('DetailKunjungan', { kunjunganId: item.id })}
                  accessibilityRole="button"
                  accessibilityLabel={`Detail kunjungan ${item.pasien.nama}`}
                >
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTime}>{formatJam(item.tanggalMasuk)}</Text>
                      <Text style={styles.cardPatient}>{item.pasien.nama}</Text>
                      <Text style={styles.cardTindakan}>
                        {item.diagnosa ?? 'Belum ada diagnosa'}
                      </Text>
                    </View>
                    <View style={styles.cardPills}>
                      <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                        <MaterialIcons name={meta.icon as never} size={14} color={meta.fg} />
                        <Text style={[styles.statusPillText, { color: meta.fg }]}>{meta.label}</Text>
                      </View>
                      {item.isPasienBaru && (
                        <View style={styles.citoPill}>
                          <MaterialIcons name="fiber-new" size={14} color={colors.onErrorContainer} />
                          <Text style={styles.citoPillText}>BARU</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.cardDivider} />
                  <View style={styles.cardBottom}>
                    <View style={styles.cardBottomItem}>
                      <MaterialIcons name="meeting-room" size={18} color={colors.primary} />
                      <Text style={styles.cardBottomText} numberOfLines={1} ellipsizeMode="tail">
                        {jenisLabel ? `${item.ruangan.nama} — ${jenisLabel}` : item.ruangan.nama}
                      </Text>
                    </View>
                    <View style={styles.cardBottomItem}>
                      <MaterialIcons name="person" size={18} color={colors.primary} />
                      <Text style={styles.cardBottomText} numberOfLines={1} ellipsizeMode="tail">
                        {item.dokter.nama}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )
      ) : tab === 'KONSUL' ? (
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
              {konsultasiRelevan.length === 0
                ? 'Tidak ada surat konsul yang menunggu jawaban Anda'
                : 'Tidak ada surat konsul dengan status ini'}
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
                  <View>
                    {/* Tanggal + status sebaris di atas, status dikecilkan
                        (dari statusPill biasa) supaya "Menunggu Jawaban" —
                        kata terpanjang di semua status tab ini — tidak
                        mendominasi baris. Tanggal dapat flex supaya menyusut
                        duluan kalau ruangnya sempit, bukan status yang
                        kepotong. */}
                    <View style={styles.konsulTopRow}>
                      <Text
                        style={[styles.cardTime, styles.konsulTime]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {formatTanggalSingkat(item.tanggalPermintaan)},{' '}
                        {formatJam(item.tanggalPermintaan)}
                      </Text>
                      <View style={styles.konsulBadgeRow}>
                        <View style={[styles.konsulStatusPill, { backgroundColor: meta.bg }]}>
                          <MaterialIcons name={meta.icon as never} size={11} color={meta.fg} />
                          <Text
                            style={[styles.konsulStatusPillText, { color: meta.fg }]}
                            numberOfLines={1}
                          >
                            {meta.label}
                          </Text>
                        </View>
                        {/* Cuma CITO yang diberi badge. "BIASA" adalah default
                            dan mencetaknya di setiap kartu justru
                            menenggelamkan yang benar-benar mendesak. */}
                        {item.prioritas === 'CITO' && (
                          <View style={styles.konsulCitoPill}>
                            <MaterialIcons
                              name="priority-high"
                              size={11}
                              color={colors.onErrorContainer}
                            />
                            <Text style={styles.konsulCitoPillText}>CITO</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Text style={styles.cardPatient}>{item.pasien.nama}</Text>
                    <Text style={styles.cardTindakan} numberOfLines={2} ellipsizeMode="tail">
                      {item.diagnosisKerja}
                    </Text>
                  </View>

                  <View style={styles.cardDivider} />

                  {/* Satu baris per info, bukan dua kolom berbagi 50% lebar
                      kartu seperti tab lain — nama dokter pengirim di sini
                      lengkap dengan gelar (jauh lebih panjang dari nama ruangan
                      di tab Poliklinik/Operasi) dan dulu nyaris selalu
                      terpotong di kolom sesempit itu. */}
                  <View style={styles.konsulMetaGroup}>
                    <View style={styles.konsulMetaRow}>
                      <MaterialIcons name="outgoing-mail" size={18} color={colors.primary} />
                      <Text style={styles.cardBottomText} numberOfLines={1} ellipsizeMode="tail">
                        Dari {item.dokterPengirim.nama}
                      </Text>
                    </View>
                    {jenisLabel && (
                      <View style={styles.konsulMetaRow}>
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
            {operasiRelevan.length === 0
              ? lingkup === 'saya'
                ? 'Tidak ada operasi atas nama Anda'
                : 'Tidak ada operasi yang belum selesai'
              : 'Tidak ada jadwal dengan status ini'}
          </Text>
          {/* Kosong di cakupan "saya" adalah keadaan normal, bukan kegagalan:
              dokter penyakit dalam & onkologi radiasi memang tidak punya
              operasi atas namanya. Tanpa petunjuk ini layar kosong terbaca
              sebagai aplikasi rusak. */}
          {operasiRelevan.length === 0 && lingkup === 'saya' && (
            <Text style={styles.emptyHint}>
              Coba <Text style={styles.emptyHintTekan}>Pasien saya</Text> untuk melihat operasi pasien
              Anda oleh dokter lain.
            </Text>
          )}
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
  cariRow: { flexDirection: 'row', alignItems: 'center', gap: ms(8) },

  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(12),
    backgroundColor: colors.surfaceVariant,
    borderRadius: radius.full,
    paddingHorizontal: ms(16),
    paddingVertical: ms(7),
    flex: 1,
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
  // Pemisah tipis antara chip cakupan dan chip status — tanpa ini keduanya
  // terbaca sebagai satu daftar pilihan yang saling meniadakan.
  filterPemisah: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 4,
    backgroundColor: colors.outlineVariant,
  },
  statusFilterText: { fontSize: ms(12), fontWeight: '600', color: colors.primary },
  statusFilterTextActive: { color: colors.onPrimary },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: ms(8), padding: ms(32) },
  comingSoonTitle: { fontSize: ms(16), fontWeight: '700', color: colors.onSurfaceVariant },
  emptyHint: {
    marginTop: ms(8),
    fontSize: ms(13),
    lineHeight: ms(19),
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  // Menyebut nama chip-nya persis seperti tertulis di layar, ditebalkan supaya
  // dokter tahu ini merujuk tombol yang ada di atas — bukan istilah baru.
  emptyHintTekan: { fontWeight: '700', color: colors.primary },
  errorText: { color: colors.error, textAlign: 'center' },

  listContent: { padding: spacing.marginMobile, paddingTop: ms(8), gap: spacing.gutter },
  comingSoonSub: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    color: colors.onSurfaceVariant ?? colors.outline,
  },
  catatanTanggal: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.primaryContainer,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  catatanTanggalText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: colors.onPrimaryContainer ?? colors.primary,
  },
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

  // Khusus kartu Surat Konsul — lihat komentar di JSX buat alasan kartu ini
  // tidak memakai cardTop/cardPills/cardBottom seperti Poliklinik & Operasi.
  konsulTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: ms(8) },
  // flex:1 dipisah dari style `cardTime` bersama (dipakai juga apa adanya oleh
  // Poliklinik/Operasi di luar baris ini) supaya cuma baris tanggal+status di
  // sini yang menyusut duluan waktu ruang sempit.
  konsulTime: { flex: 1 },
  konsulBadgeRow: { flexDirection: 'row', flexShrink: 0, alignItems: 'center', gap: ms(6) },
  // Varian kecil dari statusPill/citoPill — dites di baris sempit sebelah
  // tanggal, bukan berdiri sendiri lebar penuh, jadi padding & fontnya
  // diciutkan supaya "Menunggu Jawaban" tidak terlihat sebesar statusPill biasa.
  konsulStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(3),
    paddingHorizontal: ms(8),
    paddingVertical: ms(4),
    borderRadius: radius.full,
  },
  konsulStatusPillText: { fontSize: ms(10), fontWeight: '600' },
  konsulCitoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(2),
    paddingLeft: ms(5),
    paddingRight: ms(8),
    paddingVertical: ms(3),
    borderRadius: radius.full,
    backgroundColor: colors.errorContainer,
  },
  konsulCitoPillText: { fontSize: ms(9), fontWeight: '800', color: colors.onErrorContainer },
  // Gap lebih rapat dari `card` (ms(16)) — dua baris ini satu kelompok info
  // (pengirim + jenis kunjungan), bukan dua seksi kartu yang berdiri sendiri.
  konsulMetaGroup: { gap: ms(10) },
  konsulMetaRow: { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
});
