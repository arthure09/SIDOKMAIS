import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme/colors';
import { ms } from '../theme/responsive';
import { Text } from '../components/Text';
import { useTabBarClearance } from '../navigation/tabBarMetrics';
import { useTabBarDockOnScroll } from '../hooks/useTabBarDockOnScroll';
import type { NotifikasiStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<NotifikasiStackParamList, 'DetailNotifikasi'>;

export function DetailNotifikasiScreen({ route, navigation }: Props) {
  const { kategori, judul, pesan, waktu, icon, isRead, dokterNama } = route.params;
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { onScroll, scrollEventThrottle } = useTabBarDockOnScroll();
  const isJadwal = kategori === 'Jadwal';

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Detail Notifikasi
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
      >
        <View style={styles.card}>
          <View style={styles.headerTopRow}>
            <View style={[styles.iconCircle, isJadwal && styles.iconCircleJadwal]}>
              <MaterialIcons name={icon as never} size={26} color={colors.primary} />
            </View>
            <View style={styles.kategoriPill}>
              <Text style={styles.kategoriPillText}>{kategori}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          {dokterNama && <Text style={styles.dokterNama}>{dokterNama}</Text>}
          <Text style={styles.judul}>{judul}</Text>
          <Text style={styles.waktu}>{waktu}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.pesanLabel}>Detail Pesan</Text>
          <Text style={styles.pesanText}>{pesan}</Text>
        </View>

        <View style={styles.readStatusPill}>
          <MaterialIcons
            name={isRead ? 'check-circle' : 'radio-button-unchecked'}
            size={20}
            color={colors.onSurfaceVariant}
          />
          <Text style={styles.readStatusText}>{isRead ? 'Sudah Dibaca' : 'Belum Dibaca'}</Text>
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
    gap: ms(12),
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.outlineVariant}1A`,
  },
  backButton: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: ms(18),
    fontWeight: '600',
    color: colors.onBackground,
  },
  content: { padding: spacing.marginMobile, gap: spacing.gutter, paddingBottom: ms(32) },

  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.sm,
    padding: spacing.cardPadding,
    gap: ms(12),
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 2,
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconCircle: {
    width: ms(48),
    height: ms(48),
    borderRadius: ms(12),
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleJadwal: { backgroundColor: colors.errorContainer },
  kategoriPill: {
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: ms(12),
    paddingVertical: ms(4),
    borderRadius: radius.full,
  },
  kategoriPillText: { fontSize: ms(12), fontWeight: '600', color: colors.primary },
  divider: { height: 1, backgroundColor: `${colors.outlineVariant}4D` },
  dokterNama: { fontSize: ms(13), fontWeight: '600', color: colors.primary },
  judul: { fontSize: ms(20), fontWeight: '700', color: colors.onSurface },
  waktu: { fontSize: ms(13), color: colors.outline, marginTop: ms(2) },

  pesanLabel: {
    fontSize: ms(11),
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.outline,
    textTransform: 'uppercase',
  },
  pesanText: { fontSize: ms(15), lineHeight: ms(22), color: colors.onSurface },

  readStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(8),
    backgroundColor: colors.surfaceContainer,
    paddingVertical: ms(16),
    borderRadius: radius.sm,
    marginTop: ms(8),
  },
  readStatusText: { fontSize: ms(16), fontWeight: '700', color: colors.onSurfaceVariant },
});
