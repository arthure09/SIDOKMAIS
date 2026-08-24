import { useCallback, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

// Jarak scroll minimum sebelum arah dianggap berubah — tanpa ini getaran jari
// beberapa piksel bikin barisnya kedip-kedip buka-tutup.
const MIN_DELTA = 6;
// Di dekat puncak list semua baris selalu ditampilkan, berapa pun arah
// scroll-nya: di posisi itu tidak ada ruang yang perlu dihemat, dan kontrol yang
// hilang waktu list masih di atas kelihatan seperti bug.
const SHOW_ABOVE_Y = 24;
const DURATION = 220;
// Jeda tambahan setelah animasi selesai sebelum arah dibaca lagi, supaya
// pantulan terakhir ScrollView tidak langsung memicu animasi berikutnya.
const SETTLE = 80;

/**
 * Satu baris kontrol yang bisa menyusut. Dipakai dua kali oleh
 * `useCollapseOnScroll`; tidak diekspor karena urutan sembunyi/munculnya yang
 * ditentukan hook di bawah, bukan tiap baris sendiri-sendiri.
 */
function useCollapsibleRow() {
  const [height, setHeight] = useState(0);
  // 0 = tampil penuh, 1 = tersembunyi.
  const slide = useRef(new Animated.Value(0)).current; // native driver: transform
  const collapse = useRef(new Animated.Value(0)).current; // JS driver: height
  const hidden = useRef(false);

  // Tingginya diukur sekali lewat onLayout, bukan angka hardcode, supaya ikut
  // benar kalau font sistem user diperbesar. Pengukuran berikutnya diabaikan
  // karena setelah animasi jalan yang terukur tinggi animasinya, bukan aslinya.
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

  return { height, onLayout, style, innerStyle, animate, reset };
}

/**
 * Menyembunyikan dua baris kontrol header (search bar + chip filter) waktu user
 * scroll ke bawah, dan memunculkannya lagi waktu scroll ke atas.
 *
 * **Satu baris per langkah, bukan dua sekaligus.** Ada tiga posisi:
 *
 *   0 = semua tampil → 1 = filter sembunyi → 2 = search bar ikut sembunyi
 *
 * Yang memisahkan dua langkah itu waktu (`busyUntil`: DURATION + SETTLE),
 * bukan tarikan jari. Jadi swipe pertama menyembunyikan filter, dan kalau
 * scroll-nya masih lanjut ke bawah search bar menyusul ~300ms kemudian; ke arah
 * sebaliknya search bar duluan yang balik, baru filter.
 *
 * Versi sebelumnya mensyaratkan jari diangkat lalu menarik lagi buat lanjut ke
 * langkah kedua (`onScrollBeginDrag` "mengisi ulang" jatah langkah). Itu bikin
 * search bar tidak pernah sembunyi waktu user melempar list sekali dengan cepat:
 * momentum setelah jari lepas tidak memicu gestur baru, jadi jatahnya tidak
 * pernah terisi ulang dan posisinya nyangkut di 1. Jeda 300ms sendiri sudah
 * cukup buat memisahkan dua baris secara visual (yang dulu tidak cukup itu
 * jeda 90ms).
 *
 * Pakainya butuh dua lapis View per baris, dan pembagiannya bukan gaya-gayaan:
 *   <Animated.View style={style} onLayout={onLayout}>   // kotak: tinggi menyusut
 *     <Animated.View style={innerStyle}>                // isi: geser ke atas
 *
 * Kotak luar tidak pernah bergeser, cuma tingginya yang menyusut, dan dia
 * memotong (`overflow: hidden`) isinya. Jadi isinya masuk ke balik tepi atas
 * kotak — terlihat menyelinap ke belakang baris di atasnya. Versi sebelumnya
 * menggeser kotaknya sendiri, sehingga kotak itu ikut naik menimpa baris di
 * atasnya (elemen belakangan digambar di atas) dan malah lewat di depannya.
 *
 * Geseran isi dijalankan native driver supaya mulus; tinggi kotak tidak bisa
 * (layout selalu di thread JS), jadi keduanya dipisah ke dua Animated.Value
 * yang jalan berbarengan — satu nilai tidak boleh dipakai dua driver sekaligus.
 *
 * Jarak vertikal tiap baris wajib padding, bukan margin: margin tidak ikut
 * terhitung di tinggi yang diukur, jadi barisnya menyisakan celah kosong waktu
 * sudah tersembunyi. Sama untuk `gap` di header pembungkusnya — gap tetap
 * berlaku buat anak setinggi nol.
 *
 * ponytail: tinggi kotak tetap dianimasikan di thread JS, jadi list di bawahnya
 * ikut re-layout tiap frame. Cukup buat dua baris kontrol. Kalau nanti terasa
 * berat: jadikan header absolute + `paddingTop` di list, lalu geser header-nya
 * dengan transform saja — nol re-layout, tapi diffnya jauh lebih besar.
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

      // Sumber bug "nyangkut": selama animasi jalan, tinggi baris ini berubah,
      // jadi tinggi viewport list ikut berubah dan ScrollView menjepit
      // contentOffset-nya. Jepitan itu masuk lagi ke sini sebagai scroll balik
      // arah, memicu animasi lawan, dan seterusnya — list terlihat menolak
      // digeser. Selama animasi + sesaat sesudahnya, arah tidak dibaca.
      if (Date.now() < busyUntil.current) return;
      if (Math.abs(delta) < MIN_DELTA) return;

      const down = delta > 0;
      const next = Math.min(2, Math.max(0, step.current + (down ? 1 : -1))) as 0 | 1 | 2;
      if (next === step.current) return;

      // Pemicu kedua loop yang sama: di dekat dasar list, menyembunyikan baris
      // ini justru menambah ruang scroll sehingga konten tertarik balik ke
      // atas. Di sisa jarak sependek itu ruang yang dihemat tidak ada gunanya.
      const nextHeight = next === 2 ? top.height : bottom.height;
      const distanceFromBottom = contentSize.height - layoutMeasurement.height - y;
      if (down && distanceFromBottom < nextHeight * 2) return;

      goTo(next);
    },
    [goTo, top.height, bottom.height],
  );

  // Kembalikan semua baris ke posisi tampil, termasuk `lastY`: kalau posisi
  // terakhir tidak ikut dinolkan, scroll pertama di list yang baru dihitung
  // sebagai lompatan sejauh selisih dua list dan langsung memicu animasi.
  const reset = useCallback(() => {
    lastY.current = 0;
    step.current = 0;
    busyUntil.current = 0;
    top.reset();
    bottom.reset();
  }, [top.reset, bottom.reset]); // eslint-disable-line react-hooks/exhaustive-deps

  // Screen yang ditinggalkan lalu dibuka lagi mulai dari posisi scroll 0, jadi
  // barisnya harus ikut kembali tampil — kalau tidak, user mendarat di list
  // yang search bar & filternya hilang tanpa sebab.
  useFocusEffect(reset);

  /**
   * `reset` WAJIB dipanggil juga setiap kali list yang ditampilkan berganti
   * (mis. pindah tab), bukan cuma waktu screen-nya difokus ulang. State di sini
   * satu untuk seluruh screen, sedangkan tiap tab punya ScrollView sendiri yang
   * mount ulang dari posisi 0. Tanpa reset, keadaan "tersembunyi" dari tab lama
   * terbawa ke list baru yang berada di puncak — dan karena `goTo(0)` cuma
   * dipicu oleh event scroll, satu-satunya jalan memunculkannya lagi adalah
   * men-scroll. Di tab yang isinya kosong (mis. dokter tanpa jadwal operasi)
   * tidak ada yang bisa di-scroll sama sekali, jadi search bar dan filter
   * hilang permanen sampai screen-nya ditinggalkan.
   */
  return { onScroll, top, bottom, reset };
}
