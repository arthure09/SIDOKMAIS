import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme/colors';
import { ms } from '../theme/responsive';
import { Text } from '../components/Text';
import { laporanLabDetail } from '../mocks/notifikasiMock';
import { useTabBarClearance } from '../navigation/tabBarMetrics';
import { useTabBarDockOnScroll } from '../hooks/useTabBarDockOnScroll';
import type { NotifikasiStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<NotifikasiStackParamList, 'DetailLaporanLab'>;

export function DetailLaporanLabScreen(_props: Props) {
  const tabBarClearance = useTabBarClearance();
  const { onScroll, scrollEventThrottle } = useTabBarDockOnScroll();
  const [sudahDibaca, setSudahDibaca] = useState(false);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
      >
        <View style={styles.card}>
          <View style={styles.patientTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.patientName}>{laporanLabDetail.pasienNama}</Text>
              <Text style={styles.patientMeta}>{laporanLabDetail.pasienInfo}</Text>
            </View>
            <View style={styles.rawatPill}>
              <Text style={styles.rawatPillText}>Rawat Inap</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.metaGrid}>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>Tanggal Pengambilan</Text>
              <Text style={styles.metaValue}>{laporanLabDetail.tanggalPengambilan}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>Jenis Pemeriksaan</Text>
              <Text style={styles.metaValue}>{laporanLabDetail.jenisPemeriksaan}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.reportHeader}>
            <MaterialIcons name="picture-as-pdf" size={22} color={colors.primary} />
            <Text style={styles.reportHeaderText}>Laporan Medis (PDF)</Text>
          </View>

          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderText, { flex: 2 }]}>Nama Laporan</Text>
            <Text style={[styles.tableHeaderText, { flex: 1 }]}>Tanggal</Text>
            <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>Aksi</Text>
          </View>

          {laporanLabDetail.laporan.map((lab, i) => (
            <View
              key={lab.id}
              style={[
                styles.tableRow,
                i < laporanLabDetail.laporan.length - 1 && styles.tableRowBorder,
              ]}
            >
              <Text style={[styles.tableCellNama, { flex: 2 }]}>{lab.namaLaporan}</Text>
              <Text style={[styles.tableCellTanggal, { flex: 1 }]}>{lab.tanggal}</Text>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <View style={styles.lihatPdfButton}>
                  <MaterialIcons name="visibility" size={14} color={colors.primary} />
                  <Text style={styles.lihatPdfText}>Lihat PDF</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {sudahDibaca ? (
          <View style={styles.validateButtonDone}>
            <MaterialIcons name="check-circle" size={20} color={colors.onSurfaceVariant} />
            <Text style={styles.validateButtonDoneText}>Sudah Dibaca</Text>
          </View>
        ) : (
          <Pressable style={styles.validateButton} onPress={() => setSudahDibaca(true)}>
            <MaterialIcons name="check-circle" size={20} color={colors.onPrimary} />
            <Text style={styles.validateButtonText}>Validasi & Tandai Dibaca</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.marginMobile, gap: spacing.gutter, paddingBottom: ms(32) },

  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.sm,
    padding: spacing.cardPadding,
    gap: ms(16),
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 2,
  },
  patientTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  patientName: { fontSize: ms(20), fontWeight: '700', color: colors.onSurface },
  patientMeta: { fontSize: ms(14), color: colors.onSurfaceVariant, marginTop: ms(4) },
  rawatPill: {
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: ms(12),
    paddingVertical: ms(4),
    borderRadius: radius.full,
  },
  rawatPillText: { fontSize: ms(12), fontWeight: '600', color: colors.primary },
  divider: { height: 1, backgroundColor: `${colors.outlineVariant}4D` },
  metaGrid: { flexDirection: 'row', gap: ms(16) },
  metaLabel: { fontSize: ms(12), fontWeight: '600', color: colors.outline, marginBottom: ms(4) },
  metaValue: { fontSize: ms(14), fontWeight: '600', color: colors.onSurface },

  reportHeader: { flexDirection: 'row', alignItems: 'center', gap: ms(8) },
  reportHeaderText: { fontSize: ms(18), fontWeight: '700', color: colors.primary },

  tableHeaderRow: { flexDirection: 'row', paddingBottom: ms(12), borderBottomWidth: 1, borderBottomColor: `${colors.outlineVariant}4D` },
  tableHeaderText: {
    fontSize: ms(11),
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.outline,
    textTransform: 'uppercase',
  },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: ms(16) },
  tableRowBorder: { borderBottomWidth: 1, borderBottomColor: `${colors.outlineVariant}33` },
  tableCellNama: { fontSize: ms(14), fontWeight: '600', color: colors.onSurface },
  tableCellTanggal: { fontSize: ms(14), color: colors.onSurfaceVariant },
  lihatPdfButton: { flexDirection: 'row', alignItems: 'center', gap: ms(4) },
  lihatPdfText: { fontSize: ms(12), fontWeight: '600', color: colors.primary },

  validateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(8),
    backgroundColor: colors.primary,
    paddingVertical: ms(16),
    borderRadius: radius.sm,
    marginTop: ms(8),
  },
  validateButtonText: { fontSize: ms(16), fontWeight: '700', color: colors.onPrimary },
  validateButtonDone: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(8),
    backgroundColor: colors.surfaceContainer,
    paddingVertical: ms(16),
    borderRadius: radius.sm,
    marginTop: ms(8),
  },
  validateButtonDoneText: { fontSize: ms(16), fontWeight: '700', color: colors.onSurfaceVariant },
});
