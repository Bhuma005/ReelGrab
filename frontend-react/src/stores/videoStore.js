import { create } from 'zustand';

export const useVideoStore = create((set) => ({
  // Active workflow state
  url: '',
  setUrl: (url) => set({ url }),

  metadata: null,
  setMetadata: (metadata) => set({ metadata }),

  formats: [],
  setFormats: (formats) => set({ formats }),

  aiAnalysisResult: null,
  setAiAnalysisResult: (result) => set({ aiAnalysisResult: result }),

  allHashtags: [],
  setAllHashtags: (hashtags) => set({ allHashtags: hashtags }),

  isOpusMode: false,
  setIsOpusMode: (isOpusMode) => set({ isOpusMode }),

  resetWorkflow: () => set({
    url: '',
    metadata: null,
    formats: [],
    aiAnalysisResult: null,
    allHashtags: [],
    isOpusMode: false,
  })
}));
