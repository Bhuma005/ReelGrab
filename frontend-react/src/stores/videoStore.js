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
  aiAnalysisStatus: 'idle', // 'idle', 'loading', 'success', 'error', 'timeout'
  aiAnalysisError: null,
  setAiAnalysisResult: (result) => set({ aiAnalysisResult: result, aiAnalysisStatus: 'success', aiAnalysisError: null }),
  setAiAnalysisStatus: (status, error = null) => set({ aiAnalysisStatus: status, aiAnalysisError: error }),

  allHashtags: [],
  setAllHashtags: (hashtags) => set({ allHashtags: hashtags }),

  isOpusMode: false,
  setIsOpusMode: (isOpusMode) => set({ isOpusMode }),

  resetWorkflow: () => set({
    url: '',
    metadata: null,
    formats: [],
    aiAnalysisResult: null,
    aiAnalysisStatus: 'idle',
    aiAnalysisError: null,
    allHashtags: [],
    isOpusMode: false,
  })
}));
