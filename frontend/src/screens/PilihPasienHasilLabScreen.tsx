import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, Pressable, StyleSheet, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../api/client';
import { fetchPasienList } from '../api/pasien';
import { useAuthStore } from '../store/authStore';
import { colors, radius, shadows, spacing } from '../theme/colors';
import { Text } from '../components/Text';
import { TextInput } from '../components/TextInput';
import type { PasienListItem } from '../api/types';
import { useHeaderScrollShadow } from '../hooks/useHeaderScrollShadow';
import { useHideTabBar } from '../hooks/useHideTabBar';
import { useCollapseOnScroll } from '../hooks/useCollapseOnScroll';
import type { HomeStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'PilihPasienHasilLab'>;

function initials(nama: string) {
  const parts = nama.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

// Satu layar pilih-pasien untuk dua tujuan (Hasil Lab & Radiologi). Bedanya
// cuma judul dan layar berikutnya, jadi menduplikasi seluruh layar cuma untuk
// mengganti satu string tidak sepadan.
export function PilihPasienHasilLabScreen({ route, navigation }: Props) {
  const tujuan = route.params?.tujuan ?? 'lab';
  const keRadiologi = tujuan === 'radiologi';
  const insets = useSafeAreaInsets();
  useHideTabBar();
  const { onScroll: onShadowScroll, scrollEventThrottle, scrolled } = useHeaderScrollShadow();
  // Cuma satu baris (search bar, tanpa filter di bawahnya), jadi dipetakan ke
  // `bottom` yang sembunyi di langkah pertama — `top` tidak dirender sama
  // sekali, jadi langkah keduanya tidak pernah kelihatan.
  const { onScroll: onCollapseScroll, bottom: searchRow } = useCollapseOnScroll();
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      onShadowScroll(e);
      onCollapseScroll(e);
    },
    [onShadowScroll, onCollapseScroll],
  );
  const token = useAuthStore((s) => s.token);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<PasienListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPasienList(token, { search, page: 1, limit: 50 });
      setItems(result.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data pasien');
    } finally {
      setLoading(false);
    }
  }, [token, search]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }, scrolled && shadows.header]}>
        <Pressable onPress={navigation.goBack} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {keRadiologi ? 'Cek Hasil Radiologi' : 'Cari Hasil Lab'}
        </Text>
        <View style={styles.backButton} />
      </View>

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
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + spacing.gutter }]}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                navigation.navigate(keRadiologi ? 'RadiologiList' : 'HasilLabList', {
                  pasienId: item.id,
                  nama: item.nama,
                })
              }
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(item.nama)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.nama}
                </Text>
                <Text style={styles.cardRm}>RM: {item.norm}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: colors.error, textAlign: 'center' },
  emptyText: { color: colors.onSurfaceVariant, textAlign: 'center' },

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
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '600', color: colors.onBackground, textAlign: 'center' },

  // Jarak atas padding di kotak yang menyusut (searchSlot), bukan margin di
  // search bar-nya: margin tidak ikut terhitung di tinggi yang diukur
  // useCollapseOnScroll, jadi kalau pakai margin barisnya menyisakan celah
  // kosong waktu sudah tersembunyi.
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
  searchInput: { flex: 1, fontSize: 14, color: colors.onSurface, paddingVertical: 0 },

  listContent: { padding: spacing.marginMobile, gap: spacing.gutter },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    backgroundColor: colors.backgroundWhite,
    borderRadius: radius.sm,
    padding: spacing.cardPadding,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 2,
  },
  cardPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primary, fontSize: 18, fontWeight: '700' },
  cardName: { fontSize: 16, fontWeight: '700', color: colors.onBackground },
  cardRm: { fontSize: 12, color: colors.outline, marginTop: 2 },
});
