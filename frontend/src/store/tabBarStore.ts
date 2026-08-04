import { create } from 'zustand';

type TabBarState = {
  docked: boolean;
  setDocked: (docked: boolean) => void;
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
};

// Dipakai bareng useTabBarDockOnScroll: screen melaporkan saat scroll
// mencapai dasar, FloatingTabBar membaca state ini untuk transisi
// floating <-> docked.
export const useTabBarStore = create<TabBarState>((set) => ({
  docked: false,
  setDocked: (docked) => set((s) => (s.docked === docked ? s : { docked })),
  // Dipakai screen full-bleed yang nggak boleh ketutupan FloatingTabBar sama
  // sekali (mis. LihatPdfLabScreen) — lihat useHideTabBar. Beda dari `docked`:
  // ini bikin tab bar slide keluar layar, bukan cuma ganti gaya floating/docked.
  hidden: false,
  setHidden: (hidden) => set((s) => (s.hidden === hidden ? s : { hidden })),
}));
