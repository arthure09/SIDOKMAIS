import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme/colors';
import { ms } from '../theme/responsive';
import { Text } from '../components/Text';
import { operasiJadwalList } from '../mocks/operasiMock';
import { useTabBarClearance } from '../navigation/tabBarMetrics';
import { useTabBarDockOnScroll } from '../hooks/useTabBarDockOnScroll';
import type { OperasiStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<OperasiStackParamList, 'DetailPembatalanOperasi'>;

export function DetailPembatalanOperasiScreen({ route }: Props) {
  const tabBarClearance = useTabBarClearance();
  const { onScroll, scrollEventThrottle } = useTabBarDockOnScroll();
  const item = operasiJadwalList.find((o) => o.id === route.params.operasiId);

  if (!item || !item.pembatalan) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Data pembatalan tidak ditemukan.</Text>
      </View>
    );
  }

  const { pembatalan } = item;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
      >
        <View style={styles.card}>
          <View style={styles.patientRow}>
            <View style={styles.patientAvatar}>
              <MaterialIcons name="person" size={28} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.patientName}>{item.pasienNama}</Text>
              <Text style={styles.patientMeta}>
                {item.pasienJenisKelamin}, {item.pasienUmur} Tahun • RM: {item.pasienRm}
              </Text>
            </View>
          </View>

          <View style={styles.cancelledPill}>
            <MaterialIcons name="cancel" size={16} color={colors.onErrorContainer} />
            <Text style={styles.cancelledPillText}>Operasi Dibatalkan</Text>
          </View>

          <View style={styles.divider} />

          <InfoRow icon="event" label="Tanggal & Waktu Jadwal" value={`${item.tanggal}, ${item.waktuMulai} WIB`} />
          <InfoRow icon="medical-services" label="Jenis Tindakan" value={item.tindakan} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderError}>
            <MaterialIcons name="info" size={18} color={colors.error} />
            <Text style={styles.cardHeaderErrorText}>Informasi Pembatalan</Text>
          </View>

          <View>
            <Text style={styles.label}>Alasan Pembatalan</Text>
            <Text style={styles.alasanText}>{pembatalan.alasan}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.twoColRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Dibatalkan Oleh</Text>
              <View style={styles.iconValueRow}>
                <MaterialIcons name="badge" size={16} color={colors.outline} />
                <Text style={styles.iconValueText}>{pembatalan.dibatalkanOleh}</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Waktu Pembatalan</Text>
              <View style={styles.iconValueRow}>
                <MaterialIcons name="schedule" size={16} color={colors.outline} />
                <Text style={styles.iconValueText}>{pembatalan.waktuPembatalan}</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.followUpBox}>
            <MaterialIcons name="description" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.followUpLabel}>Instruksi Tindak Lanjut</Text>
              <Text style={styles.followUpText}>{pembatalan.instruksiTindakLanjut}</Text>
            </View>
          </View>
        </View>

        <View style={{ gap: 12 }}>
          <View style={styles.primaryAction}>
            <MaterialIcons name="calendar-month" size={20} color={colors.onPrimary} />
            <Text style={styles.primaryActionText}>Jadwalkan Ulang Operasi</Text>
          </View>
          <View style={styles.secondaryAction}>
            <MaterialIcons name="call" size={20} color={colors.onPrimaryContainer} />
            <Text style={styles.secondaryActionText}>Hubungi Keluarga Pasien</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <MaterialIcons name={icon as never} size={20} color={colors.primary} />
      <View>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.marginMobile, gap: spacing.gutter, paddingBottom: ms(32) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: ms(24) },
  errorText: { color: colors.error },

  card: {
    backgroundColor: colors.backgroundWhite,
    borderRadius: radius.sm,
    padding: spacing.cardPadding,
    gap: ms(16),
    borderWidth: 1,
    borderColor: colors.surfaceContainerHigh,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 1,
  },
  patientRow: { flexDirection: 'row', alignItems: 'center', gap: ms(16) },
  patientAvatar: {
    width: ms(56),
    height: ms(56),
    borderRadius: ms(28),
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceVariant,
  },
  patientName: { fontSize: ms(18), fontWeight: '700', color: colors.onSurface },
  patientMeta: { fontSize: ms(13), color: colors.onSurfaceVariant, marginTop: ms(4) },

  cancelledPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(6),
    backgroundColor: colors.errorContainer,
    paddingHorizontal: ms(12),
    paddingVertical: ms(6),
    borderRadius: radius.full,
  },
  cancelledPillText: {
    fontSize: ms(11),
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.onErrorContainer,
    textTransform: 'uppercase',
  },

  divider: { height: 1, backgroundColor: colors.surfaceVariant },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: ms(10) },
  label: {
    fontSize: ms(11),
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    marginBottom: ms(4),
  },
  infoValue: { fontSize: ms(14), color: colors.onSurface },

  cardHeaderError: { flexDirection: 'row', alignItems: 'center', gap: ms(8) },
  cardHeaderErrorText: { fontSize: ms(16), fontWeight: '700', color: colors.onSurface },

  alasanText: { fontSize: ms(16), fontWeight: '600', color: colors.error },

  twoColRow: { flexDirection: 'row', gap: ms(16) },
  iconValueRow: { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
  iconValueText: { fontSize: ms(14), color: colors.onSurface, flexShrink: 1 },

  followUpBox: {
    flexDirection: 'row',
    gap: ms(12),
    backgroundColor: colors.surfaceSoft,
    borderRadius: ms(12),
    padding: ms(16),
    borderWidth: 1,
    borderColor: `${colors.primaryContainer}4D`,
  },
  followUpLabel: {
    fontSize: ms(11),
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.primary,
    textTransform: 'uppercase',
    marginBottom: ms(4),
  },
  followUpText: { fontSize: ms(14), color: colors.onSurface },

  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(8),
    backgroundColor: colors.primary,
    paddingVertical: ms(16),
    borderRadius: ms(12),
  },
  primaryActionText: { fontSize: ms(12), fontWeight: '600', color: colors.onPrimary },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(8),
    backgroundColor: colors.surfaceContainer,
    paddingVertical: ms(16),
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: `${colors.primaryContainer}33`,
  },
  secondaryActionText: { fontSize: ms(12), fontWeight: '600', color: colors.onPrimaryContainer },
});
