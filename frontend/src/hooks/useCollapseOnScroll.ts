import { useCallback, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

// Jarak scroll minimum sebelum arah dianggap berubah — tanpa ini getaran jari beberapa piksel bikin barisnya kedip-kedip buka-tutup.
const MIN_DELTA = 6;
// Di dekat puncak list semua baris selalu ditampilkan — kontrol yang hilang waktu list masih di atas kelihatan seperti bug.
const SHOW_ABOVE_Y = 24;
const DURATION = 220;
// Jeda tambahan setelah animasi selesai sebelum arah dibaca lagi, supaya pantulan terakhir ScrollView tidak langsung memicu animasi berikutnya.
const SETTLE = 80;

/**
 * Satu baris kontrol yang bisa menyusut. Dipakai dua kali oleh `useCollapseOnScroll`; tidak diekspor
 * karena urutan sembunyi/munculnya ditentukan hook di bawah, bukan tiap baris sendiri-sendiri.
 */
function useCollapsibleRow() {
  const [height, setHeight] = useState(0);
  // 0 = tampil penuh, 1 = tersembunyi.
  const slide = useRef(new Animated.Value(0)).current; // native driver: transform
  const collapse = useRef(new Animated.Value(0)).current; // JS driver: height
  const hidden = useRef(false);

  // Tingginya diukur sekali lewat onLayout, bukan angka hardcode, supaya ikut benar kalau font sistem
  // user diperbesar. Pengukuran berikutnya diabaikan karena setelah animasi jalan yang terukur adalah
  // tinggi animasinya, bukan aslinya.
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setHeight((prev) => (prev === 0 && h > 0 ? h : prev));
  }, []);

  const animate = useCallback(
    (to: 0 | 1) => {
      if (hidden.current === Boolean(to)) return;
      hidden.current = Boolean(to);
      const timing = { toValue: to, duration: DURATION, easing: Easing.out(Easing.cubic) };
      Animated.parallel([
        Animated.timing(slide, { ...timing, useNativeDriver: true }),
        Animated.timing(collapse, { ...timing, useNativeDriver: false }),
      ]).start();
    },
    [slide, collapse],
  );

  const reset = useCallback(() => {
    hidden.current = false;
    slide.setValue(0);
    collapse.setValue(0);
  }, [slide, collapse]);

  // Sebelum terukur jangan kasih tinggi apa pun: height 0 di render pertama bikin barisnya tidak pernah
  // punya kesempatan mengukur dirinya sendiri.
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

  return { height, onLayout, style, innerStyle, animate, reset };
}

/**
 * Menyembunyikan dua baris kontrol header (search bar + chip filter) saat scroll ke bawah, memunculkannya
 * lagi saat scroll ke atas.
 *
 * **Satu baris per langkah, bukan dua sekaligus.** Tiga posisi: 0 = semua tampil → 1 = filter sembunyi →
 * 2 = search bar ikut sembunyi. Langkah dipisahkan oleh waktu (`busyUntil`: DURATION + SETTLE), bukan
 * tarikan jari terpisah — supaya swipe cepat/lempar list (momentum setelah jari lepas) tetap bisa
 * menembus dua langkah berturut-turut.
 *
 * Struktur wajib dua lapis View per baris:
 *   <Animated.View style={style} onLayout={onLayout}>   // kotak: tinggi menyusut, overflow hidden
 *     <Animated.View style={innerStyle}>                // isi: geser ke atas via transform
 *
 * Kotak luar tidak pernah bergeser, cuma tingginya menyusut dan memotong (`overflow: hidden`) isinya,
 * supaya isi terlihat menyelinap ke balik baris di atasnya alih-alih menimpanya. Geseran isi jalan di
 * native driver; tinggi kotak tidak bisa (layout selalu di thread JS), jadi keduanya dipisah ke dua
 * Animated.Value berbeda yang jalan berbarengan.
 *
 * Jarak vertikal tiap baris (dan `gap` di header pembungkusnya) wajib padding, bukan margin — margin
 * tidak ikut terhitung di tinggi yang diukur `onLayout`, jadi barisnya menyisakan celah kosong saat
 * tersembunyi.
 *
 * ponytail: tinggi kotak dianimasikan di thread JS, jadi list di bawahnya ikut re-layout tiap frame.
 * Cukup untuk dua baris kontrol; kalau makin berat, pertimbangkan header absolute + transform saja.
 */
export function useCollapseOnScroll() {
  const top = useCollapsibleRow();
  const bottom = useCollapsibleRow();
  const lastY = useRef(0);
  const step = useRef(0);
  const busyUntil = useRef(0);

  const goTo = useCallback(
    (next: 0 | 1 | 2) => {
      if (next === step.current) return;
      step.current = next;
      busyUntil.current = Date.now() + DURATION + SETTLE;
      bottom.animate(next >= 1 ? 1 : 0);
      top.animate(next >= 2 ? 1 : 0);
    },
    [top.animate, bottom.animate], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const y = contentOffset.y;
      const delta = y - lastY.current;
      lastY.current = y;

      // Balik ke puncak = semua tampil sekaligus, tanpa menunggu dua langkah.
      if (y <= SHOW_ABOVE_Y) {
        goTo(0);
        return;
      }

      // Selama animasi jalan, tinggi baris ini berubah sehingga ScrollView menjepit contentOffset — jepitan
      // itu masuk lagi ke sini sebagai scroll balik arah dan memicu animasi lawan tanpa henti. Jadi arah
      // tidak dibaca selama animasi + sesaat sesudahnya.
      if (Date.now() < busyUntil.current) return;
      if (Math.abs(delta) < MIN_DELTA) return;

      const down = delta > 0;
      const next = Math.min(2, Math.max(0, step.current + (down ? 1 : -1))) as 0 | 1 | 2;
      if (next === step.current) return;

      // Dekat dasar list, menyembunyikan baris ini justru menambah ruang scroll sehingga konten tertarik
      // balik ke atas — pemicu loop yang sama. Di sisa jarak sependek itu ruang yang dihemat tidak berguna.
      const nextHeight = next === 2 ? top.height : bottom.height;
      const distanceFromBottom = contentSize.height - layoutMeasurement.height - y;
      if (down && distanceFromBottom < nextHeight * 2) return;

      goTo(next);
    },
    [goTo, top.height, bottom.height],
  );

  // Kembalikan semua baris ke posisi tampil, termasuk `lastY` — kalau tidak ikut dinolkan, scroll pertama
  // di list yang baru dihitung sebagai lompatan sejauh selisih dua list dan langsung memicu animasi.
  const reset = useCallback(() => {
    lastY.current = 0;
    step.current = 0;
    busyUntil.current = 0;
    top.reset();
    bottom.reset();
  }, [top.reset, bottom.reset]); // eslint-disable-line react-hooks/exhaustive-deps

  // Screen yang ditinggalkan lalu dibuka lagi mulai dari posisi scroll 0, jadi barisnya harus ikut kembali
  // tampil — kalau tidak, user mendarat di list yang search bar & filternya hilang tanpa sebab.
  useFocusEffect(reset);

  /**
   * `reset` wajib dipanggil juga tiap kali list yang ditampilkan berganti (mis. pindah tab), bukan cuma
   * saat screen difokus ulang — state di sini satu untuk seluruh screen, sementara tiap tab punya
   * ScrollView sendiri. Tanpa ini, tab dengan list kosong (tidak ada yang bisa discroll untuk memicu
   * `goTo(0)`) akan kehilangan search bar/filter secara permanen.
   */
  return { onScroll, top, bottom, reset };
}
