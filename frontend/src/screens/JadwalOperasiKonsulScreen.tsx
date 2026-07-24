import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme/colors';
import { ms, wp } from '../theme/responsive';
import { Text } from '../components/Text';
import { operasiJadwalList, type OperasiStatusMock } from '../mocks/operasiMock';
import { useTabBarClearance } from '../navigation/tabBarMetrics';
import { useTabBarDockOnScroll } from '../hooks/useTabBarDockOnScroll';
import type { OperasiStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<OperasiStackParamList, 'JadwalOperasiKonsul'>;

function formatHariIni() {
  return new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const STATUS_META: Record<
  OperasiStatusMock,
  { label: string; icon: string; bg: string; fg: string }
> = {
  IN_PROGRESS: { label: 'In-Progress', icon: 'sync', bg: '#a3a900', fg: '#393b00' },
  SCHEDULED: { label: 'Scheduled', icon: 'schedule', bg: colors.primaryContainer, fg: colors.onPrimaryContainer },
  COMPLETED: { label: 'Completed', icon: 'check-circle', bg: '#0D3D3B', fg: colors.onPrimary },
  CANCELLED: { label: 'Cancelled', icon: 'cancel', bg: colors.outlineVariant, fg: colors.onSurfaceVariant },
};

export function JadwalOperasiKonsulScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { onScroll, scrollEventThrottle } = useTabBarDockOnScroll();
  const [tab, setTab] = useState<'OPERASI' | 'KONSUL'>('OPERASI');

  function handleCardPress(item: (typeof operasiJadwalList)[number]) {
    if (item.status === 'CANCELLED') return;
    navigation.navigate('DetailJadwalOperasi', { operasiId: item.id });
  }

  return (
    <View style={styles.container}>
      <View style={[styles.headerArea, { paddingTop: insets.top + ms(spacing.marginMobile) }]}>
        <Text style={styles.title}>Jadwal Operasi</Text>
        <View style={styles.toggle}>
          <Pressable
            onPress={() => setTab('OPERASI')}
            style={[styles.toggleButton, tab === 'OPERASI' && styles.toggleButtonActive]}
          >
            <Text
              style={[styles.toggleText, tab === 'OPERASI' && styles.toggleTextActive]}
            >
              Operasi
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('KONSUL')}
            style={[styles.toggleButton, tab === 'KONSUL' && styles.toggleButtonActive]}
          >
            <Text style={[styles.toggleText, tab === 'KONSUL' && styles.toggleTextActive]}>
              Konsul
            </Text>
          </Pressable>
        </View>
        <View style={styles.dateFilter}>
          <MaterialIcons name="calendar-month" size={20} color={colors.primary} />
          <Text style={styles.dateFilterText}>Hari Ini, {formatHariIni()}</Text>
        </View>
      </View>

      {tab === 'KONSUL' ? (
        <View style={styles.center}>
          <MaterialIcons name="chat-bubble" size={40} color={colors.outlineVariant} />
          <Text style={styles.comingSoonTitle}>Jadwal Konsul segera hadir</Text>
          <Text style={styles.comingSoonDesc}>
            Entity Konsultasi masih menunggu keputusan ERD dari supervisor.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.listContent, { paddingBottom: tabBarClearance }]}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
        >
          {operasiJadwalList.map((item) => {
            const meta = STATUS_META[item.status];
            const cancelled = item.status === 'CANCELLED';
            return (
              <Pressable
                key={item.id}
                disabled={cancelled}
                onPress={() => handleCardPress(item)}
                style={({ pressed }) => [
                  styles.card,
                  cancelled && styles.cardCancelled,
                  pressed && styles.cardPressed,
                ]}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTime}>
                      {item.waktuMulai} - {item.waktuSelesai}
                    </Text>
                    <Text style={[styles.cardPatient, cancelled && styles.cardPatientCancelled]}>
                      {item.pasienNama}
                    </Text>
                    <Text style={styles.cardTindakan}>{item.tindakan}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                    <MaterialIcons name={meta.icon as never} size={14} color={meta.fg} />
                    <Text style={[styles.statusPillText, { color: meta.fg }]}>{meta.label}</Text>
                  </View>
                </View>
                {!cancelled && (
                  <>
                    <View style={styles.cardDivider} />
                    <View style={styles.cardBottom}>
                      {item.ruangan && (
                        <View style={styles.cardBottomItem}>
                          <MaterialIcons name="meeting-room" size={18} color={colors.primary} />
                          <Text style={styles.cardBottomText}>{item.ruangan}</Text>
                        </View>
                      )}
                      {item.dokterUtama && (
                        <View style={styles.cardBottomItem}>
                          <MaterialIcons name="person" size={18} color={colors.primary} />
                          <Text style={styles.cardBottomText}>{item.dokterUtama}</Text>
                        </View>
                      )}
                    </View>
                  </>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerArea: { padding: spacing.marginMobile, paddingBottom: ms(8), gap: ms(16) },
  title: { fontSize: ms(20), fontWeight: '700', color: colors.onSurface },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceVariant,
    borderRadius: radius.full,
    padding: ms(4),
    alignSelf: 'center',
    width: '100%',
    maxWidth: wp(85),
  },
  toggleButton: { flex: 1, paddingVertical: ms(10), borderRadius: radius.full, alignItems: 'center' },
  toggleButtonActive: { backgroundColor: colors.primary },
  toggleText: { fontSize: ms(12), fontWeight: '600', color: colors.onSurfaceVariant },
  toggleTextActive: { color: colors.onPrimary },
  dateFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(10),
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.full,
    paddingHorizontal: ms(16),
    paddingVertical: ms(12),
  },
  dateFilterText: { fontSize: ms(16), color: colors.onSurface },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: ms(8), padding: ms(32) },
  comingSoonTitle: { fontSize: ms(16), fontWeight: '700', color: colors.onSurfaceVariant },
  comingSoonDesc: { fontSize: ms(13), color: colors.outline, textAlign: 'center' },

  listContent: { padding: spacing.marginMobile, paddingTop: ms(8), gap: spacing.gutter },
  card: {
    backgroundColor: colors.backgroundWhite,
    borderRadius: ms(24),
    padding: spacing.cardPadding,
    gap: ms(16),
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  cardCancelled: { backgroundColor: colors.surfaceVariant, opacity: 0.7, elevation: 0 },
  cardPressed: { opacity: 0.92 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTime: { fontSize: ms(12), fontWeight: '600', color: colors.outline },
  cardPatient: { fontSize: ms(20), fontWeight: '700', color: colors.onSurface, marginTop: ms(4) },
  cardPatientCancelled: { textDecorationLine: 'line-through', color: colors.outline },
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
  cardDivider: { height: 1, backgroundColor: colors.surfaceVariant },
  cardBottom: { flexDirection: 'row', gap: ms(24) },
  cardBottomItem: { flexDirection: 'row', alignItems: 'center', gap: ms(8) },
  cardBottomText: { fontSize: ms(14), color: colors.onSurfaceVariant },
});
