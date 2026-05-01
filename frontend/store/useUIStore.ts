"use client";

import { create } from "zustand";

type UIState = {
  searchOpen: boolean;
  notificationsOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  setNotificationsOpen: (open: boolean) => void;
  closePanels: () => void;
};

export const useUIStore = create<UIState>((set) => ({
  searchOpen: false,
  notificationsOpen: false,
  setSearchOpen: (open) => set((state) => ({ searchOpen: open, notificationsOpen: open ? false : state.notificationsOpen })),
  setNotificationsOpen: (open) => set((state) => ({ notificationsOpen: open, searchOpen: open ? false : state.searchOpen })),
  closePanels: () => set({ searchOpen: false, notificationsOpen: false })
}));
