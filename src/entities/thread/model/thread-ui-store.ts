import { create } from "zustand";

type ThreadUiState = {
  selectedThreadId: string | null;
  setSelectedThreadId: (threadId: string | null) => void;
};

export const useThreadUiStore = create<ThreadUiState>((set) => ({
  selectedThreadId: null,
  setSelectedThreadId: (threadId) => set({ selectedThreadId: threadId }),
}));
