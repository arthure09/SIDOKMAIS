import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme/colors';
import { ms } from '../theme/responsive';
import { Text } from '../components/Text';
import { notifikasiList, type NotifikasiKategori } from '../mocks/notifikasiMock';
import { useTabBarClearance } from '../navigation/tabBarMetrics';
import { useTabBarDockOnScroll } from '../hooks/useTabBarDockOnScroll';
import type { NotifikasiStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<NotifikasiStackParamList, 'NotifikasiList'>;

const FILTERS: { label: string; value: NotifikasiKategori | 'Semua' }[] = [
  { label: 'Semua', value: 'Semua' },
  { label: 'Hasil Lab', value: 'Lab' },
  { label: 'Jadwal', value: 'Jadwal' },
  { label: 'Sistem', value: 'Sistem' },
];

export function NotifikasiScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { onScroll, scrollEventThrottle } = useTabBarDockOnScroll();
  const [filter, setFilter] = useState<NotifikasiKategori | 'Semua'>('Semua');
  const items = notifikasiList.filter((n) => filter === 'Semua' || n.kategori === filter);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + ms(6) }]}>
        <View>
          <Text style={styles.title}>Notifikasi</Text>
          <Text style={styles.subtitle}>Pembaruan klinis dan jadwal Anda.</Text>
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <Pressable
                key={f.value}
                onPress={() => setFilter(f.value)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
      >
        <View style={{ gap: spacing.gutter }}>
          {items.map((item) => (
            <Pressable
              key={item.id}
              disabled={!item.bukaLaporanLab}
              onPress={() => item.bukaLaporanLab && navigation.navigate('DetailLaporanLab')}
              style={({ pressed }) => [
                styles.card,
                !item.isRead && styles.cardUnread,
                item.isRead && styles.cardRead,
                pressed && styles.cardPressed,
              ]}
            >
              {!item.isRead && <View style={styles.unreadDot} />}
              <View
                style={[
                  styles.iconCircle,
                  item.isRead && styles.iconCircleRead,
                  item.kategori === 'Jadwal' && !item.isRead && styles.iconCircleJadwal,
                ]}
              >
                <MaterialIcons
                  name={item.icon as never}
                  size={22}
                  color={item.isRead ? colors.outline : colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardTopRow}>
                  <View style={styles.kategoriPill}>
                    <Text style={styles.kategoriPillText}>{item.kategori}</Text>
                  </View>
                  <Text style={styles.waktuText}>{item.waktu}</Text>
                </View>
                <Text style={styles.judul} numberOfLines={2}>
                  {item.judul}
                </Text>
                <Text style={styles.pesan} numberOfLines={2}>
                  {item.pesan}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: ms(10),
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.outlineVariant}1A`,
  },
  content: { padding: spacing.marginMobile, gap: spacing.gutter, paddingBottom: ms(32) },
  title: { fontSize: ms(20), fontWeight: '800', color: colors.onBackground },
  subtitle: { fontSize: ms(12), color: colors.outline, marginTop: ms(2) },

  filterRow: { flexDirection: 'row', gap: ms(8), flexWrap: 'wrap', marginTop: ms(10) },
  filterChip: {
    paddingHorizontal: ms(14),
    paddingVertical: ms(6),
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}80`,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: ms(12), fontWeight: '600', color: colors.primary },
  filterChipTextActive: { color: colors.onPrimary },

  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: ms(24),
    padding: ms(20),
    flexDirection: 'row',
    gap: ms(16),
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: colors.surfaceVariant,
  },
  cardUnread: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  cardRead: { opacity: 0.75 },
  cardPressed: { opacity: 0.9 },
  unreadDot: {
    position: 'absolute',
    top: ms(22),
    left: ms(10),
    width: ms(10),
    height: ms(10),
    borderRadius: ms(5),
    backgroundColor: colors.tertiaryFixedDim,
  },
  iconCircle: {
    width: ms(48),
    height: ms(48),
    borderRadius: ms(12),
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: ms(8),
  },
  iconCircleRead: { backgroundColor: colors.surfaceVariant },
  iconCircleJadwal: { backgroundColor: colors.errorContainer },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: ms(4),
  },
  kategoriPill: {
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: ms(8),
    paddingVertical: ms(2),
    borderRadius: ms(6),
  },
  kategoriPillText: { fontSize: ms(10), fontWeight: '700', color: colors.primary },
  waktuText: { fontSize: ms(11), color: colors.outline },
  judul: { fontSize: ms(16), fontWeight: '700', color: colors.onBackground, marginBottom: ms(4) },
  pesan: { fontSize: ms(13), color: colors.onSurfaceVariant },
});
