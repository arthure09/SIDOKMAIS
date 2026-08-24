import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../api/client';
import { fetchRadiologiDetail } from '../api/radiologi';
import { kodeModalitas } from '../utils/modalitasRadiologi';
import { useAuthStore } from '../store/authStore';
import { colors, radius, shadows, spacing } from '../theme/colors';
import { Text } from '../components/Text';
import type { RadiologiDetail } from '../api/types';
import { useHeaderScrollShadow } from '../hooks/useHeaderScrollShadow';
import { useHideTabBar } from '../hooks/useHideTabBar';
import type { PasienStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<PasienStackParamList, 'RadiologiDetail'>;

function formatWaktu(value: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  return `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString(
    'id-ID',
    { hour: '2-digit', minute: '2-digit' },
  )} WIB`;
}

// Layar ini sengaja BUKAN tabel. Hasil radiologi adalah karangan dokter
// radiolog, jadi yang dikerjakan di sini cuma tiga hal: menaruh kesimpulan
// (kesan) di posisi paling mudah dibaca, memberi narasi ruang baca yang lapang,
// dan jujur soal bagian yang memang kosong di sumbernya.
export function RadiologiDetailScreen({ route, navigation }: Props) {
  const { radiologiId } = route.params;
  const token = useAuthStore((s) => s.token);
  const insets = useSafeAreaInsets();
  useHideTabBar();
  const { onScroll, scrollEventThrottle, scrolled } = useHeaderScrollShadow();
  const [detail, setDetail] = useState<RadiologiDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setDetail(await fetchRadiologiDetail(token, radiologiId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat laporan radiologi');
    } finally {
      setLoading(false);
    }
  }, [token, radiologiId]);

  useEffect(() => {
    load();
  }, [load]);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top }, scrolled && shadows.header]}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
      </Pressable>
      <View style={styles.headerTitleBlock}>
        <Text style={styles.headerEyebrow}>Laporan radiologi</Text>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {detail?.namaPemeriksaan ?? 'Memuat…'}
        </Text>
      </View>
      <View style={styles.backButton} />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  if (error || !detail) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? 'Laporan radiologi tidak ditemukan'}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.gutter }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
      >
        <View style={styles.card}>
          <View style={styles.kopAtas}>
            <View style={styles.blokModalitas}>
              <Text style={styles.blokKode}>{kodeModalitas(detail.modalitas)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pasienNama}>{detail.pasien?.nama ?? '-'}</Text>
              <Text style={styles.pasienMeta}>
                RM {detail.pasien?.norm ?? '-'}
                {detail.modalitas ? ` · ${detail.modalitas}` : ''}
              </Text>
            </View>
            {detail.cito && (
              <View style={styles.citoPill}>
                <Text style={styles.citoPillText}>CITO</Text>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.metaGrid}>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>Diperiksa</Text>
              <Text style={styles.metaValue}>{formatWaktu(detail.tanggalPermintaan)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>Hasil dibaca</Text>
              <Text style={styles.metaValue}>{formatWaktu(detail.tanggalHasil)}</Text>
            </View>
          </View>
          <View style={styles.metaGrid}>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>Unit</Text>
              <Text style={styles.metaValue}>{detail.unit ?? 'Tidak tercatat'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>Dokter peminta</Text>
              <Text style={styles.metaValue} numberOfLines={2}>
                {detail.dokterPeminta?.nama ?? 'Tidak tercatat'}
              </Text>
            </View>
          </View>
        </View>

        {detail.klinis && (
          <View style={styles.kartuKlinis}>
            <Text style={styles.klinisLabel}>Keterangan klinis dari pengirim</Text>
            <Text style={styles.klinisTeks}>{detail.klinis}</Text>
          </View>
        )}

        {/* Kesan = kesimpulan radiolog. Ditaruh di atas narasi karena itu yang
            dicari duluan — tapi di data asli cuma 15% laporan mengisinya, jadi
            ketiadaannya harus dijelaskan, bukan disembunyikan. */}
        {detail.kesan ? (
          <View style={styles.kartuKesan}>
            <View style={styles.kesanJudulRow}>
              <MaterialIcons name="summarize" size={16} color={colors.onPrimary} />
              <Text style={styles.kesanJudul}>Kesan</Text>
            </View>
            <Text style={styles.kesanTeks}>{detail.kesan}</Text>
          </View>
        ) : (
          <View style={styles.kartuTanpaKesan}>
            <MaterialIcons name="info-outline" size={16} color={colors.onSurfaceVariant} />
            <Text style={styles.tanpaKesanTeks}>
              Kolom kesan tidak diisi. Kesimpulan radiolog biasanya ada di bagian akhir hasil
              pemeriksaan.
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.seksiJudul}>Hasil pemeriksaan</Text>
          {detail.hasil ? (
            <Text style={styles.narasi}>{detail.hasil}</Text>
          ) : (
            <Text style={styles.kosongTeks}>
              Narasi hasil belum tersedia untuk pemeriksaan ini.
            </Text>
          )}
          <View style={styles.ttdBlok}>
            <Text style={styles.metaLabel}>Dibaca oleh</Text>
            <Text style={styles.metaValue}>
              {detail.dokterPembaca?.nama ?? 'Nama dokter radiolog tidak tercatat di sistem'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: colors.error, textAlign: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.outlineVariant}1A`,
  },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitleBlock: { flex: 1, alignItems: 'center' },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.primary,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.onBackground, textAlign: 'center' },

  content: { padding: spacing.marginMobile, gap: 12, paddingBottom: 32 },

  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.sm,
    padding: 18,
    gap: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 2,
  },

  kopAtas: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  blokModalitas: {
    minWidth: 48,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
  },
  blokKode: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5, color: colors.primary },
  pasienNama: { fontSize: 18, fontWeight: '800', color: colors.onSurface },
  pasienMeta: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },
  citoPill: {
    backgroundColor: colors.errorContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  citoPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, color: colors.onErrorContainer },

  divider: { height: 1, backgroundColor: `${colors.outlineVariant}4D` },
  metaGrid: { flexDirection: 'row', gap: 16 },
  metaLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.outline,
    marginBottom: 3,
  },
  metaValue: { fontSize: 13, fontWeight: '600', color: colors.onSurface },

  kartuKlinis: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.sm,
    padding: 14,
    gap: 4,
  },
  klinisLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.outline,
  },
  klinisTeks: { fontSize: 13, color: colors.onSurface, lineHeight: 19 },

  // Satu-satunya blok berwarna penuh di layar ini: kesimpulan radiolog.
  kartuKesan: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    padding: 18,
    gap: 8,
  },
  kesanJudulRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kesanJudul: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.onPrimary,
  },
  kesanTeks: { fontSize: 15, fontWeight: '600', color: colors.onPrimary, lineHeight: 22 },

  kartuTanpaKesan: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.sm,
    padding: 14,
  },
  tanpaKesanTeks: { flex: 1, fontSize: 12, color: colors.onSurfaceVariant, lineHeight: 18 },

  seksiJudul: { fontSize: 16, fontWeight: '800', color: colors.primary },
  // Narasi radiologi dibaca, bukan dipindai: baris lebih renggang dan ukuran
  // sedikit lebih besar daripada teks tabel di modul lain.
  narasi: { fontSize: 15, color: colors.onSurface, lineHeight: 25 },
  kosongTeks: { fontSize: 13, color: colors.onSurfaceVariant },
  ttdBlok: { borderTopWidth: 1, borderTopColor: `${colors.outlineVariant}4D`, paddingTop: 14 },
});
