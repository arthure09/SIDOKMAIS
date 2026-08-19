import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, menuAccent, radius, spacing } from '../theme/colors';
import { Text } from '../components/Text';
import { ApiError } from '../api/client';
import { fetchPendapatan } from '../api/pendapatan';
import { useAuthStore } from '../store/authStore';
import type { BarisJasaMedis, PendapatanResponse, PeriodePendapatan } from '../api/types';
import { useTabBarDockOnScroll } from '../hooks/useTabBarDockOnScroll';
import { useAnimatedHeaderFade } from '../hooks/useAnimatedHeaderFade';
import { useHideTabBar } from '../hooks/useHideTabBar';
import type { HomeStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'DataPendapatan'>;

/** Pengelompokan utama laporan jasa medis (Tahap 4). */
type Kelompok = 'JKN' | 'NON_JKN';

const kelompokDari = (trx: BarisJasaMedis): Kelompok => (trx.penjamin.isJkn ? 'JKN' : 'NON_JKN');
const tanggalKey = (trx: BarisJasaMedis) => trx.tanggalTindakan.slice(0, 10);
const jumlah = (list: BarisJasaMedis[]) => list.reduce((n, t) => n + t.jasa, 0);

// Daftar dimuat 10 baris sekali jalan.
// ponytail: semua baris yang sudah dimuat tetap hidup di satu ScrollView, jadi
// yang dihemat waktu render awal, bukan memori setelah user menekan "tampilkan
// lagi" berkali-kali. Cukup buat ratusan baris. Kalau nanti satu bulan bisa
// ribuan, pindahkan ledger-nya ke SectionList dan panel jadi ListHeaderComponent.
const BATCH = 10;

// Ramp analog yang sama dengan tile Menu di Home (lihat komentar di colors.ts) —
// di atas panel #0D3D3B kontrasnya lebih tinggi lagi daripada di tray #006a65.
const RAMP = [menuAccent.mint, menuAccent.teal, menuAccent.cyan, menuAccent.sky];

// Tinggi baris header (tombol kembali 40 + paddingBottom 8), dipakai cuma
// sebagai tebakan awal sebelum onLayout mengukur yang sebenarnya — tanpa itu
// konten mulai dari nol dan meloncat satu frame kemudian.
const HEADER_ROW = 40 + spacing.base;

function formatRupiah(value: number) {
  return `Rp ${value.toLocaleString('id-ID')}`;
}

// Dipakai di legend penjamin, di mana nominal penuh bikin barisnya pecah.
function formatRupiahSingkat(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)} rb`;
  return String(value);
}

function labelBulan(key: string) {
  return new Date(`${key}-01`).toLocaleDateString('id-ID', { month: 'long' });
}

function labelBulanTahun(key: string) {
  return `${labelBulan(key)} ${key.slice(0, 4)}`;
}

/**
 * Periode yang sedang dilihat, mis. "1–19 Agustus 2026" — bentuk yang sama
 * dengan "01-08-2026 s/d 17-08-2026" di SIREMDIS, cuma lebih ringkas.
 *
 * Menggantikan indikator pertumbuhan (+X% dari bulan lalu) yang dihapus atas
 * keputusan Arthuro, 14 Ags 2026: menempelkan panah hijau/merah di angka jasa
 * medis mendorong dokter membaca angkanya sebagai skor, dan insentif pembayaran
 * adalah jalur klasik menuju overtreatment. Baris ini menjawab "ini angka
 * periode apa", bukan "saya sebagus apa".
 */
function labelPeriode(periode: PeriodePendapatan | null) {
  if (!periode) return null;
  const { tanggalAwal, tanggalAkhir } = periode;
  const hariAwal = Number(tanggalAwal.slice(8, 10));
  const hariAkhir = Number(tanggalAkhir.slice(8, 10));
  const bulanAwal = tanggalAwal.slice(0, 7);
  const bulanAkhir = tanggalAkhir.slice(0, 7);

  // Rentang di dalam satu bulan cukup menyebut bulannya sekali.
  if (bulanAwal === bulanAkhir) {
    const rentang = hariAwal === hariAkhir ? `${hariAwal}` : `${hariAwal}–${hariAkhir}`;
    return `${rentang} ${labelBulanTahun(bulanAwal)}`;
  }
  return `${hariAwal} ${labelBulanTahun(bulanAwal)} – ${hariAkhir} ${labelBulanTahun(bulanAkhir)}`;
}

function labelTanggal(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' });
}

function labelJam(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Rentang penuh satu bulan `YYYY-MM`, dipakai pintasan bulan. */
function rentangBulan(key: string): PeriodePendapatan {
  const [tahun, bulan] = key.split('-').map(Number);
  return { tanggalAwal: `${key}-01`, tanggalAkhir: ymd(new Date(tahun, bulan, 0)) };
}

export function DataPendapatanScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  useHideTabBar();
  const { onScroll, scrollEventThrottle, scrolled } = useTabBarDockOnScroll();
  const { headerBackgroundColor, headerShadowOpacity, headerElevation } = useAnimatedHeaderFade(scrolled);

  // Header menempel di atas konten (absolute) dan menggeser dirinya sendiri
  // keluar layar waktu discroll ke bawah. Absolute, bukan menyusutkan tinggi
  // seperti useCollapseOnScroll: kotak yang tingginya berubah bikin list
  // re-layout tiap frame dan ScrollView menjepit offset-nya balik (lihat
  // catatan panjang di hook itu). Di sini yang bergerak cuma transform.
  const [headerHeight, setHeaderHeight] = useState(insets.top + HEADER_ROW);
  const scrollY = useRef(new Animated.Value(0)).current;

  // diffClamp = header mengikuti jari 1:1 sejauh setinggi dirinya, lalu berhenti;
  // arah baliknya langsung memunculkannya lagi tanpa harus balik ke puncak list.
  // Semuanya jalan di native driver, jadi tidak ada satu pun re-render per frame.
  const headerSlide = useMemo(() => {
    const h = Math.max(headerHeight, 1);
    return Animated.diffClamp(
      // extrapolateLeft: overscroll/pull-to-refresh bikin y negatif, dan
      // diffClamp membacanya sebagai "scroll naik" — tanpa dijepit ke 0, menarik
      // list ke bawah di puncak halaman menahan header di posisi yang salah.
      scrollY.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolateLeft: 'clamp' }),
      0,
      h,
    ).interpolate({ inputRange: [0, h], outputRange: [0, -h] });
  }, [scrollY, headerHeight]);

  // Animated.event buat scrollY (native), listener buat handler JS yang sudah
  // ada (dock tab bar + flag `scrolled`) — dua-duanya dari satu event scroll.
  const handleScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
        listener: onScroll,
      }),
    [scrollY, onScroll],
  );

  const token = useAuthStore((s) => s.token);

  // `periode` null = "biar server yang pilih" (bulan terisi paling baru,
  // dipotong di hari ini kalau masih berjalan). Rentang mana yang masuk akal
  // baru diketahui setelah respons pertama datang, jadi tidak bisa ditebak di
  // sini.
  const [periode, setPeriode] = useState<PeriodePendapatan | null>(null);
  const [resp, setResp] = useState<PendapatanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sumber, setSumber] = useState<string | null>(null);
  const [kelompok, setKelompok] = useState<Kelompok | null>(null);
  const [hanyaMenunggu, setHanyaMenunggu] = useState(false);
  const [periodeTerbuka, setPeriodeTerbuka] = useState(false);
  const [tampil, setTampil] = useState(BATCH);
  const [refreshing, setRefreshing] = useState(false);

  // Pola draft/apply seperti filter tanggal di HasilLabListScreen: menulis
  // periode langsung dari picker memicu fetch tiap kali tanggal digeser,
  // selagi sheet-nya masih terbuka.
  const [draftDari, setDraftDari] = useState<Date | null>(null);
  const [draftSampai, setDraftSampai] = useState<Date | null>(null);
  const [pickerTerbuka, setPickerTerbuka] = useState<'dari' | 'sampai' | null>(null);

  const onChangeDari = useCallback((event: DateTimePickerEvent, dipilih?: Date) => {
    if (Platform.OS !== 'ios') setPickerTerbuka(null);
    if (event.type === 'dismissed') return;
    if (dipilih) setDraftDari(dipilih);
  }, []);

  const onChangeSampai = useCallback((event: DateTimePickerEvent, dipilih?: Date) => {
    if (Platform.OS !== 'ios') setPickerTerbuka(null);
    if (event.type === 'dismissed') return;
    if (dipilih) setDraftSampai(dipilih);
  }, []);

  const muat = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const hasil = await fetchPendapatan(token, periode);
      setResp(hasil);
      // Server yang memutuskan rentangnya waktu kita belum menentukan;
      // disimpan supaya pemilih periode menampilkan yang benar.
      setPeriode((p) => p ?? hasil.periode);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data jasa medis');
    }
  }, [token, periode]);

  useEffect(() => {
    let batal = false;
    setLoading(true);
    muat().finally(() => {
      if (!batal) setLoading(false);
    });
    return () => {
      batal = true;
    };
  }, [muat]);

  // Ganti periode atau filter = daftar dibaca dari awal lagi. Satu effect untuk
  // semua pemicunya, bukan setTampil di tiap setter — yang begitu selalu ada
  // satu yang kelupaan.
  useEffect(() => setTampil(BATCH), [periode, sumber, kelompok, hanyaMenunggu]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    muat().finally(() => setRefreshing(false));
  }, [muat]);

  const bulanKeys = resp?.bulanTersedia ?? [];
  const periodeAktif = periode ?? resp?.periode ?? null;
  const bulanIni = useMemo(() => resp?.data ?? [], [resp]);

  const diterima = useMemo(
    () => bulanIni.filter((t) => t.statusVerifikasi === 'TERVERIFIKASI'),
    [bulanIni],
  );
  const menunggu = useMemo(
    () => bulanIni.filter((t) => t.statusVerifikasi === 'MENUNGGU'),
    [bulanIni],
  );

  // Angka besar & uang menunggu dipakai dari ringkasan server, bukan dijumlah
  // ulang di sini: keduanya dihitung dari baris yang sama persis, dan satu
  // sumber angka lebih baik daripada dua yang kebetulan cocok.
  const totalDiterima = resp?.ringkasan.totalRemunerasiBruto ?? 0;
  const totalMenunggu = resp?.ringkasan.totalMenunggu ?? 0;
  const teksPeriode = labelPeriode(periodeAktif);

  // Komposisi sengaja dihitung dari transaksi TERVERIFIKASI saja, sama dengan
  // angka besar di atasnya — kalau bar-nya memakai semua transaksi, segmennya
  // tidak akan pernah menjumlah ke angka yang dibacanya.
  const perSumber = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of diterima) map.set(t.penjamin.nama, (map.get(t.penjamin.nama) ?? 0) + t.jasa);
    return [...map]
      .map(([nama, total]) => ({ nama, total }))
      .sort((a, b) => b.total - a.total);
  }, [diterima]);

  // Dua kelompok utama laporan jasa medis. Angkanya dari ringkasan server,
  // sama seperti angka besar di atasnya.
  const perKelompok: { value: Kelompok; label: string; total: number }[] = [
    { value: 'JKN', label: 'JKN', total: resp?.ringkasan.totalJkn ?? 0 },
    { value: 'NON_JKN', label: 'Non-JKN', total: resp?.ringkasan.totalNonJkn ?? 0 },
  ];

  const rincian = useMemo(
    () =>
      bulanIni.filter(
        (t) =>
          (!sumber || t.penjamin.nama === sumber) &&
          (!kelompok || kelompokDari(t) === kelompok) &&
          (!hanyaMenunggu || t.statusVerifikasi === 'MENUNGGU'),
      ),
    [bulanIni, sumber, kelompok, hanyaMenunggu],
  );

  // Dikelompokkan SETELAH dipotong, jadi grup tanggal terakhir bisa tampil
  // sebagian — itu memang maunya "10 pertama", bukan "10 tanggal pertama".
  const grup = useMemo(() => {
    const map = new Map<string, BarisJasaMedis[]>();
    for (const t of rincian.slice(0, tampil)) {
      const kunci = tanggalKey(t);
      const isi = map.get(kunci);
      if (isi) isi.push(t);
      else map.set(kunci, [t]);
    }
    return [...map].sort((a, b) => b[0].localeCompare(a[0]));
  }, [rincian, tampil]);

  const sisa = rincian.length - tampil;

  const adaFilter = sumber !== null || kelompok !== null || hanyaMenunggu;

  function hapusFilter() {
    setSumber(null);
    setKelompok(null);
    setHanyaMenunggu(false);
  }

  function bukaSheetPeriode() {
    setDraftDari(periodeAktif ? new Date(`${periodeAktif.tanggalAwal}T00:00:00`) : null);
    setDraftSampai(periodeAktif ? new Date(`${periodeAktif.tanggalAkhir}T00:00:00`) : null);
    setPickerTerbuka(null);
    setPeriodeTerbuka(true);
  }

  function terapkanPeriode(baru: PeriodePendapatan) {
    setPeriode(baru);
    setPeriodeTerbuka(false);
    setPickerTerbuka(null);
    hapusFilter();
  }

  return (
    <View style={styles.container}>
      <Animated.View
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        style={[styles.header, { paddingTop: insets.top, transform: [{ translateY: headerSlide }] }]}
      >
        {/* Lapisan warna + shadow dipisah jadi anak sendiri: geseran header jalan
            di native driver, sedangkan warna & shadow harus di thread JS, dan
            satu View tidak boleh dianimasikan dua driver sekaligus. */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.headerLapisan,
            {
              backgroundColor: headerBackgroundColor,
              shadowOpacity: headerShadowOpacity,
              elevation: headerElevation,
            },
          ]}
        />
        <Pressable onPress={navigation.goBack} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
        </Pressable>
        <Text style={styles.headerTitle}>Jasa Medis</Text>
        <View style={styles.backButton} />
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          // Header sudah keluar dari alur normal, jadi ruangnya dikembalikan di sini.
          { paddingTop: headerHeight + spacing.marginMobile, paddingBottom: insets.bottom + spacing.gutter },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={scrollEventThrottle}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressViewOffset={headerHeight}
          />
        }
      >
        {/* Sheet, bukan deretan chip: periodenya rentang tanggal bebas (ikut
            SIREMDIS), dan baris chip yang harus digeser horizontal
            menyembunyikan pilihan lama di luar layar tanpa penanda apa pun. */}
        <Pressable
          accessibilityRole="button"
          onPress={bukaSheetPeriode}
          style={({ pressed }) => [styles.bulanTrigger, pressed && styles.ditekan]}
        >
          <MaterialIcons name="calendar-month" size={18} color={colors.primary} />
          <Text style={styles.bulanTriggerText}>{teksPeriode ?? 'Memuat…'}</Text>
          <MaterialIcons name="expand-more" size={20} color={colors.onSurfaceVariant} />
        </Pressable>

        {loading && !resp && <ActivityIndicator color={colors.primary} style={styles.pemuat} />}
        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Satu-satunya permukaan gelap di seluruh app: penanda bahwa ini angka
            uang, bukan sekadar kartu ringkasan lain. */}
        <View style={styles.panel}>
          <Text style={styles.panelLabel}>Jasa medis diterima</Text>
          <View style={styles.panelAngkaRow}>
            <Text style={styles.panelAngka}>{formatRupiah(totalDiterima)}</Text>
            {teksPeriode && <Text style={styles.panelPeriode}>{teksPeriode}</Text>}
          </View>

          {/* Pecahan per jenis tinggal di dalam panel, bukan dua kartu putih
              mengambang di bawahnya: satu permukaan ringkasan yang seluruhnya
              bisa ditekan buat menyaring daftar di bawah. */}
          <View style={styles.jenisRow}>
            {perKelompok.map((k) => {
              const active = kelompok === k.value;
              return (
                <Pressable
                  key={k.value}
                  accessibilityRole="button"
                  onPress={() => setKelompok(active ? null : k.value)}
                  style={[styles.jenisItem, active && styles.jenisItemActive]}
                >
                  <Text style={styles.jenisLabel}>{k.label}</Text>
                  <Text style={styles.jenisNominal}>{formatRupiah(k.total)}</Text>
                </Pressable>
              );
            })}
          </View>

          {perSumber.length > 0 && (
            <>
              <View style={styles.bar}>
                {perSumber.map((s, i) => (
                  <View
                    key={s.nama}
                    style={{
                      flex: s.total,
                      backgroundColor: RAMP[i % RAMP.length],
                      opacity: sumber && sumber !== s.nama ? 0.3 : 1,
                    }}
                  />
                ))}
              </View>

              {/* Legend-nya sekaligus filternya: tidak ada dropdown "Sumber"
                  terpisah, dan bar di atas berhenti jadi dekorasi. */}
              <View style={styles.legendRow}>
                {perSumber.map((s, i) => {
                  const active = sumber === s.nama;
                  return (
                    <Pressable
                      key={s.nama}
                      accessibilityRole="button"
                      onPress={() => setSumber(active ? null : s.nama)}
                      style={[styles.legendItem, active && styles.legendItemActive]}
                    >
                      <View style={[styles.legendDot, { backgroundColor: RAMP[i % RAMP.length] }]} />
                      <Text style={styles.legendNama} numberOfLines={1}>
                        {s.nama}
                      </Text>
                      <Text style={styles.legendNominal}>{formatRupiahSingkat(s.total)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {totalMenunggu > 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setHanyaMenunggu((v) => !v)}
              style={[styles.menungguRow, hanyaMenunggu && styles.menungguRowActive]}
            >
              <MaterialIcons name="schedule" size={18} color={colors.surfaceVariant} />
              <Text style={styles.menungguText}>
                <Text style={styles.menungguNominal}>{formatRupiah(totalMenunggu)}</Text> menunggu
                verifikasi · {menunggu.length} pelayanan
              </Text>
              <MaterialIcons
                name={hanyaMenunggu ? 'close' : 'chevron-right'}
                size={18}
                color={colors.surfaceVariant}
              />
            </Pressable>
          )}
        </View>

        <View style={styles.rincianHeader}>
          <Text style={styles.rincianTitle}>
            {rincian.length} pelayanan{adaFilter ? ' tersaring' : ''}
          </Text>
          {adaFilter && (
            <Pressable accessibilityRole="button" onPress={hapusFilter} hitSlop={8}>
              <Text style={styles.hapusFilter}>Tampilkan semua</Text>
            </Pressable>
          )}
        </View>

        {grup.length === 0 ? (
          <Text style={styles.emptyText}>Tidak ada pelayanan untuk filter ini.</Text>
        ) : (
          grup.map(([tanggal, isi]) => (
            <View key={tanggal} style={styles.grup}>
              <View style={styles.grupHeader}>
                <Text style={styles.grupTanggal}>{labelTanggal(tanggal)}</Text>
                <Text style={styles.grupTotal}>{formatRupiah(jumlah(isi))}</Text>
              </View>
              <View style={styles.grupCard}>
                {isi.map((trx, index) => (
                  <View key={trx.id}>
                    {index > 0 && <View style={styles.trxDivider} />}
                    <View style={styles.trxRow}>
                      {/* Kolom yang sama dengan tabel "Detail Tindakan"
                          SIREMDIS, disusun tiga baris karena layar ponsel tidak
                          muat 8 kolom: tindakan + jasa, lalu pasien + NORM,
                          lalu jam + unit + penjamin. */}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.trxJenis} numberOfLines={1}>
                          {trx.namaTindakan}
                        </Text>
                        <Text style={styles.trxPasien} numberOfLines={1}>
                          {trx.pasien.nama}
                          <Text style={styles.trxMeta}> · RM {trx.pasien.norm}</Text>
                        </Text>
                        <Text style={styles.trxMeta} numberOfLines={1}>
                          {labelJam(trx.tanggalTindakan)} · {trx.unitPelayanan} ·{' '}
                          {trx.penjamin.nama}
                        </Text>
                      </View>
                      <View style={styles.trxNominalWrap}>
                        <Text style={styles.trxNominal}>{formatRupiah(trx.jasa)}</Text>
                        {trx.statusVerifikasi === 'MENUNGGU' && (
                          <Text style={styles.trxMenunggu}>Menunggu verifikasi</Text>
                        )}
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}

        {sisa > 0 && (
          <Pressable
            accessibilityRole="button"
            onPress={() => setTampil((n) => n + BATCH)}
            style={({ pressed }) => [styles.muatLagi, pressed && styles.ditekan]}
          >
            <Text style={styles.muatLagiText}>
              Tampilkan {Math.min(BATCH, sisa)} pelayanan lagi
            </Text>
          </Pressable>
        )}
      </Animated.ScrollView>

      <Modal
        visible={periodeTerbuka}
        transparent
        animationType="fade"
        onRequestClose={() => setPeriodeTerbuka(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setPeriodeTerbuka(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.gutter }]}>
          <Text style={styles.sheetTitle}>Periode</Text>
          <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
            <View style={styles.sheetBody}>
              <Pressable
                style={styles.periodeField}
                onPress={() => setPickerTerbuka((v) => (v === 'dari' ? null : 'dari'))}
              >
                <Text style={styles.periodeFieldLabel}>Dari</Text>
                <Text style={styles.periodeFieldValue}>
                  {draftDari ? labelTanggal(draftDari.toISOString()) : 'Pilih tanggal'}
                </Text>
              </Pressable>
              {pickerTerbuka === 'dari' && (
                <DateTimePicker
                  value={draftDari ?? draftSampai ?? new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  themeVariant="light"
                  textColor={colors.onSurface}
                  accentColor={colors.primary}
                  maximumDate={draftSampai ?? undefined}
                  onChange={onChangeDari}
                />
              )}

              <Pressable
                style={styles.periodeField}
                onPress={() => setPickerTerbuka((v) => (v === 'sampai' ? null : 'sampai'))}
              >
                <Text style={styles.periodeFieldLabel}>Sampai</Text>
                <Text style={styles.periodeFieldValue}>
                  {draftSampai ? labelTanggal(draftSampai.toISOString()) : 'Pilih tanggal'}
                </Text>
              </Pressable>
              {pickerTerbuka === 'sampai' && (
                <DateTimePicker
                  value={draftSampai ?? draftDari ?? new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  themeVariant="light"
                  textColor={colors.onSurface}
                  accentColor={colors.primary}
                  minimumDate={draftDari ?? undefined}
                  onChange={onChangeSampai}
                />
              )}

              <Pressable
                accessibilityRole="button"
                disabled={!draftDari || !draftSampai}
                onPress={() =>
                  draftDari &&
                  draftSampai &&
                  terapkanPeriode({ tanggalAwal: ymd(draftDari), tanggalAkhir: ymd(draftSampai) })
                }
                style={({ pressed }) => [
                  styles.terapkan,
                  (!draftDari || !draftSampai) && styles.terapkanNonaktif,
                  pressed && styles.ditekan,
                ]}
              >
                <Text style={styles.terapkanText}>Terapkan</Text>
              </Pressable>
            </View>

            {/* Pintasan bulan tetap ada di bawah pemilih rentang: cuma di sini
                dokter bisa tahu bulan mana yang memang ada isinya — picker
                tanggal tidak bisa menyampaikan itu. */}
            {bulanKeys.length > 0 && <Text style={styles.sheetTitle}>Bulan yang ada isinya</Text>}
            {bulanKeys.map((key) => {
              const rentang = rentangBulan(key);
              const active =
                periodeAktif?.tanggalAwal === rentang.tanggalAwal &&
                periodeAktif?.tanggalAkhir === rentang.tanggalAkhir;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  onPress={() => terapkanPeriode(rentang)}
                  style={({ pressed }) => [styles.sheetItem, pressed && styles.ditekan]}
                >
                  <Text style={[styles.sheetItemText, active && styles.sheetItemTextActive]}>
                    {labelBulanTahun(key)}
                  </Text>
                  {active && <MaterialIcons name="check" size={20} color={colors.primary} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// Angka uang pakai figure tabular supaya kolom nominal lurus ke bawah; tanpa
// ini digit Nunito Sans lebarnya beda-beda dan kolomnya goyang.
const angka = { fontVariant: ['tabular-nums' as const] };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.marginMobile, gap: spacing.gutter, paddingBottom: 32 },

  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: spacing.base,
  },
  headerLapisan: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.onBackground },

  ditekan: { opacity: 0.7 },

  bulanTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'flex-start',
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceVariant,
  },
  bulanTriggerText: { fontSize: 13, fontWeight: '700', color: colors.onSurface },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000066' },
  sheet: {
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
  // Dibatasi tingginya supaya isi sheet yang panjang tidak menutupi layar.
  sheetList: { maxHeight: 460 },
  sheetBody: { paddingHorizontal: spacing.marginMobile, gap: spacing.base, paddingBottom: spacing.gutter },

  periodeField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  periodeFieldLabel: { fontSize: 13, color: colors.onSurfaceVariant },
  periodeFieldValue: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  terapkan: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  terapkanNonaktif: { opacity: 0.4 },
  terapkanText: { fontSize: 14, fontWeight: '700', color: colors.onPrimary },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.marginMobile,
    paddingVertical: 14,
  },
  sheetItemText: { fontSize: 15, color: colors.onSurface },
  sheetItemTextActive: { fontWeight: '800', color: colors.primary },

  muatLagi: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  muatLagiText: { fontSize: 13, fontWeight: '700', color: colors.primary },

  panel: {
    backgroundColor: colors.deepTealDark,
    borderRadius: radius.md,
    padding: spacing.cardPadding,
    gap: spacing.gutter,
  },
  panelLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.surfaceVariant,
  },
  panelAngkaRow: { gap: 6 },
  panelAngka: { ...angka, fontSize: 30, fontWeight: '800', color: colors.onPrimary },
  panelPeriode: { ...angka, fontSize: 12, color: colors.surfaceVariant },

  bar: { flexDirection: 'row', height: 10, borderRadius: radius.full, overflow: 'hidden', gap: 2 },
  legendRow: { gap: spacing.base },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: radius.sm,
  },
  legendItemActive: { backgroundColor: `${colors.onPrimary}14` },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendNama: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.onPrimary },
  legendNominal: { ...angka, fontSize: 13, fontWeight: '700', color: colors.surfaceVariant },

  menungguRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: spacing.gutter,
    borderTopWidth: 1,
    borderTopColor: `${colors.onPrimary}24`,
  },
  menungguRowActive: { opacity: 0.75 },
  menungguText: { flex: 1, fontSize: 12, color: colors.surfaceVariant },
  menungguNominal: { ...angka, fontSize: 13, fontWeight: '800', color: colors.onPrimary },

  jenisRow: { flexDirection: 'row', gap: spacing.base },
  jenisItem: {
    flex: 1,
    gap: 2,
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: `${colors.onPrimary}0F`,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  jenisItemActive: { backgroundColor: `${colors.onPrimary}1F`, borderColor: menuAccent.mint },
  jenisLabel: { fontSize: 11, fontWeight: '600', color: colors.surfaceVariant },
  jenisNominal: { ...angka, fontSize: 15, fontWeight: '800', color: colors.onPrimary },

  rincianHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rincianTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, color: colors.outline },
  hapusFilter: { fontSize: 12, fontWeight: '700', color: colors.primary },
  emptyText: { fontSize: 14, color: colors.onSurfaceVariant },
  pemuat: { paddingVertical: 24 },
  errorText: { fontSize: 14, color: colors.error },

  grup: { gap: spacing.base },
  grupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  grupTanggal: { fontSize: 13, fontWeight: '700', color: colors.onSurfaceVariant },
  grupTotal: { ...angka, fontSize: 12, fontWeight: '600', color: colors.outline },
  grupCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.gutter,
  },
  trxDivider: { height: 1, backgroundColor: colors.surfaceVariant },
  trxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.gutter, paddingVertical: 14 },
  trxJenis: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  trxPasien: { fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant, marginTop: 3 },
  trxMeta: { ...angka, fontSize: 12, fontWeight: '400', color: colors.outline, marginTop: 2 },
  trxNominalWrap: { alignItems: 'flex-end', gap: 2 },
  trxNominal: { ...angka, fontSize: 15, fontWeight: '700', color: colors.onSurface },
  trxMenunggu: { fontSize: 10, fontWeight: '700', color: colors.outline },
});
