import { useCallback, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

// Jarak scroll minimum sebelum arah dianggap berubah — tanpa ini getaran jari
// beberapa piksel bikin baris filter kedip-kedip buka-tutup.
const MIN_DELTA = 6;
// Di dekat puncak list filter selalu ditampilkan, berapa pun arah scroll-nya:
// di posisi itu tidak ada ruang yang perlu dihemat, dan filter yang hilang
// waktu list masih di atas kelihatan seperti bug.
const SHOW_ABOVE_Y = 24;
const DURATION = 220;
// Jeda tambahan setelah animasi selesai sebelum arah dibaca lagi, supaya
// pantulan terakhir ScrollView tidak langsung memicu animasi berikutnya.
const SETTLE = 80;

/**
 * Menyembunyikan satu baris kontrol (mis. chip filter) waktu user scroll ke
 * bawah, dan memunculkannya lagi waktu scroll ke atas.
 *
 * Pakainya butuh dua lapis View, dan pembagiannya bukan gaya-gayaan:
 *   <Animated.View style={style} onLayout={onLayout}>   // kotak: tinggi menyusut
 *     <Animated.View style={innerStyle}>                // isi: geser ke atas
 *
 * Kotak luar tidak pernah bergeser, cuma tingginya yang menyusut, dan dia
 * memotong (`overflow: hidden`) isinya. Jadi chip-nya masuk ke balik tepi atas
 * kotak — terlihat menyelinap ke belakang search bar di atasnya. Versi
 * sebelumnya menggeser kotaknya sendiri, sehingga kotak itu ikut naik menimpa
 * search bar (elemen belakangan digambar di atas) dan malah terlihat lewat di
 * depannya.
 *
 * Geseran isi dijalankan native driver supaya mulus; tinggi kotak tidak bisa
 * (layout selalu di thread JS), jadi keduanya dipisah ke dua Animated.Value
 * yang jalan berbarengan — satu nilai tidak boleh dipakai dua driver sekaligus.
 *
 * Tingginya diukur sekali lewat `onLayout`, bukan angka hardcode, supaya ikut
 * benar kalau font sistem user diperbesar. Pengukuran berikutnya diabaikan
 * karena setelah animasi jalan yang terukur tinggi animasinya, bukan aslinya.
 *
 * ponytail: tinggi kotak tetap dianimasikan di thread JS, jadi list di bawahnya
 * ikut re-layout tiap frame. Cukup buat satu baris chip. Kalau nanti terasa
 * berat: jadikan header absolute + `paddingTop` di list, lalu geser header-nya
 * dengan transform saja — nol re-layout, tapi diffnya jauh lebih besar.
 */
export function useCollapseOnScroll() {
  const [height, setHeight] = useState(0);
  // 0 = tampil penuh, 1 = tersembunyi.
  const slide = useRef(new Animated.Value(0)).current; // native driver: transform
  const collapse = useRef(new Animated.Value(0)).current; // JS driver: height
  const lastY = useRef(0);
  const hidden = useRef(false);
  const busyUntil = useRef(0);

  const animateTo = useCallback(
    (to: 0 | 1) => {
      if (hidden.current === Boolean(to)) return;
      hidden.current = Boolean(to);
      busyUntil.current = Date.now() + DURATION + SETTLE;
      const timing = { toValue: to, duration: DURATION, easing: Easing.out(Easing.cubic) };
      Animated.parallel([
        Animated.timing(slide, { ...timing, useNativeDriver: true }),
        Animated.timing(collapse, { ...timing, useNativeDriver: false }),
      ]).start();
    },
    [slide, collapse],
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const y = contentOffset.y;
      const delta = y - lastY.current;
      lastY.current = y;

      if (y <= SHOW_ABOVE_Y) {
        animateTo(0);
        return;
      }

      // Sumber bug "nyangkut": selama animasi jalan, tinggi baris ini berubah,
      // jadi tinggi viewport list ikut berubah dan ScrollView menjepit
      // contentOffset-nya. Jepitan itu masuk lagi ke sini sebagai scroll balik
      // arah, memicu animasi lawan, dan seterusnya — list terlihat menolak
      // digeser. Selama animasi + sesaat sesudahnya, arah tidak dibaca.
      if (Date.now() < busyUntil.current) return;
      if (Math.abs(delta) < MIN_DELTA) return;

      // Pemicu kedua loop yang sama: di dekat dasar list, menyembunyikan baris
      // ini justru menambah ruang scroll sehingga konten tertarik balik ke
      // atas. Di sisa jarak sependek itu ruang yang dihemat tidak ada gunanya.
      const distanceFromBottom = contentSize.height - layoutMeasurement.height - y;
      if (delta > 0 && distanceFromBottom < height * 2) return;

      animateTo(delta > 0 ? 1 : 0);
    },
    [animateTo, height],
  );

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setHeight((prev) => (prev === 0 && h > 0 ? h : prev));
  }, []);

  // Screen yang ditinggalkan lalu dibuka lagi mulai dari posisi scroll 0, jadi
  // barisnya harus ikut kembali tampil — kalau tidak, user mendarat di list
  // yang filternya hilang tanpa sebab.
  useFocusEffect(
    useCallback(() => {
      lastY.current = 0;
      hidden.current = false;
      busyUntil.current = 0;
      slide.setValue(0);
      collapse.setValue(0);
    }, [slide, collapse]),
  );

  // Sebelum terukur jangan kasih tinggi apa pun: height 0 di render pertama
  // bikin barisnya tidak pernah punya kesempatan mengukur dirinya sendiri.
  const style =
    height === 0
      ? null
      : {
          height: collapse.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }),
          overflow: 'hidden' as const,
        };

  const innerStyle = {
    transform: [
      { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [0, -height] }) },
    ],
  };

  return { onScroll, onLayout, style, innerStyle };
}
