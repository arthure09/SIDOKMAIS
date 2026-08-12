import { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { colors, menuAccent, radius, spacing } from '../theme/colors';
import { Text } from '../components/Text';
import { navigasiCards } from '../mocks/homeMock';
import { useTabBarClearance } from '../navigation/tabBarMetrics';
import { useTabBarDockOnScroll } from '../hooks/useTabBarDockOnScroll';
import { useAnimatedHeaderFade } from '../hooks/useAnimatedHeaderFade';
import { ringkasanAktivitas } from '../utils/ringkasanAktivitas';
import type { MainTabParamList } from '../navigation/types';
import { fetchStatistikDashboard } from '../api/dashboard';
import { fetchCatatanKalenderList } from '../api/kalender';
import { TIPE_META } from './CatatanKalenderScreen';
import type { AktivitasHarianMingguan, CatatanKalenderItem, PasienPrioritasItem } from '../api/types';

// Jumlah pengingat yang ditampilkan di Home — sisanya lewat "Lihat semua".
const PENGINGAT_PREVIEW_COUNT = 3;

// Urutannya harus sama dengan urutan slide di dalam pager — dipakai buat label
// aksesibilitas titik indikator.
const SLIDE_LABELS = ['Pasien Prioritas', 'Pengingat', 'Statistik Mingguan'];

// Query param, bukan tampilan — tanggal kalender LOKAL device (sama seperti
// toDateParam di CatatanKalenderScreen/HasilLabListScreen), bukan toISOString()
// yang bisa geser ke hari sebelumnya kalau device di timezone +.
function toDateParam(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTanggalPengingat(iso: string, waktu: string | null) {
  const tanggal = new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  return waktu ? `${tanggal} · ${waktu}` : tanggal;
}

function formatWaktuPrioritas(iso: string) {
  const d = new Date(iso);
  const tanggal = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  const jam = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return `${tanggal}, ${jam}`;
}

function formatTanggalHariIni() {
  return new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// Nama dokter disimpan lengkap dengan gelar ("dr. Nama, Sp.B(K) Onk") — dipisah
// di sini biar gelar bisa jadi caption kecil sendiri, bukan ikut nge-wrap di
// heading besar (gelar panjang bikin baris terakhir cuma sisa 1-2 kata).
function splitGelar(namaLengkap: string): { nama: string; gelar: string | null } {
  const idx = namaLengkap.indexOf(',');
  if (idx === -1) return { nama: namaLengkap, gelar: null };
  return { nama: namaLengkap.slice(0, idx).trim(), gelar: namaLengkap.slice(idx + 1).trim() };
}

/**
 * Satu halaman di pager horizontal, dengan fade + scale yang digerakkan langsung
 * oleh posisi scroll.
 *
 * Efeknya sengaja diturunkan dari `scrollX` (bukan animasi berdurasi tetap yang
 * di-trigger saat slide ganti): nilainya selalu mengikuti posisi jari, jadi
 * swipe pelan menghasilkan transisi pelan dan swipe cepat menghasilkan transisi
 * cepat — tanpa ada timer yang harus dikejar atau dibatalkan kalau user
 * menggeser lagi sebelum animasi sebelumnya kelar.
 *
 * `useNativeDriver: true` di Animated.event bikin interpolasi ini dihitung di
 * thread UI, jadi frame-nya tidak ikut tersendat waktu thread JS lagi sibuk
 * (mis. pas render ulang setelah fetch dashboard selesai). Konsekuensinya cuma
 * `opacity` dan `transform` yang bisa dianimasikan — properti shadow tidak
 * didukung native driver, makanya kedalaman di sini dikerjakan lewat scale,
 * bukan shadow yang berubah-ubah.
 */
function PagerSlide({
  index,
  scrollX,
  width,
  children,
}: {
  index: number;
  scrollX: Animated.Value;
  width: number;
  children: React.ReactNode;
}) {
  // Halaman sebelum, halaman ini, halaman sesudah. `clamp` supaya halaman paling
  // pinggir tidak makin redup/mengecil waktu di-overscroll di iOS.
  const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [0.4, 1, 0.4],
    extrapolate: 'clamp',
  });
  const scale = scrollX.interpolate({
    inputRange,
    outputRange: [0.92, 1, 0.92],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[styles.slide, { width, opacity, transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
}

type Props = BottomTabScreenProps<MainTabParamList, 'HomeTab'>;

const RINGKASAN_ROWS = [
  { key: 'pasienAktif' as const, label: 'Pasien Aktif', icon: 'groups', tint: colors.primary },
  {
    key: 'operasiHariIni' as const,
    label: 'Operasi Hari Ini',
    icon: 'local-hospital',
    tint: colors.tertiaryContainer,
  },
  { key: 'konsulHariIni' as const, label: 'Konsultasi Hari Ini', icon: 'chat-bubble', tint: colors.primary },
];

// 'radiologi' belum ada modulnya sendiri (gak ada entity/endpoint di
// backend) — dieduk ke alur 'hasillab' yang sudah ada (endpoint /api/lab
// discope per pasienId) sampai ada modul radiologi beneran.
// 'hasillab' diaktifkan Hari 19 (docs/prompts/prompts-day-21-18-19.md),
// arahnya ke layar pilih pasien dulu. 'kalender' (Bagian A, docs/prompts/
// bagian-a-kalender-pribadi-dokter.md) satu-satunya aksi tulis yang aman
// buat dokter di app ini — datanya milik dokter sendiri, bukan data klinis
// sync SIMRS.
const NAVIGABLE_CARD_IDS = new Set(['pendapatan', 'hasillab', 'radiologi', 'kalender']);

// Warna ikon tiap tile Menu, urut sesuai urutan tile di navigasiCards supaya
// ramp-nya menyapu rapi melintasi grid 2x2 (lihat `menuAccent` di theme/colors.ts
// buat alasan pemilihan hue & angka kontrasnya).
//
// Aksen dipakai HANYA di ikon, tidak di teks: di ukuran 13px, warna-warna ini
// (3.6-4.1:1) di bawah ambang 4.5:1 buat teks normal, sedangkan buat komponen
// non-teks ambangnya 3:1. Jadi label tetap putih (6.46:1).
const NAVIGASI_TINTS: Record<string, string> = {
  pendapatan: menuAccent.mint,
  hasillab: menuAccent.teal,
  radiologi: menuAccent.cyan,
  kalender: menuAccent.sky,
};

export function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { onScroll, scrollEventThrottle, scrolled } = useTabBarDockOnScroll();
  const dokterNama = useAuthStore((s) => s.pengguna?.dokter?.nama);
  const token = useAuthStore((s) => s.token);
  const { nama: dokterNamaUtama, gelar: dokterGelar } = splitGelar(dokterNama ?? 'dr. Reza Auditore');

  const [ringkasan, setRingkasan] = useState({ pasienAktif: 0, operasiHariIni: 0, konsulHariIni: 0 });
  const [ringkasanLoading, setRingkasanLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuViewMode, setMenuViewMode] = useState<'grid' | 'list'>('grid');
  const [aktivitasMingguan, setAktivitasMingguan] = useState<AktivitasHarianMingguan[]>([]);
  const [pasienPrioritas, setPasienPrioritas] = useState<PasienPrioritasItem[]>([]);
  const [pengingat, setPengingat] = useState<CatatanKalenderItem[]>([]);

  const { width: windowWidth } = useWindowDimensions();
  const pagerRef = useRef<ScrollView>(null);
  const [slideIndex, setSlideIndex] = useState(0);

  // Posisi scroll mentah, dipakai PagerSlide buat fade + scale. Nilainya hidup di
  // thread UI (lihat onPagerScroll), tidak pernah masuk state React — makanya
  // menggeser slide tidak memicu satu pun re-render.
  const scrollX = useRef(new Animated.Value(0)).current;

  const onPagerScroll = useRef(
    Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
      useNativeDriver: true,
    }),
  ).current;

  // Terpisah dari onPagerScroll di atas: titik indikator butuh state React (jadi
  // harus lewat thread JS), tapi cuma perlu tahu hasil akhirnya. Dipasang di
  // onMomentumScrollEnd supaya setState-nya sekali per slide, bukan tiap frame
  // selama jari masih menggeser.
  const onPagerScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      setSlideIndex(Math.round(e.nativeEvent.contentOffset.x / windowWidth));
    },
    [windowWidth],
  );

  const goToSlide = useCallback(
    (i: number) => {
      pagerRef.current?.scrollTo({ x: i * windowWidth, animated: true });
      setSlideIndex(i);
    },
    [windowWidth],
  );

  const { headerBackgroundColor, headerShadowOpacity, headerElevation } = useAnimatedHeaderFade(scrolled);

  // Tinggi bar chart dinormalisasi relatif ke hari tersibuk minggu ini (bukan
  // skala tetap) — jumlah mentah dari backend adalah gabungan Kunjungan +
  // Operasi per hari, lihat dashboard.routes.js.
  const maxAktivitasMingguan = Math.max(1, ...aktivitasMingguan.map((a) => a.jumlah));

  const loadRingkasan = useCallback(async () => {
    if (!token) return;
    setRingkasanLoading(true);
    try {
      const statistik = await fetchStatistikDashboard(token);
      setRingkasan({
        pasienAktif: statistik.pasienAktif,
        operasiHariIni: statistik.operasiHariIni,
        konsulHariIni: statistik.konsulHariIni,
      });
      // Fallback ke [] kalau backend yang dihit belum punya field ini (mis.
      // backend belum di-redeploy setelah frontend di-update) — biar
      // HomeScreen gak crash (`.length`/`.map` of undefined), cuma tampil
      // kosong sampai backend-nya disamakan.
      setAktivitasMingguan(statistik.aktivitasMingguan ?? []);
      setPasienPrioritas(statistik.pasienPrioritas ?? []);
    } catch {
      // Ringkasan bukan bagian kritikal halaman ini — biarkan nilai lama kalau gagal.
    } finally {
      setRingkasanLoading(false);
    }

    // Dipisah dari try di atas: pengingat dan ringkasan dua endpoint berbeda,
    // kalau /api/kalender gagal ringkasan yang sudah masuk jangan ikut dibuang.
    // ADMIN dibalikin list kosong sama backend (kalender itu milik dokter),
    // jadi seksi ini otomatis kosong buat akun itu — tidak perlu cek role.
    try {
      // Tanpa `sampai` — semua catatan dari hari ini ke depan, sudah urut
      // tanggal+waktu dari backend, tinggal diambil beberapa yang terdekat.
      const { data } = await fetchCatatanKalenderList(token, { dari: toDateParam(new Date()) });
      setPengingat(data);
    } catch {
      // Sama seperti ringkasan — biarkan nilai lama kalau gagal.
    }
  }, [token]);

  // useFocusEffect, bukan useEffect sekali saat mount: pengingat yang baru
  // dibuat/dihapus di CatatanKalenderScreen harus kelihatan begitu user balik
  // ke Home. Efek ini cuma jalan waktu Home benar-benar fokus, jadi tetap tidak
  // ada fetch yang jalan di belakang layar waktu tab lain aktif.
  useFocusEffect(
    useCallback(() => {
      loadRingkasan();
    }, [loadRingkasan]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRingkasan();
    setRefreshing(false);
  }, [loadRingkasan]);

  function handleCardPress(id: string) {
    // `initial: false` di semua case ini penting: tanpanya, navigasi ke
    // screen yang BUKAN initialRouteName tab tujuan (pertama kali tab itu
    // dikunjungi) bikin React Navigation ganti seluruh state stack tab
    // tujuan jadi cuma berisi screen itu sendiri (root aslinya, mis.
    // ProfilDokter/PasienList, gak pernah ke-push). Akibatnya tombol
    // "kembali" gak punya apa-apa buat di-pop di dalam stack itu dan
    // nembus balik ke tab asal (Home), dan tab tujuan jadi rusak setelahnya.
    // `initial: false` memastikan root screen tab tujuan tetap ke-push dulu,
    // screen target di-push di atasnya — back stack normal.
    //
    // `params: { fromHome: true }` dibaca useMenuBack di screen tujuan: tombol
    // back di sana balik ke Home, bukan pop ke root stack tab tujuan. Screen yang
    // sama juga bisa dibuka dari dalam tabnya (ProfilDokter → DataPendapatan);
    // di jalur itu paramnya tidak ada dan back-nya goBack() normal.
    switch (id) {
      case 'pendapatan':
        navigation.navigate('ProfilTab', {
          screen: 'DataPendapatan',
          params: { fromHome: true },
          initial: false,
        });
        break;
      case 'hasillab':
      case 'radiologi':
        navigation.navigate('PasienTab', {
          screen: 'PilihPasienHasilLab',
          params: { fromHome: true },
          initial: false,
        });
        break;
      case 'kalender':
        navigation.navigate('ProfilTab', {
          screen: 'CatatanKalender',
          params: { fromHome: true },
          initial: false,
        });
        break;
    }
  }

  function bukaKalender() {
    navigation.navigate('ProfilTab', {
      screen: 'CatatanKalender',
      params: { fromHome: true },
      initial: false,
    });
  }

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
        <Image
          source={require('../../assets/logo sidokmais dan tulisan.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
      </Animated.View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        <View>
          <Text style={styles.dateEyebrow}>{formatTanggalHariIni()}</Text>
          <Text style={styles.greeting}>
            Halo, <Text style={styles.greetingName}>{dokterNamaUtama} !</Text>
          </Text>
          {dokterGelar && (
            <View style={styles.gelarRow}>
              <MaterialIcons name="medical-services" size={13} color={colors.primary} />
              <Text style={styles.gelarText}>{dokterGelar.toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.subtitle}>Semoga harimu menyenangkan.</Text>
        </View>

        <View style={styles.quickActionsSection}>
          <View>
            <Text style={styles.summaryTitle}>Ringkasan Aktivitas Hari Ini</Text>
            <Text style={styles.sectionSubtitle}>Pasien dan jadwal Anda hari ini</Text>
          </View>
          <View style={styles.statTileRow}>
            {RINGKASAN_ROWS.map((row) => (
              <View key={row.key} style={styles.statTile}>
                <View style={[styles.statTileIconCircle, { backgroundColor: `${row.tint}1A` }]}>
                  <MaterialIcons name={row.icon as never} size={18} color={row.tint} />
                </View>
                <Text style={[styles.statTileValue, { color: row.tint }]}>
                  {ringkasanLoading ? '–' : ringkasan[row.key]}
                </Text>
                <Text style={styles.statTileLabel}>{row.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.menuHeaderRow}>
            <View style={styles.menuHeaderText}>
              {/* Judulnya "Menu" (keputusan Arthuro). Yang diganti cuma subjudulnya:
                  yang lama "Fitur tambahan di luar navigasi utama" secara harfiah
                  menyuruh dokter mengabaikan blok ini lewat kata "tambahan" dan
                  "di luar". Yang baru mengorientasikan tanpa merendahkan, dan tanpa
                  mengulang label tile di bawahnya. */}
              <Text style={styles.summaryTitle}>Menu</Text>
              <Text style={styles.sectionSubtitle}>Pilihan menu untuk Anda</Text>
            </View>
            {/* Dua tombol terpisah (bukan satu tombol yang nge-toggle): mode yang
                lagi aktif kelihatan langsung dari warnanya, tanpa user harus nebak
                arti ikon. Ditaruh di pojok kanan judul seksi — sejajar tepi kanan
                konten, di atas kartu menu yang diaturnya. */}
            <View style={styles.viewToggleRow}>
              {(['grid', 'list'] as const).map((mode) => {
                const active = menuViewMode === mode;
                return (
                  <Pressable
                    key={mode}
                    onPress={() => setMenuViewMode(mode)}
                    style={[styles.viewToggleButton, active && styles.viewToggleButtonActive]}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={
                      mode === 'grid' ? 'Tampilkan menu sebagai grid' : 'Tampilkan menu sebagai daftar'
                    }
                  >
                    <MaterialIcons
                      name={mode === 'grid' ? 'grid-view' : 'view-list'}
                      size={18}
                      color={active ? colors.onPrimary : colors.outline}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.gridSection}>
            {menuViewMode === 'grid' ? (
              <View style={styles.grid}>
                {navigasiCards.map((card) => {
                  const isNavigable = NAVIGABLE_CARD_IDS.has(card.id);
                  const tint = NAVIGASI_TINTS[card.id] ?? colors.onPrimary;
                  return (
                    <Pressable
                      key={card.id}
                      disabled={!isNavigable}
                      onPress={() => handleCardPress(card.id)}
                      style={({ pressed }) => [
                        styles.gridCard,
                        !isNavigable && styles.gridCardDisabled,
                        pressed && styles.gridCardPressed,
                      ]}
                    >
                      <View style={[styles.gridIconCircle, { backgroundColor: `${tint}24` }]}>
                        <MaterialIcons name={card.icon as never} size={26} color={tint} />
                      </View>
                      <Text style={styles.gridLabel}>{card.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={styles.list}>
                {navigasiCards.map((card) => {
                  const isNavigable = NAVIGABLE_CARD_IDS.has(card.id);
                  const tint = NAVIGASI_TINTS[card.id] ?? colors.onPrimary;
                  return (
                    <Pressable
                      key={card.id}
                      disabled={!isNavigable}
                      onPress={() => handleCardPress(card.id)}
                      style={({ pressed }) => [
                        styles.listRow,
                        !isNavigable && styles.gridCardDisabled,
                        pressed && styles.gridCardPressed,
                      ]}
                    >
                      <View style={[styles.listIconCircle, { backgroundColor: `${tint}24` }]}>
                        <MaterialIcons name={card.icon as never} size={20} color={tint} />
                      </View>
                      <Text style={styles.listLabel}>{card.label}</Text>
                      <MaterialIcons name="chevron-right" size={20} color={colors.surfaceVariant} />
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        {/* Tiga seksi (Pasien Prioritas, Pengingat, Statistik) ditumpuk jadi satu
            pager horizontal. Animated.ScrollView + pagingEnabled bawaan RN, bukan
            library pager: lebar tiap halaman = lebar layar penuh, jadi snap-nya
            persis selebar viewport tanpa hitung-hitungan snapToInterval.
            marginHorizontal negatif dipakai buat keluar dari padding ScrollView
            induk (full-bleed) — padding itu dikembalikan di tiap halaman lewat
            paddingHorizontal, supaya kontennya tetap sejajar sama seksi lain di
            Home yang tidak ikut pager. */}
        <View style={styles.pagerSection}>
          <Animated.ScrollView
            ref={pagerRef}
            horizontal
            // Fisika snap bawaan platform sengaja tidak diganti dengan animasi
            // timing custom: pagingEnabled sudah menangani lempar cepat maupun
            // geser pelan-lalu-lepas sesuai kebiasaan OS. Yang ditambahkan di
            // sini cuma efek visualnya (PagerSlide), yang menempel ke posisi
            // scroll — jadi ikut ke mana pun fisika itu membawa.
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onPagerScroll}
            // 16ms ≈ 1 frame @60fps. Untuk onScroll yang native-driven ini cuma
            // memengaruhi frekuensi event yang ikut dikirim ke JS; interpolasinya
            // sendiri tetap jalan tiap frame di thread UI.
            scrollEventThrottle={16}
            onMomentumScrollEnd={onPagerScrollEnd}
            style={[styles.pager, { marginHorizontal: -spacing.marginMobile }]}
            contentContainerStyle={styles.pagerContent}
          >
            <PagerSlide index={0} scrollX={scrollX} width={windowWidth}>
              <View>
                <Text style={styles.summaryTitle}>Pasien Prioritas</Text>
                <Text style={styles.sectionSubtitle}>Jadwal operasi & konsultasi terdekat</Text>
              </View>
              <View style={{ gap: spacing.base + 4 }}>
                {pasienPrioritas.length === 0 ? (
                  <Text style={styles.emptyStateText}>Tidak ada jadwal operasi/konsultasi mendatang.</Text>
                ) : (
                  pasienPrioritas.map((p) => (
                    <View key={p.id} style={styles.priorityCard}>
                      <View style={styles.priorityAvatar}>
                        <MaterialIcons
                          name={p.jenis === 'OPERASI' ? 'medical-services' : 'person'}
                          size={20}
                          color={colors.onPrimary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.priorityName}>{p.nama}</Text>
                        <Text style={styles.priorityLokasi}>{p.lokasi}</Text>
                      </View>
                      <View style={styles.priorityWaktuRow}>
                        <MaterialIcons name="schedule" size={13} color={colors.onPrimaryContainer} />
                        <Text style={styles.priorityWaktu}>{formatWaktuPrioritas(p.waktu)}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </PagerSlide>

            <PagerSlide index={1} scrollX={scrollX} width={windowWidth}>
              <View style={styles.menuHeaderRow}>
                <View style={styles.menuHeaderText}>
                  <Text style={styles.summaryTitle}>Pengingat</Text>
                  <Text style={styles.sectionSubtitle}>Catatan kalender Anda yang akan datang</Text>
                </View>
                {pengingat.length > 0 && (
                  <Pressable onPress={bukaKalender} hitSlop={8} accessibilityRole="button">
                    <Text style={styles.lihatSemuaText}>Lihat semua</Text>
                  </Pressable>
                )}
              </View>
              <View style={{ gap: spacing.gutter }}>
                {pengingat.length === 0 ? (
                  <Pressable
                    onPress={bukaKalender}
                    accessibilityRole="button"
                    accessibilityLabel="Belum ada pengingat, buka kalender untuk membuat"
                  >
                    <Text style={styles.emptyStateText}>
                      Belum ada pengingat tersimpan. Ketuk untuk membuat di kalender.
                    </Text>
                  </Pressable>
                ) : (
                  pengingat.slice(0, PENGINGAT_PREVIEW_COUNT).map((item) => {
                    const meta = TIPE_META[item.tipe];
                    return (
                      <Pressable
                        key={item.id}
                        onPress={bukaKalender}
                        accessibilityRole="button"
                        accessibilityLabel={`${meta.label}: ${item.judul}`}
                        style={({ pressed }) => [styles.reminderCard, pressed && styles.gridCardPressed]}
                      >
                        <View style={[styles.reminderIconCircle, { backgroundColor: `${meta.color}1A` }]}>
                          <MaterialIcons name={meta.icon} size={20} color={meta.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.reminderTitle} numberOfLines={1}>
                            {item.judul}
                          </Text>
                          <Text style={styles.reminderMeta}>
                            {meta.label} · {formatTanggalPengingat(item.tanggal, item.waktu)}
                          </Text>
                        </View>
                        <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
                      </Pressable>
                    );
                  })
                )}
              </View>
            </PagerSlide>

            <PagerSlide index={2} scrollX={scrollX} width={windowWidth}>
              <View>
                <Text style={styles.summaryTitle}>Statistik Pasien Mingguan</Text>
                <Text style={styles.sectionSubtitle}>Kunjungan & operasi per hari</Text>
              </View>
              <View style={styles.chartSection}>
                <View style={styles.chartCard}>
                {aktivitasMingguan.map((d, i) => {
                  // Lantai minimum 6% biar bar tetap keliatan (bukan hilang total
                  // tanpa warna) waktu jumlah hari itu 0 — kalau seluruh minggu 0
                  // (belum ada aktivitas sama sekali), semua bar bakal setinggi
                  // lantai ini, tapi warnanya tetap kebaca (ada data vs kosong).
                  const persen = Math.max((d.jumlah / maxAktivitasMingguan) * 100, 6);
                  const adaData = d.jumlah > 0;
                  return (
                    <View key={i} style={styles.chartBarCol}>
                      <View style={styles.chartBarValueSlot}>
                        <Text style={[styles.chartBarValue, d.highlight && styles.chartBarValueActive]}>
                          {d.jumlah}
                        </Text>
                      </View>
                      <View style={styles.chartBarTrack}>
                        <View
                          style={[
                            styles.chartBarFill,
                            {
                              height: `${persen}%`,
                              backgroundColor: d.highlight
                                ? colors.primary
                                : adaData
                                  ? `${colors.primary}80`
                                  : `${colors.primary}33`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.chartBarLabel, d.highlight && styles.chartBarLabelActive]}>
                        {d.label.slice(0, 3)}
                      </Text>
                    </View>
                  );
                })}
                </View>
                <Text style={styles.chartSummary}>{ringkasanAktivitas(aktivitasMingguan)}</Text>
              </View>
            </PagerSlide>
          </Animated.ScrollView>

          {/* Titik indikator sekaligus tombol lompat — swipe bukan satu-satunya
              cara pindah slide (penting buat aksesibilitas: konten yang cuma bisa
              dijangkau lewat gestur horizontal susah dipakai tanpa swipe). */}
          <View style={styles.pagerDots}>
            {SLIDE_LABELS.map((label, i) => {
              const active = i === slideIndex;
              return (
                <Pressable
                  key={label}
                  onPress={() => goToSlide(i)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Tampilkan ${label}`}
                  style={[styles.pagerDot, active && styles.pagerDotActive]}
                />
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 88,
    paddingLeft: spacing.marginMobile,
    paddingRight: spacing.marginMobile,
    paddingBottom: 4,
  },
  headerLogo: { width: 112, height: 32 },

  content: { padding: spacing.marginMobile, paddingTop: 12, gap: 24, paddingBottom: 32 },
  dateEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  greeting: { fontSize: 24, fontWeight: '600', color: colors.deepTealDark },
  greetingName: { fontSize: 24, fontWeight: '800', color: colors.primary },
  gelarRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  gelarText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subtitle: { fontSize: 14, color: colors.onSurfaceVariant, marginTop: 4 },

  quickActionsSection: { gap: 16 },

  // Blok ini sebelumnya surfaceVariant (#cae8ef) di atas background (#effbff) —
  // kontrasnya cuma 1.22:1, praktis tidak ada tepi yang kelihatan, jadi seluruh
  // seksi larut ke halaman dan kalah sama stat tile di atasnya (yang punya angka
  // besar berwarna). Dijadikan bidang teal solid supaya jadi satu-satunya blok
  // pekat di layar yang selain ini pucat dari atas sampai bawah.
  //
  // Pakai `primary` (#006a65), BUKAN `deepTealDark` (#0d3d3b) yang sempat dicoba:
  // #0d3d3b nyaris hitam dan terbaca sebagai benda asing yang ditempel ke halaman.
  // #006a65 warna brand-nya sendiri — tetap menonjol jelas dari background, tapi
  // masih satu keluarga hue (177° vs 195°) jadi menyatu, bukan menabrak.
  // Teks putih di atasnya 6.46:1, lolos AA untuk teks normal.
  gridSection: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.gutter,
  },
  menuHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  menuHeaderText: { flex: 1 },
  // Pill di belakang kedua tombol: bikin keduanya kebaca sebagai satu kontrol
  // dua-posisi (track + knob), bukan dua ikon lepas yang kebetulan bersebelahan.
  viewToggleRow: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.outlineVariant,
    borderRadius: 20,
    padding: 3,
  },
  // Default transparan — cuma ikon abu di atas background seksi, tanpa kotak.
  // Yang aktif dapat lingkaran teal gelap + ikon putih, jadi mode terpilih
  // kebaca dari kontras, bukan cuma dari bentuk ikonnya.
  viewToggleButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Warnanya disamakan dengan tray yang diaturnya (gridSection), biar kontrolnya
  // kebaca sebagai bagian dari blok itu, bukan tombol lepas yang kebetulan gelap.
  viewToggleButtonActive: { backgroundColor: colors.primary },
  lihatSemuaText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  list: { gap: spacing.base },
  // Permukaan tile = putih transparan tipis di atas tray, bukan putih solid:
  // tile-nya terbaca sebagai benda yang tergeletak DI ATAS tray, bukan lubang
  // yang dipotong menembusnya.
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.sm,
    padding: 12,
  },
  listIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.onPrimary },

  // 4 tile dengan lebar 30% + space-between bikin baris kedua cuma berisi 1 tile
  // yatim di kiri — bentuk yang tidak selesai, kelihatan seperti isian sisa.
  // 2x2 menutup grid-nya dan bikin tiap target sentuh jauh lebih besar.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.base,
  },
  gridCard: {
    width: '48.5%',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.sm,
    padding: 14,
  },
  // Di atas tray gelap, meredupkan tile saat ditekan bikin dia hilang. Dibalik:
  // permukaannya justru menyala sedikit, jadi umpan baliknya tetap terlihat.
  gridCardPressed: { backgroundColor: 'rgba(255,255,255,0.16)', transform: [{ scale: 0.97 }] },
  gridCardDisabled: { opacity: 0.45 },
  gridIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridLabel: { fontSize: 13, fontWeight: '700', color: colors.onPrimary },

  pagerSection: { gap: 16 },
  pager: { flexGrow: 0 },
  // flex-start biar tiap slide setinggi kontennya sendiri, bukan ikut diregangkan
  // setinggi slide terpanjang — tinggi container tetap mengikuti yang tertinggi,
  // tapi slide pendek (mis. Statistik) tidak jadi kotak kosong menjulang.
  pagerContent: { alignItems: 'flex-start' },
  slide: { gap: 16, paddingHorizontal: spacing.marginMobile },
  pagerDots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  pagerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.outlineVariant,
  },
  // Yang aktif jadi kapsul memanjang, bukan cuma ganti warna — posisi slide
  // kebaca sekilas walau titiknya kecil.
  pagerDotActive: { width: 22, backgroundColor: colors.primary },
  chartSection: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.lg,
    padding: spacing.cardPadding,
    gap: 12,
  },
  summaryTitle: { fontSize: 20, fontWeight: '700', color: colors.deepTealDark, marginBottom: 4 },
  sectionSubtitle: { fontSize: 12, color: colors.onSurfaceVariant },

  statTileRow: { flexDirection: 'row', gap: spacing.gutter },
  statTile: {
    flex: 1,
    backgroundColor: colors.backgroundWhite,
    borderRadius: radius.sm,
    padding: 14,
    gap: 6,
    alignItems: 'flex-start',
  },
  statTileIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTileValue: { fontSize: 26, fontWeight: '800', marginLeft: 9 },
  statTileLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginLeft: 4,
  },

  priorityCard: {
    backgroundColor: colors.primaryContainer,
    borderRadius: radius.lg,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  priorityAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityName: { fontSize: 17, fontWeight: '700', color: colors.onPrimaryContainer },
  priorityLokasi: { fontSize: 13, color: colors.onPrimaryContainer, opacity: 0.9, marginTop: 2 },
  priorityWaktuRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  priorityWaktu: { fontSize: 12, fontWeight: '600', color: colors.onPrimaryContainer },
  emptyStateText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    paddingVertical: 12,
  },

  // Sengaja lebih ringan dari priorityCard (putih polos, bukan teal solid):
  // pengingat itu catatan pribadi dokter, jangan menyaingi Pasien Prioritas
  // yang ada di atasnya secara visual.
  reminderCard: {
    backgroundColor: colors.backgroundWhite,
    borderRadius: radius.sm,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reminderIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderTitle: { fontSize: 15, fontWeight: '700', color: colors.deepTealDark },
  reminderMeta: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },

  chartCard: {
    backgroundColor: colors.backgroundWhite,
    borderRadius: radius.sm,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    height: 156,
  },
  chartBarCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%' },
  chartBarValueSlot: { height: 16, justifyContent: 'flex-end' },
  chartBarValue: { fontSize: 11, fontWeight: '600', color: colors.onSurfaceVariant },
  chartBarValueActive: { fontWeight: '800', color: colors.primary },
  chartBarTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  chartBarFill: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  chartSummary: { fontSize: 14, lineHeight: 21, color: colors.onSurfaceVariant },
  chartBarLabel: { fontSize: 10, color: colors.outline },
  chartBarLabelActive: { color: colors.primary, fontWeight: '700' },
});
