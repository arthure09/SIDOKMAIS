import { Animated, StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme/colors';

/** Seberapa jauh sheet menindih header di atasnya. */
export const SHEET_OVERLAP = radius.md;

type Props = {
  /** Dari useAnimatedHeaderFade — shadow ikut muncul saat konten discroll. */
  shadowOpacity: Animated.AnimatedInterpolation<number>;
  elevation: Animated.AnimatedInterpolation<number>;
  children: React.ReactNode;
};

/**
 * Panel konten yang menindih header sejauh `SHEET_OVERLAP`, jadi di dua sudut
 * atasnya warna header yang keluar — lengkungnya menghadap ke luar.
 *
 * Screen yang memakainya wajib menambah `SHEET_OVERLAP` ke padding bawah
 * header, kalau tidak baris paling bawah header ketutupan sheet ini.
 *
 * Dua lapis View bukan gaya-gayaan: shadow ditaruh di luar karena
 * `overflow: hidden` (yang memotong list di sudut membulat) ikut memotong
 * shadow kalau keduanya di view yang sama. Shadow-nya juga menempel di sini,
 * bukan di header — header ada di bawah sheet, jadi shadow miliknya sendiri
 * malah ketutupan. Offset negatif supaya bayangan jatuh ke atas, ke arah
 * header: yang terbaca panel terangkat, bukan header melayang.
 */
export function ContentSheet({ shadowOpacity, elevation, children }: Props) {
  return (
    <Animated.View
      style={[
        styles.shadow,
        {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowRadius: 8,
          shadowOpacity,
          elevation,
        },
      ]}
    >
      <View style={styles.sheet}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadow: { flex: 1, marginTop: -SHEET_OVERLAP },
  sheet: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: SHEET_OVERLAP,
    borderTopRightRadius: SHEET_OVERLAP,
    overflow: 'hidden',
  },
});
