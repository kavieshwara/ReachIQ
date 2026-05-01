"use client";

import { create } from "zustand";

type ChatbotState = {
  open: boolean;
  unreadCount: number;
  toggle: () => void;
  openWidget: () => void;
  closeWidget: () => void;
  incrementUnread: () => void;
  resetUnread: () => void;
};

export const useChatbotStore = create<ChatbotState>((set) => ({
  open: false,
  unreadCount: 0,
  toggle: () => set((state) => ({ open: !state.open, unreadCount: state.open ? state.unreadCount : 0 })),
  openWidget: () => set({ open: true, unreadCount: 0 }),
  closeWidget: () => set({ open: false }),
  incrementUnread: () => set((state) => ({ unreadCount: state.open ? state.unreadCount : state.unreadCount + 1 })),
  resetUnread: () => set({ unreadCount: 0 })
}));
