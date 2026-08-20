import { useCallback, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors, radius, spacing } from '../theme/colors';
import { ms } from '../theme/responsive';
import { Text } from './Text';

// Filter rentang tanggal (chip + modal dua date picker), dipakai HasilLabList
// dan JadwalOperasiKonsul. Diangkat ke sini waktu layar kedua membutuhkannya —
// menyalinnya berarti menggandakan juga perbaikan-perbaikan yang mahal di
// bawah (fallbackDate, pickerFullBleed, pola draft/terapkan), dan salinan
// seperti itu selalu berhenti diperbaiki di satu sisi saja.
//
// Komponen ini memegang SELURUH state sementara (modal terbuka, draft, picker
// mana yang tampil). Pemanggil cuma memegang nilai yang sudah diterapkan,
// karena itu yang memicu fetch ulang.

function formatShortDate(date: Date) {
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function labelRentang(dari: Date | null, sampai: Date | null, labelKosong: string) {
  if (dari && sampai) return `${formatShortDate(dari)} - ${formatShortDate(sampai)}`;
  if (dari) return `Sejak ${formatShortDate(dari)}`;
  if (sampai) return `Sampai ${formatShortDate(sampai)}`;
  return labelKosong;
}

type Props = {
  /** Judul di dalam modal, mis. "Filter Tanggal Permintaan". */
  judul: string;
  dari: Date | null;
  sampai: Date | null;
  /**
   * Tulisan di chip saat belum ada rentang dipilih. Bukan sekadar hiasan:
   * layar yang punya cakupan bawaan sendiri (mis. "hari ini") memakai ini
   * untuk menyatakan cakupan itu, sehingga chip-nya jadi SATU-SATUNYA tempat
   * cakupan tanggal diumumkan — tidak perlu baris keterangan terpisah.
   */
  labelKosong?: string;
  /** Dipanggil hanya saat "Terapkan" ditekan atau chip di-reset. */
  onChange: (dari: Date | null, sampai: Date | null) => void;
};

export function FilterTanggal({ judul, dari, sampai, onChange, labelKosong = 'Semua Tanggal' }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [draftDari, setDraftDari] = useState<Date | null>(null);
  const [draftSampai, setDraftSampai] = useState<Date | null>(null);
  const [showDariPicker, setShowDariPicker] = useState(false);
  const [showSampaiPicker, setShowSampaiPicker] = useState(false);
  // Instance stabil buat fallback value picker — bukan `new Date()` inline, yang
  // bikin timestamp baru tiap render dan memicu re-layout native tanpa henti
  // (crash iOS) / dialog Android menumpuk selama tanggal belum dipilih.
  const [fallbackDate] = useState(() => new Date());

  const filterAktif = dari !== null || sampai !== null;
  const draftInvalid = Boolean(draftDari && draftSampai && draftDari > draftSampai);

  function openModal() {
    setDraftDari(dari);
    setDraftSampai(sampai);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setShowDariPicker(false);
    setShowSampaiPicker(false);
  }

  function terapkan() {
    if (draftInvalid) return;
    onChange(draftDari, draftSampai);
    closeModal();
  }

  // Tombol Reset di dalam modal hanya membersihkan draft, jangan sentuh filter
  // yang sudah diterapkan — memanggil onChange dari sini akan memicu fetch
  // ulang selagi modal masih terbuka, menembus pola draft/terapkan.
  function resetDraft() {
    setDraftDari(null);
    setDraftSampai(null);
    setShowDariPicker(false);
    setShowSampaiPicker(false);
  }

  const onChangeDari = useCallback((event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') setShowDariPicker(false);
    if (event.type === 'dismissed') return;
    if (selectedDate) setDraftDari(selectedDate);
  }, []);

  const onChangeSampai = useCallback((event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') setShowSampaiPicker(false);
    if (event.type === 'dismissed') return;
    if (selectedDate) setDraftSampai(selectedDate);
  }, []);

  return (
    <>
      <View style={styles.dateFilter}>
        <Pressable onPress={openModal} style={styles.dateFilterMain} hitSlop={4}>
          <MaterialIcons name="calendar-month" size={18} color={colors.primary} />
          <Text style={styles.dateFilterText} numberOfLines={1}>
            {labelRentang(dari, sampai, labelKosong)}
          </Text>
        </Pressable>
        {filterAktif && (
          <Pressable onPress={() => onChange(null, null)} hitSlop={8}>
            <MaterialIcons name="close" size={16} color={colors.onSurfaceVariant} />
          </Pressable>
        )}
      </View>

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={closeModal}>
        <Pressable style={styles.filterBackdrop} onPress={closeModal} />
        <View style={styles.filterModalWrapper} pointerEvents="box-none">
          <View style={styles.filterCard}>
            <Text style={styles.filterCardTitle}>{judul}</Text>

            <View>
              <Pressable
                style={styles.filterField}
                onPress={() => {
                  setShowDariPicker((v) => !v);
                  setShowSampaiPicker(false);
                }}
              >
                <Text style={styles.filterFieldLabel}>Dari</Text>
                <Text style={styles.filterFieldValue}>
                  {draftDari ? formatShortDate(draftDari) : 'Pilih tanggal'}
                </Text>
              </Pressable>
              {showDariPicker && (
                <View style={styles.pickerFullBleed}>
                  <DateTimePicker
                    value={draftDari ?? draftSampai ?? fallbackDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    themeVariant="light"
                    textColor={colors.onSurface}
                    accentColor={colors.primary}
                    maximumDate={draftSampai ?? undefined}
                    onChange={onChangeDari}
                  />
                </View>
              )}
            </View>

            <View>
              <Pressable
                style={styles.filterField}
                onPress={() => {
                  setShowSampaiPicker((v) => !v);
                  setShowDariPicker(false);
                }}
              >
                <Text style={styles.filterFieldLabel}>Sampai</Text>
                <Text style={styles.filterFieldValue}>
                  {draftSampai ? formatShortDate(draftSampai) : 'Pilih tanggal'}
                </Text>
              </Pressable>
              {showSampaiPicker && (
                <View style={styles.pickerFullBleed}>
                  <DateTimePicker
                    value={draftSampai ?? draftDari ?? fallbackDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    themeVariant="light"
                    textColor={colors.onSurface}
                    accentColor={colors.primary}
                    minimumDate={draftDari ?? undefined}
                    onChange={onChangeSampai}
                  />
                </View>
              )}
            </View>

            {draftInvalid && (
              <Text style={styles.filterError}>Tanggal "Dari" tidak boleh setelah "Sampai".</Text>
            )}

            <View style={styles.filterActions}>
              <Pressable
                onPress={resetDraft}
                hitSlop={8}
                style={({ pressed }) => [styles.filterResetButton, pressed && styles.filterResetButtonPressed]}
              >
                <Text style={styles.filterResetText}>Reset</Text>
              </Pressable>
              <Pressable
                onPress={terapkan}
                disabled={draftInvalid}
                style={({ pressed }) => [
                  styles.filterApplyButton,
                  draftInvalid && styles.filterApplyButtonDisabled,
                  pressed && !draftInvalid && styles.filterApplyButtonPressed,
                ]}
              >
                <Text style={styles.filterApplyText}>Terapkan</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  dateFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.full,
    paddingHorizontal: ms(14),
    paddingVertical: ms(7),
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  dateFilterMain: { flexDirection: 'row', alignItems: 'center', gap: ms(8) },
  dateFilterText: { fontSize: ms(13), fontWeight: '600', color: colors.onSurface },

  filterBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: `${colors.onBackground}80` },
  filterModalWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.marginMobile },
  filterCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.cardPadding,
    gap: ms(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  filterCardTitle: { fontSize: ms(16), fontWeight: '700', color: colors.onSurface },
  filterField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceVariant,
    borderRadius: radius.full,
    paddingHorizontal: ms(16),
    paddingVertical: ms(10),
  },
  filterFieldLabel: { fontSize: ms(13), fontWeight: '600', color: colors.onSurfaceVariant },
  filterFieldValue: { fontSize: ms(14), color: colors.onSurface, fontWeight: '600' },
  // Batalkan padding horizontal filterCard khusus buat area picker, supaya inline
  // UIDatePicker iOS (~330pt) dapat ruang cukup — filterCard sendiri cuma sisakan
  // ~287pt di layar 375pt, selisihnya bikin layout pass gagal terus-menerus.
  pickerFullBleed: { marginHorizontal: -spacing.cardPadding },
  filterError: { fontSize: ms(12), color: colors.error },
  filterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: ms(6),
  },
  filterResetButton: {
    paddingVertical: ms(12),
    paddingHorizontal: ms(14),
    borderRadius: radius.full,
  },
  filterResetButtonPressed: { backgroundColor: colors.surfaceSoft },
  filterResetText: { fontSize: ms(14), fontWeight: '600', color: colors.onSurfaceVariant },
  filterApplyButton: {
    flex: 1,
    marginLeft: ms(12),
    alignItems: 'center',
    paddingVertical: ms(13),
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  filterApplyButtonPressed: { backgroundColor: colors.secondary },
  filterApplyButtonDisabled: { backgroundColor: colors.outlineVariant },
  filterApplyText: { fontSize: ms(14), fontWeight: '700', color: colors.onPrimary },
});
