import { create } from "zustand";

type ThreadUiState = {
  selectedSessionId: string | null;
  setSelectedSessionId: (sessionId: string | null) => void;
};

export const useThreadUiStore = create<ThreadUiState>((set) => ({
  selectedSessionId: null,
  setSelectedSessionId: (sessionId) => set({ selectedSessionId: sessionId }),
}));
