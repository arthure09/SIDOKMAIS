import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../api/client';
import { toDateParam } from '../utils/tanggal';
import { kelompokkanPerTanggal } from '../utils/kelompokHasilLab';
import { fetchHasilLabList } from '../api/lab';
import { useAuthStore } from '../store/authStore';
import { colors, radius, shadows, spacing } from '../theme/colors';
import { Text } from '../components/Text';
import { FilterTanggal } from '../components/FilterTanggal';
import type { HasilLabRingkasan } from '../api/types';
import { useHeaderScrollShadow } from '../hooks/useHeaderScrollShadow';
import { useHideTabBar } from '../hooks/useHideTabBar';
import type { PasienStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<PasienStackParamList, 'HasilLabList'>;

// Kop tanggal dibaca dua kali: sekilas lewat blok tanggal di kiri (angka + bulan
// pendek), lalu lengkap di judul kartu. Hari disertakan karena dokter mengingat
// pengambilan sampel sebagai "Senin lalu", bukan sebagai angka tanggal.
function formatHariTanggal(value: string) {
  return new Date(value).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatBlokTanggal(value: string) {
  const d = new Date(value);
  return {
    hari: String(d.getDate()).padStart(2, '0'),
    bulan: d.toLocaleDateString('id-ID', { month: 'short' }).replace('.', ''),
  };
}

// Maksimal 3 chip pemeriksaan; sisanya diringkas. Tiga nama sudah cukup untuk
// mengenali jenis pemeriksaannya, lebih dari itu kartunya jadi dinding teks.
const CHIP_TAMPIL = 3;


export function HasilLabListScreen({ route, navigation }: Props) {
  const { pasienId, nama } = route.params;
  const token = useAuthStore((s) => s.token);
  const insets = useSafeAreaInsets();
  useHideTabBar();
  const { onScroll, scrollEventThrottle, scrolled } = useHeaderScrollShadow();
  const [items, setItems] = useState<HasilLabRingkasan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter yang benar-benar diterapkan ke request. `draft*` cuma dipakai
  // selagi modal terbuka supaya batal/tutup modal tidak langsung ubah hasil.
  const [dariTanggal, setDariTanggal] = useState<Date | null>(null);
  const [sampaiTanggal, setSampaiTanggal] = useState<Date | null>(null);
  // `isCancelled` dicek lagi setelah tiap `await` supaya respons dari request
  // basi (mis. ganti filter cepat-cepat, request lama baru resolve belakangan)
  // tidak menimpa state dari request yang lebih baru.
  const load = useCallback(
    async (isCancelled: () => boolean) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const result = await fetchHasilLabList(token, pasienId, {
          limit: 50,
          dariTanggal: dariTanggal ? toDateParam(dariTanggal) : undefined,
          sampaiTanggal: sampaiTanggal ? toDateParam(sampaiTanggal) : undefined,
        });
        if (isCancelled()) return;
        setItems(result.data);
      } catch (err) {
        if (isCancelled()) return;
        setError(err instanceof ApiError ? err.message : 'Gagal memuat hasil lab');
      } finally {
        if (!isCancelled()) setLoading(false);
      }
    },
    [token, pasienId, dariTanggal, sampaiTanggal],
  );

  useEffect(() => {
    let cancelled = false;
    load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top }, scrolled && shadows.header]}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
      </Pressable>
      <View style={styles.headerTitleBlock}>
        <Text style={styles.headerEyebrow}>Hasil laboratorium</Text>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {nama}
        </Text>
      </View>
      <View style={styles.backButton} />
    </View>
  );

  const grup = useMemo(() => kelompokkanPerTanggal(items), [items]);

  const filterAktif = dariTanggal !== null || sampaiTanggal !== null;

  const filterBar = (
    <View style={styles.filterBarWrapper}>
      <FilterTanggal
        judul="Filter Tanggal Permintaan"
        dari={dariTanggal}
        sampai={sampaiTanggal}
        onChange={(dari, sampai) => {
          setDariTanggal(dari);
          setSampaiTanggal(sampai);
        }}
      />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {header}
        {filterBar}
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        {header}
        {filterBar}
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}
      {filterBar}
      {grup.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <MaterialIcons name="science" size={28} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>
            {filterAktif ? 'Tidak ada hasil di rentang ini' : 'Belum ada hasil lab'}
          </Text>
          <Text style={styles.emptyText}>
            {filterAktif
              ? 'Lebarkan rentang tanggalnya untuk melihat pengambilan sebelumnya.'
              : `Hasil pemeriksaan ${nama} akan muncul di sini begitu laboratorium mengeluarkannya.`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={grup}
          keyExtractor={(item) => item.key}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + spacing.gutter }]}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
          ListHeaderComponent={
            <Text style={styles.listIntro}>
              {grup.length} tanggal pengambilan · {grup.reduce((n, g) => n + g.jumlahParameter, 0)} nilai
            </Text>
          }
          renderItem={({ item }) => {
            const blok = formatBlokTanggal(item.tanggal);
            const sisaChip = item.pemeriksaan.length - CHIP_TAMPIL;
            return (
              // SIMRS tidak menyimpan PDF hasil lab — yang ada cuma parameter
              // terstruktur, dan itu yang ditampilkan HasilLabDetail. Layar
              // "Lihat PDF" berisi berkas contoh statis sudah dihapus (24 Ags
              // 2026) begitu aplikasi membaca data pasien asli.
              <Pressable
                onPress={() =>
                  navigation.navigate('HasilLabDetail', {
                    pemeriksaanLabIds: item.ids,
                    tanggal: item.tanggal,
                  })
                }
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              >
                <View style={styles.cardTop}>
                  <View style={styles.blokTanggal}>
                    <Text style={styles.blokHari}>{blok.hari}</Text>
                    <Text style={styles.blokBulan}>{blok.bulan}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.labEyebrow} numberOfLines={1}>
                      {item.labs.length > 0 ? item.labs.join(' · ') : 'Laboratorium tidak tercatat'}
                    </Text>
                    <Text style={styles.judulTanggal} numberOfLines={1}>
                      {formatHariTanggal(item.tanggal)}
                    </Text>
                  </View>
                </View>

                <View style={styles.chipBaris}>
                  {item.pemeriksaan.slice(0, CHIP_TAMPIL).map((nama) => (
                    <View key={nama} style={styles.chip}>
                      <Text style={styles.chipText} numberOfLines={1}>
                        {nama}
                      </Text>
                    </View>
                  ))}
                  {sisaChip > 0 && (
                    <View style={[styles.chip, styles.chipSisa]}>
                      <Text style={styles.chipText}>+{sisaChip} lagi</Text>
                    </View>
                  )}
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.footerHitung}>
                    {item.ids.length} pemeriksaan · {item.jumlahParameter} nilai
                  </Text>
                  {item.jumlahAbnormal > 0 ? (
                    <View style={styles.abnormalPill}>
                      <MaterialIcons name="priority-high" size={12} color={colors.onErrorContainer} />
                      <Text style={styles.abnormalPillText}>
                        {item.jumlahAbnormal} di luar rujukan
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.footerNormal}>Semua dalam rujukan</Text>
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 8 },
  errorText: { color: colors.error, textAlign: 'center' },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  emptyText: { color: colors.onSurfaceVariant, textAlign: 'center', lineHeight: 20, maxWidth: 280 },

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
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.onBackground, textAlign: 'center' },

  filterBarWrapper: { paddingHorizontal: spacing.marginMobile, paddingTop: spacing.base },

  listContent: { padding: spacing.marginMobile, gap: 12 },
  listIntro: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    paddingBottom: 4,
  },

  card: {
    backgroundColor: colors.backgroundWhite,
    borderRadius: radius.sm,
    padding: 16,
    gap: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 2,
  },
  cardPressed: { opacity: 0.95, transform: [{ scale: 0.98 }] },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // Blok tanggal: satu-satunya elemen bercetak tebal di kartu, karena tanggal
  // itulah yang dipakai dokter untuk memilih.
  blokTanggal: {
    width: 48,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
  },
  blokHari: { fontSize: 20, fontWeight: '800', color: colors.primary, lineHeight: 24 },
  blokBulan: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.onSurfaceVariant,
  },
  labEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.outline,
    marginBottom: 2,
  },
  judulTanggal: { fontSize: 15, fontWeight: '700', color: colors.onSurface },

  chipBaris: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    maxWidth: '100%',
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  chipSisa: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.outlineVariant },
  chipText: { fontSize: 11, fontWeight: '600', color: colors.onSurfaceVariant },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: `${colors.outlineVariant}4D`,
  },
  footerHitung: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant },
  footerNormal: { fontSize: 11, fontWeight: '700', color: colors.primary },
  abnormalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.errorContainer,
    paddingLeft: 6,
    paddingRight: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  abnormalPillText: { fontSize: 11, fontWeight: '700', color: colors.onErrorContainer },
});
