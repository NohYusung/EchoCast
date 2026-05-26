import { create } from "zustand";

/** 플레이어 페이지 진입 시 음악 재생 멈춤용 스텁 (vogopang_brochure에는 음악 플레이어 없음) */
export const useAudioPlayerStore = create<{ pause: () => void }>(() => ({
  pause: () => {},
}));
