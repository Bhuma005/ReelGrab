import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Trash2, Film, RefreshCw, Upload, CheckCircle2, AlertTriangle, CloudOff, Search, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function LibraryPage() {
  const queryClient = useQueryClient();
  const [activeStatus, setActiveStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 12;

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: videosData, isLoading } = useQuery({
    queryKey: ['dashboardVideos', page, activeStatus, debouncedSearch],
    queryFn: () => dashboardApi.getVideos({ page, limit, status: activeStatus, search: debouncedSearch }),
    refetchInterval: 8000
  });

  const deleteMutation = useMutation({
    mutationFn: dashboardApi.deleteVideo,
    onSuccess: () => {
      toast.success("Video deleted");
      queryClient.invalidateQueries(['dashboardVideos']);
    },
    onError: (err) => toast.error(err.message)
  });

  const publishMutation = useMutation({
    mutationFn: (id) => fetch(`/api/dashboard/videos/${id}/publish`, { method: 'POST' }).then(async r => {
      if(!r.ok) throw new Error("Network response was not ok");
      const d = await r.json();
      if(d.status === "error") throw new Error(d.message);
      return d;
    }),
    onSuccess: () => {
      toast.success("Video published successfully to YouTube!");
      queryClient.invalidateQueries(['dashboardVideos']);
    },
    onError: (err) => toast.error(err.message)
  });

  const videos = videosData?.videos || [];
  const totalPages = videosData?.total_pages || 1;
  const totalCount = videosData?.total || 0;

  const statusTabs = [
    { key: 'all', label: 'All Videos' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'published', label: 'Published' },
    { key: 'cleaned', label: 'Archived (Cleaned)' },
    { key: 'failed', label: 'Failed' },
  ];

  const getStatusDisplay = (v) => {
    if (v.status === 'published') return { text: 'Published', color: 'text-success border-success/30 bg-success/10', icon: <CheckCircle2 className="w-3 h-3 mr-1 inline" /> };
    if (v.status === 'cleaned') return { text: 'Cloud Cleaned', color: 'text-text-muted border-border bg-surface', icon: <CloudOff className="w-3 h-3 mr-1 inline" /> };
    if (v.status === 'failed') return { text: 'Failed', color: 'text-danger border-danger/30 bg-danger/10', icon: <AlertTriangle className="w-3 h-3 mr-1 inline" /> };
    if (v.status === 'uploading') return { text: 'Uploading...', color: 'text-primary border-primary/30 bg-primary/10', icon: <RefreshCw className="w-3 h-3 mr-1 inline animate-spin" /> };
    if (v.status === 'scheduled') return { text: 'Scheduled', color: 'text-warning border-warning/30 bg-warning/10' };
    return { text: v.status || 'Created', color: 'text-text-muted border-border bg-surface' };
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Content Library</h2>
          <p className="text-xs text-text-muted">Permanent historical repository of all your Reels ({totalCount} total).</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search title..." 
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="bg-surface-elevated border border-border rounded-md pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-accent w-48 md:w-60 font-mono"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries(['dashboardVideos'])}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-3">
        {statusTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveStatus(tab.key); setPage(1); }}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeStatus === tab.key 
                ? 'bg-accent text-black shadow-sm' 
                : 'bg-surface-elevated text-text-muted hover:text-foreground border border-border/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-text-muted font-mono text-sm animate-pulse">Loading library data from Supabase...</div>
      ) : videos.length === 0 ? (
        <div className="text-center py-16 border border-border rounded-lg border-dashed bg-surface/30">
          <Film className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-40" />
          <h3 className="text-sm font-semibold">No videos found</h3>
          <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
            {searchTerm || activeStatus !== 'all' 
              ? 'No matching records for your filter. Try adjusting your search query.' 
              : 'Videos created and scheduled in your workflow will permanently appear here.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {videos.map(video => {
              const statusDisplay = getStatusDisplay(video);
              const canPublish = video.storage_exists && video.status !== 'published' && video.status !== 'cleaned' && video.status !== 'uploading';
              
              return (
                <Card key={video.id} className="overflow-hidden group flex flex-col border-border/70 hover:border-accent/40 transition-colors">
                  <div className="aspect-[9/16] bg-surface-elevated relative overflow-hidden">
                    {video.public_url ? (
                      <video 
                        src={video.public_url} 
                        className="w-full h-full object-cover" 
                        muted 
                        loop 
                        onMouseEnter={e => e.target.play()} 
                        onMouseLeave={e => e.target.pause()} 
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-text-muted text-xs p-4 text-center bg-black/40">
                        <CloudOff className="w-10 h-10 opacity-30 mb-2" />
                        <span className="font-semibold text-text-muted">
                          {video.status === 'cleaned' ? '☁ Cloud file cleaned' : 'No local media'}
                        </span>
                        <span className="text-[10px] text-text-muted/60 mt-1">Metadata preserved</span>
                      </div>
                    )}

                    <div className="absolute top-2 right-2 flex gap-1.5 z-10">
                      <span className={`text-[10px] uppercase px-2 py-0.5 rounded font-bold backdrop-blur-md border flex items-center shadow-sm ${statusDisplay.color}`}>
                        {statusDisplay.icon} {statusDisplay.text}
                      </span>
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent pointer-events-none" />

                    <div className="absolute bottom-0 left-0 right-0 p-3.5 z-10">
                      <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug mb-1">{video.title}</h4>
                      <p className="text-[10px] text-white/60 font-mono">
                        {video.created_at ? format(new Date(video.created_at), 'MMM d, yyyy • h:mm a') : 'Unknown Date'}
                      </p>
                      
                      {video.youtube_url && (
                        <a 
                          href={video.youtube_url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-[10px] text-accent hover:underline mt-1.5 inline-flex items-center gap-1 font-semibold"
                        >
                          <ExternalLink className="w-3 h-3" /> Watch on YouTube
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="p-2.5 grid grid-cols-2 gap-2 border-t border-border bg-surface/50 mt-auto">
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="text-xs h-7 w-full font-medium" 
                      disabled={!canPublish || publishMutation.isPending}
                      onClick={() => publishMutation.mutate(video.id)}
                    >
                      {publishMutation.isPending && publishMutation.variables === video.id ? (
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Upload className="w-3 h-3 mr-1" />
                      )}
                      Publish
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs h-7 w-full text-danger hover:bg-danger/10" 
                      onClick={() => {
                        if(confirm("Delete this video permanently from library?")) deleteMutation.mutate(video.id);
                      }} 
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Delete
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-6 border-t border-border">
              <span className="text-xs text-text-muted font-mono">
                Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} items)
              </span>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="h-8 text-xs"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Prev
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="h-8 text-xs"
                >
                  Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

