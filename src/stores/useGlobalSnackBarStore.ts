import { create } from "zustand";

interface GlobalSnackBarState {
  message: string | null;
  showSnackBar: (message: string) => void;
  clearSnackBar: () => void;
}

export const useGlobalSnackBarStore = create<GlobalSnackBarState>((set) => ({
  message: null,
  showSnackBar: (message) => {
    set({ message });
    if (typeof console !== "undefined") console.info("[snackbar]", message);
  },
  clearSnackBar: () => set({ message: null }),
}));
