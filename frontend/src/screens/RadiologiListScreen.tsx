import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../api/client';
import { toDateParam } from '../utils/tanggal';
import { fetchRadiologiList } from '../api/radiologi';
import { kodeModalitas } from '../utils/modalitasRadiologi';
import { useAuthStore } from '../store/authStore';
import { colors, radius, shadows, spacing } from '../theme/colors';
import { Text } from '../components/Text';
import { FilterTanggal } from '../components/FilterTanggal';
import type { RadiologiRingkasan } from '../api/types';
import { useHeaderScrollShadow } from '../hooks/useHeaderScrollShadow';
import { useHideTabBar } from '../hooks/useHideTabBar';
import type { PasienStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<PasienStackParamList, 'RadiologiList'>;

function formatTanggal(value: string) {
  return new Date(value).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// Berbeda dari Hasil Lab, daftar ini TIDAK dikelompokkan per tanggal. Satu
// pemeriksaan radiologi = satu laporan naratif yang dibaca utuh; menggabungkan
// dua laporan berbeda ke satu layar cuma memaksa dokter menggulir mencari yang
// dia cari. Yang dikelompokkan di lab itu parameter angka dari satu sampel —
// bukan hal yang sama.
export function RadiologiListScreen({ route, navigation }: Props) {
  const { pasienId, nama } = route.params;
  const token = useAuthStore((s) => s.token);
  const insets = useSafeAreaInsets();
  useHideTabBar();
  const { onScroll, scrollEventThrottle, scrolled } = useHeaderScrollShadow();
  const [items, setItems] = useState<RadiologiRingkasan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dariTanggal, setDariTanggal] = useState<Date | null>(null);
  const [sampaiTanggal, setSampaiTanggal] = useState<Date | null>(null);

  // `isCancelled` dicek lagi setelah tiap `await` supaya respons dari request
  // basi tidak menimpa state dari request yang lebih baru — pola sama dengan
  // HasilLabListScreen.
  const load = useCallback(
    async (isCancelled: () => boolean) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const result = await fetchRadiologiList(token, pasienId, {
          limit: 50,
          dariTanggal: dariTanggal ? toDateParam(dariTanggal) : undefined,
          sampaiTanggal: sampaiTanggal ? toDateParam(sampaiTanggal) : undefined,
        });
        if (isCancelled()) return;
        setItems(result.data);
      } catch (err) {
        if (isCancelled()) return;
        setError(err instanceof ApiError ? err.message : 'Gagal memuat riwayat radiologi');
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
        <Text style={styles.headerEyebrow}>Radiologi</Text>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {nama}
        </Text>
      </View>
      <View style={styles.backButton} />
    </View>
  );

  const filterAktif = dariTanggal !== null || sampaiTanggal !== null;

  const filterBar = (
    <View style={styles.filterBarWrapper}>
      <FilterTanggal
        judul="Filter Tanggal Pemeriksaan"
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
      {items.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <MaterialIcons name="image-search" size={28} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>
            {filterAktif ? 'Tidak ada pemeriksaan di rentang ini' : 'Belum ada pemeriksaan radiologi'}
          </Text>
          <Text style={styles.emptyText}>
            {filterAktif
              ? 'Lebarkan rentang tanggalnya untuk melihat pemeriksaan sebelumnya.'
              : `Laporan rontgen, CT, USG, dan MRI ${nama} akan muncul di sini setelah dibaca dokter radiolog.`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + spacing.gutter }]}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
          ListHeaderComponent={
            <Text style={styles.listIntro}>{items.length} laporan, terbaru di atas</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate('RadiologiDetail', { radiologiId: item.id })}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              {/* Modalitas jadi penanda kiri: dokter mencari "CT-nya yang mana",
                  bukan nama tindakan lengkapnya. */}
              <View style={styles.blokModalitas}>
                <Text style={styles.blokKode}>{kodeModalitas(item.modalitas)}</Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.namaPemeriksaan} numberOfLines={2}>
                  {item.namaPemeriksaan}
                </Text>
                <Text style={styles.metaBaris} numberOfLines={1}>
                  {formatTanggal(item.tanggalPermintaan)}
                  {item.unit ? ` · ${item.unit}` : ''}
                </Text>
                <View style={styles.tandaBaris}>
                  {item.cito && (
                    <View style={styles.citoPill}>
                      <Text style={styles.citoPillText}>CITO</Text>
                    </View>
                  )}
                  {item.adaKesan && (
                    <View style={styles.kesanPill}>
                      <MaterialIcons name="summarize" size={11} color={colors.primary} />
                      <Text style={styles.kesanPillText}>Ada kesan</Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          )}
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
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.onSurface, textAlign: 'center' },
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
  listIntro: { fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant, paddingBottom: 4 },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.backgroundWhite,
    borderRadius: radius.sm,
    padding: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 2,
  },
  cardPressed: { opacity: 0.95, transform: [{ scale: 0.98 }] },
  blokModalitas: {
    minWidth: 48,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
  },
  blokKode: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5, color: colors.primary },
  namaPemeriksaan: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  metaBaris: { fontSize: 12, color: colors.onSurfaceVariant },
  tandaBaris: { flexDirection: 'row', gap: 6, marginTop: 2 },
  citoPill: {
    backgroundColor: colors.errorContainer,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  citoPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, color: colors.onErrorContainer },
  kesanPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: `${colors.primary}1A`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  kesanPillText: { fontSize: 10, fontWeight: '700', color: colors.primary },
});
