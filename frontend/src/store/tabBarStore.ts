import { create } from 'zustand';

type TabBarState = {
  docked: boolean;
  setDocked: (docked: boolean) => void;
};

// Dipakai bareng useTabBarDockOnScroll: screen melaporkan saat scroll
// mencapai dasar, FloatingTabBar membaca state ini untuk transisi
// floating <-> docked.
export const useTabBarStore = create<TabBarState>((set) => ({
  docked: false,
  setDocked: (docked) => set((s) => (s.docked === docked ? s : { docked })),
}));
