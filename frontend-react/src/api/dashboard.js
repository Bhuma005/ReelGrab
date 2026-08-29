import { fetchApi } from './client';

export const dashboardApi = {
  getStats: () => fetchApi('/api/dashboard/stats'),
  getVideos: () => fetchApi('/api/dashboard/videos'),
  getLogs: () => fetchApi('/api/dashboard/logs'),
  getRecommendation: () => fetchApi('/api/scheduling/recommendation'),
  deleteVideo: (id) => fetchApi(`/api/dashboard/videos/${id}`, { method: 'DELETE' }),
  convertVideo: (id, ratio) => fetchApi(`/api/dashboard/videos/${id}/convert`, {
    method: 'POST',
    body: JSON.stringify({ ratio })
  }),
  publishVideo: (id) => fetchApi(`/api/dashboard/videos/${id}/publish`, { method: 'POST' }),
};
