import { create } from "zustand";

interface ErrorDialogState {
  message: string | null;
  openErrorDialog: (message: string) => void;
  openErrorConfirmDialog: (
    title: string,
    message: string,
    onConfirm?: () => void,
    options?: { showCancel?: boolean },
  ) => void;
  closeErrorDialog: () => void;
}

export const useErrorDialogStore = create<ErrorDialogState>((set) => ({
  message: null,
  openErrorDialog: (message) => {
    set({ message });
    if (typeof console !== "undefined") console.error("[error-dialog]", message);
  },
  openErrorConfirmDialog: (_title, message, onConfirm) => {
    set({ message });
    onConfirm?.();
  },
  closeErrorDialog: () => set({ message: null }),
}));
