import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme/colors';
import { ms } from '../theme/responsive';
import { Text } from '../components/Text';
import { catatanPraOpDefault, operasiJadwalList, timMedisDefault } from '../mocks/operasiMock';
import { useTabBarClearance } from '../navigation/tabBarMetrics';
import type { OperasiStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<OperasiStackParamList, 'DetailJadwalOperasi'>;

const STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: 'Berlangsung',
  SCHEDULED: 'Terjadwal',
  COMPLETED: 'Selesai',
};

export function DetailJadwalOperasiScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const item = operasiJadwalList.find((o) => o.id === route.params.operasiId);

  if (!item) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Data jadwal tidak ditemukan.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {item.tindakan}
        </Text>
        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusPillText}>{STATUS_LABEL[item.status] ?? item.status}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.patientRow}>
            <View style={styles.patientAvatar}>
              <MaterialIcons name="person" size={28} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.patientName}>{item.pasienNama}</Text>
              <View style={styles.patientMetaRow}>
                <Text style={styles.patientMetaText}>RM: {item.pasienRm}</Text>
                <Text style={styles.patientMetaText}>{item.pasienUmur} Tahun</Text>
                <Text style={styles.patientMetaText}>{item.pasienJenisKelamin}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Informasi Jadwal</Text>
          <InfoRow icon="medical-services" label="Tindakan" value={item.tindakan} />
          <View style={styles.infoDivider} />
          <InfoRow
            icon="event"
            label="Waktu"
            value={item.tanggal}
            secondary={`${item.waktuMulai} - ${item.waktuSelesai} WIB`}
          />
          {item.ruangan && (
            <>
              <View style={styles.infoDivider} />
              <InfoRow icon="location-on" label="Lokasi" value={item.ruangan} />
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Tim Medis</Text>
          <View style={{ gap: 8 }}>
            {timMedisDefault.map((tm) => (
              <View key={tm.nama} style={styles.timRow}>
                <View style={styles.timAvatar}>
                  <Text style={styles.timAvatarText}>
                    {tm.nama
                      .replace(/^dr\.\s*/i, '')
                      .slice(0, 2)
                      .toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.timNama}>{tm.nama}</Text>
                  <Text style={styles.timPeran}>{tm.peran}</Text>
                </View>
                {tm.andaSendiri && (
                  <View style={styles.andaPill}>
                    <Text style={styles.andaPillText}>Anda</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.notesCard}>
          <View style={styles.notesHeader}>
            <MaterialIcons name="info" size={18} color="#5f6200" />
            <Text style={styles.notesTitle}>Catatan Pra-Operasi</Text>
          </View>
          {catatanPraOpDefault.map((note) => (
            <View key={note} style={styles.notesItem}>
              <Text style={styles.notesBullet}>{'•'}</Text>
              <Text style={styles.notesText}>{note}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  secondary,
}: {
  icon: string;
  label: string;
  value: string;
  secondary?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconCircle}>
        <MaterialIcons name={icon as never} size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
        {secondary && <Text style={styles.infoSecondary}>{secondary}</Text>}
      </View>
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
  content: { padding: spacing.marginMobile, gap: spacing.gutter },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: ms(24) },
  errorText: { color: colors.error },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    backgroundColor: `${colors.primary}1A`,
    borderWidth: 1,
    borderColor: `${colors.primary}33`,
    paddingHorizontal: ms(14),
    paddingVertical: ms(8),
    borderRadius: radius.full,
  },
  statusDot: { width: ms(6), height: ms(6), borderRadius: ms(3), backgroundColor: colors.primary },
  statusPillText: {
    fontSize: ms(12),
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.primary,
    textTransform: 'uppercase',
  },

  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.sm,
    padding: spacing.cardPadding,
    gap: ms(16),
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 2,
  },
  cardLabel: {
    fontSize: ms(12),
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.outline,
    textTransform: 'uppercase',
  },

  patientRow: { flexDirection: 'row', alignItems: 'center', gap: ms(16) },
  patientAvatar: {
    width: ms(56),
    height: ms(56),
    borderRadius: ms(28),
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientName: { fontSize: ms(18), fontWeight: '700', color: colors.onSurface, marginBottom: ms(6) },
  patientMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(12) },
  patientMetaText: { fontSize: ms(13), color: colors.onSurfaceVariant },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: ms(16) },
  infoIconCircle: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { fontSize: ms(13), color: colors.onSurfaceVariant, marginBottom: ms(2) },
  infoValue: { fontSize: ms(16), fontWeight: '700', color: colors.onSurface },
  infoSecondary: { fontSize: ms(13), fontWeight: '600', color: colors.primary, marginTop: ms(2) },
  infoDivider: { height: 1, backgroundColor: `${colors.outlineVariant}4D` },

  timRow: { flexDirection: 'row', alignItems: 'center', gap: ms(12), paddingVertical: ms(6) },
  timAvatar: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timAvatarText: { fontSize: ms(12), fontWeight: '700', color: colors.onPrimary },
  timNama: { fontSize: ms(14), fontWeight: '600', color: colors.onSurface },
  timPeran: { fontSize: ms(12), color: colors.onSurfaceVariant },
  andaPill: {
    backgroundColor: `${colors.primaryContainer}4D`,
    paddingHorizontal: ms(8),
    paddingVertical: ms(4),
    borderRadius: ms(4),
  },
  andaPillText: { fontSize: ms(11), fontWeight: '700', color: colors.primary },

  notesCard: {
    backgroundColor: '#F5F6D9',
    borderRadius: radius.sm,
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: '#e4eb4180',
    gap: ms(10),
  },
  notesHeader: { flexDirection: 'row', alignItems: 'center', gap: ms(8) },
  notesTitle: {
    fontSize: ms(12),
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#5f6200',
    textTransform: 'uppercase',
  },
  notesItem: { flexDirection: 'row', gap: ms(8), paddingLeft: ms(4) },
  notesBullet: { fontSize: ms(13), color: colors.onSurfaceVariant },
  notesText: { flex: 1, fontSize: ms(13), color: colors.onSurfaceVariant },
});
