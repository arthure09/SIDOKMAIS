import { useCallback, useEffect, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { ActivityIndicator, Animated, FlatList, Pressable, StyleSheet, View } from 'react-native';
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
import type { AssignmentStatus, PasienListItem } from '../api/types';
import { useTabBarClearance } from '../navigation/tabBarMetrics';
import { useTabBarDockOnScroll } from '../hooks/useTabBarDockOnScroll';
import { useScrollToTopButton } from '../hooks/useScrollToTopButton';
import { useAnimatedHeaderFade } from '../hooks/useAnimatedHeaderFade';
import type { PasienStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<PasienStackParamList, 'PasienList'>;

const STATUS_FILTERS: { label: string; value: AssignmentStatus | undefined }[] = [
  { label: 'Semua', value: undefined },
  { label: 'Aktif', value: 'ACTIVE' },
  { label: 'Selesai', value: 'COMPLETED' },
];

const STATUS_BADGE: Record<AssignmentStatus, { label: string; bg: string; fg: string }> = {
  ACTIVE: { label: 'AKTIF', bg: colors.primary, fg: colors.onPrimary },
  COMPLETED: { label: 'SELESAI', bg: colors.tertiaryFixed, fg: colors.onTertiaryFixed },
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

export function PasienListScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { onScroll: onDockScroll, scrollEventThrottle, scrolled } = useTabBarDockOnScroll();
  const { onScroll: onTopButtonScroll, visible: showScrollTop } = useScrollToTopButton();
  const { headerBackgroundColor, headerShadowOpacity, headerElevation } = useAnimatedHeaderFade(scrolled);
  const listRef = useRef<FlatList<PasienListItem>>(null);
  const token = useAuthStore((s) => s.token);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AssignmentStatus | undefined>(undefined);
  const [items, setItems] = useState<PasienListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      onDockScroll(e);
      onTopButtonScroll(e);
    },
    [onDockScroll, onTopButtonScroll],
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPasienList(token, { search, status, page: 1, limit: 50 });
      setItems(result.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data pasien');
    } finally {
      setLoading(false);
    }
  }, [token, search, status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          { paddingTop: insets.top, backgroundColor: headerBackgroundColor },
          {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowRadius: 8,
            shadowOpacity: headerShadowOpacity,
            elevation: headerElevation,
          },
        ]}
      >
        <View style={[styles.searchWrapper, { marginTop: spacing.base }]}>
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

        <View style={styles.filterRow}>
          {STATUS_FILTERS.map((f) => {
            const active = status === f.value;
            return (
              <Pressable
                key={f.label}
                onPress={() => setStatus(f.value)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
          ref={listRef}
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: tabBarClearance }]}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={scrollEventThrottle}
          renderItem={({ item }) => {
            const badge = STATUS_BADGE[item.status];
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
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: badge.fg }]}>
                      {badge.label}
                    </Text>
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

  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: spacing.marginMobile,
    marginTop: spacing.base,
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
    marginTop: 12,
    marginBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.surfaceVariant,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurface,
  },
  filterChipTextActive: {
    color: colors.onPrimary,
  },

  listContent: {
    padding: spacing.marginMobile,
    gap: spacing.gutter,
  },
  card: {
    backgroundColor: colors.backgroundWhite,
    borderRadius: 24,
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
