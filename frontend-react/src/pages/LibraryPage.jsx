import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { 
  Trash2, Film, RefreshCw, Upload, CheckCircle2, AlertTriangle, CloudOff, 
  Search, ChevronLeft, ChevronRight, ExternalLink, Play, X, Copy, Check, Calendar, Hash, Clock, Sparkles 
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function LibraryPage() {
  const queryClient = useQueryClient();
  const [activeStatus, setActiveStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [copied, setCopied] = useState(false);
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
      if (selectedVideo) setSelectedVideo(null);
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

  const handleCopyMetadata = (v) => {
    const text = `${v.title}\n\n${v.description || ''}\n\n${(v.hashtags || []).join(' ')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Title, description & tags copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Content Library</h2>
          <p className="text-xs text-text-muted">Click any video to open the YouTube Studio video preview and inspect details ({totalCount} total).</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search title..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
            {videos.map(video => {
              const statusDisplay = getStatusDisplay(video);
              const canPublish = video.storage_exists && video.status !== 'published' && video.status !== 'cleaned' && video.status !== 'uploading';
              
              return (
                <Card 
                  key={video.id} 
                  className="overflow-hidden group flex flex-col bg-surface border-border hover:border-accent/50 transition-all shadow-md cursor-pointer hover:shadow-lg"
                  onClick={() => setSelectedVideo(video)}
                >
                  {/* YouTube Studio Thumbnail / Media Section */}
                  <div className="aspect-video bg-surface-elevated relative overflow-hidden flex items-center justify-center border-b border-border">
                    {video.public_url ? (
                      <video 
                        src={video.public_url} 
                        className="w-full h-full object-cover" 
                        muted 
                        loop 
                        onMouseEnter={e => e.target.play()} 
                        onMouseLeave={e => e.target.pause()} 
                      />
                    ) : video.thumbnail_url ? (
                      <img 
                        src={video.thumbnail_url} 
                        alt={video.title} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-text-muted text-xs p-4 text-center bg-black/60 w-full">
                        <Film className="w-8 h-8 opacity-30 mb-2 text-accent" />
                        <span className="font-semibold text-text-muted">
                          {video.status === 'cleaned' ? '☁ Cloud file cleaned' : 'YouTube Shorts Media'}
                        </span>
                        <span className="text-[10px] text-text-muted/60 mt-0.5">Metadata & logs preserved</span>
                      </div>
                    )}

                    {/* Play Hover Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none">
                      <div className="w-10 h-10 rounded-full bg-accent text-black flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-transform">
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </div>
                      <span className="text-xs font-bold text-white bg-black/70 px-2.5 py-1 rounded backdrop-blur-md">
                        Preview Video
                      </span>
                    </div>

                    {/* Status Badge */}
                    <div className="absolute top-2.5 right-2.5 flex gap-1.5 z-10">
                      <span className={`text-[10px] uppercase px-2 py-0.5 rounded font-bold backdrop-blur-md border flex items-center shadow-md ${statusDisplay.color}`}>
                        {statusDisplay.icon} {statusDisplay.text}
                      </span>
                    </div>

                    {/* Shorts indicator badge */}
                    <div className="absolute bottom-2 left-2.5 z-10">
                      <span className="text-[10px] font-mono font-bold bg-black/80 text-accent px-1.5 py-0.5 rounded border border-white/10">
                        9:16 Shorts
                      </span>
                    </div>
                  </div>

                  {/* YouTube Studio Card Details */}
                  <div className="p-4 flex-1 flex flex-col space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-foreground line-clamp-2 leading-snug group-hover:text-accent transition-colors" title={video.title}>
                        {video.title}
                      </h4>
                      {video.description && (
                        <p className="text-xs text-text-muted line-clamp-2 mt-1.5 leading-relaxed font-sans">
                          {video.description}
                        </p>
                      )}
                    </div>

                    {/* Hashtags Chips */}
                    {video.hashtags && Array.isArray(video.hashtags) && video.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {video.hashtags.slice(0, 4).map((tag, idx) => (
                          <span key={idx} className="text-[10px] font-mono text-accent/90 bg-accent/10 px-1.5 py-0.5 rounded border border-accent/20">
                            {tag.startsWith('#') ? tag : `#${tag}`}
                          </span>
                        ))}
                        {video.hashtags.length > 4 && (
                          <span className="text-[10px] font-mono text-text-muted px-1 py-0.5">
                            +{video.hashtags.length - 4} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Scheduled / Published Time Details */}
                    <div className="pt-2 mt-auto border-t border-border/60 flex flex-col gap-1 text-[11px] text-text-muted font-mono">
                      {video.schedule_time && (
                        <div className="flex items-center gap-1.5 text-warning/90">
                          <span>🕒 Scheduled:</span>
                          <strong className="text-foreground">
                            {format(new Date(video.schedule_time), 'MMM d, yyyy • h:mm a')}
                          </strong>
                        </div>
                      )}

                      {video.youtube_url ? (
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-success font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Live on YouTube
                          </span>
                          <a 
                            href={video.youtube_url} 
                            target="_blank" 
                            rel="noreferrer" 
                            onClick={e => e.stopPropagation()}
                            className="text-accent hover:underline inline-flex items-center gap-1 font-bold"
                          >
                            <ExternalLink className="w-3 h-3" /> View Video
                          </a>
                        </div>
                      ) : (
                        <div className="text-[10px] text-text-muted/70">
                          Added: {video.created_at ? format(new Date(video.created_at), 'MMM d, yyyy • h:mm a') : 'Recently'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Toolbar */}
                  <div className="p-2.5 grid grid-cols-2 gap-2 border-t border-border bg-surface-elevated/40" onClick={e => e.stopPropagation()}>
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="text-xs h-7.5 w-full font-semibold bg-accent/15 hover:bg-accent text-accent hover:text-black transition-colors" 
                      disabled={!canPublish || publishMutation.isPending}
                      onClick={() => publishMutation.mutate(video.id)}
                    >
                      {publishMutation.isPending && publishMutation.variables === video.id ? (
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Upload className="w-3 h-3 mr-1" />
                      )}
                      Publish Now
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs h-7.5 w-full text-danger hover:bg-danger/10" 
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

      {/* ── YouTube Studio Video Preview & Inspection Modal ── */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface border border-border rounded-xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Top Bar */}
            <div className="px-5 py-3.5 bg-surface-elevated border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-accent" />
                <h3 className="font-bold text-sm text-foreground">YouTube Studio Video Preview & Details</h3>
              </div>
              <button 
                onClick={() => setSelectedVideo(null)}
                className="p-1 rounded-md text-text-muted hover:text-foreground hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: 2 Columns */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Left Column: 9:16 Video Player Preview */}
              <div className="md:col-span-5 flex flex-col items-center justify-center bg-black/60 rounded-lg p-4 border border-border">
                <div className="w-full max-w-[280px] aspect-[9/16] bg-black rounded-lg overflow-hidden relative shadow-2xl border border-white/10 flex items-center justify-center">
                  {selectedVideo.public_url ? (
                    <video 
                      src={selectedVideo.public_url} 
                      className="w-full h-full object-cover" 
                      controls 
                      autoPlay 
                      loop 
                      playsInline
                    />
                  ) : selectedVideo.thumbnail_url ? (
                    <img 
                      src={selectedVideo.thumbnail_url} 
                      alt={selectedVideo.title} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-6 text-text-muted">
                      <Film className="w-12 h-12 text-accent/50 mb-3" />
                      <span className="font-bold text-sm text-foreground">Cloud Media Cleaned</span>
                      <p className="text-xs text-text-muted mt-1">Video was published to YouTube and local storage was safely cleaned.</p>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between w-full max-w-[280px] text-[11px] font-mono text-text-muted">
                  <span>9:16 Vertical Short</span>
                  <span className={`px-2 py-0.5 rounded font-bold uppercase ${getStatusDisplay(selectedVideo).color}`}>
                    {getStatusDisplay(selectedVideo).text}
                  </span>
                </div>
              </div>

              {/* Right Column: YouTube Studio Title & Description Details */}
              <div className="md:col-span-7 flex flex-col space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1">
                    Video Title
                  </label>
                  <div className="p-3 bg-surface-elevated rounded-md border border-border text-sm font-semibold text-foreground select-text">
                    {selectedVideo.title}
                  </div>
                </div>

                {/* Description */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
                      YouTube Description
                    </label>
                    <button 
                      onClick={() => handleCopyMetadata(selectedVideo)}
                      className="text-xs text-accent hover:underline flex items-center gap-1 font-mono"
                    >
                      {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Copied' : 'Copy All'}
                    </button>
                  </div>
                  <div className="p-3 bg-surface-elevated rounded-md border border-border text-xs text-foreground/90 font-sans leading-relaxed min-h-[110px] whitespace-pre-wrap select-text">
                    {selectedVideo.description || "No description provided."}
                  </div>
                </div>

                {/* Hashtags */}
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">
                    Viral Hashtags
                  </label>
                  <div className="flex flex-wrap gap-1.5 p-2.5 bg-surface-elevated rounded-md border border-border">
                    {selectedVideo.hashtags && selectedVideo.hashtags.length > 0 ? (
                      selectedVideo.hashtags.map((tag, idx) => (
                        <span key={idx} className="text-xs font-mono font-semibold text-accent bg-accent/10 px-2 py-1 rounded border border-accent/30">
                          {tag.startsWith('#') ? tag : `#${tag}`}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-text-muted">No hashtags attached</span>
                    )}
                  </div>
                </div>

                {/* Publishing / Scheduling Details */}
                <div className="p-3 bg-surface-elevated rounded-md border border-border grid grid-cols-2 gap-3 text-xs font-mono">
                  <div>
                    <span className="text-text-muted block text-[10px] uppercase">Schedule Slot</span>
                    <span className="font-bold text-warning flex items-center gap-1 mt-0.5">
                      <Clock className="w-3.5 h-3.5" />
                      {selectedVideo.schedule_time ? format(new Date(selectedVideo.schedule_time), 'MMM d, yyyy • h:mm a') : 'Instant Upload'}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted block text-[10px] uppercase">YouTube Status</span>
                    {selectedVideo.youtube_url ? (
                      <a 
                        href={selectedVideo.youtube_url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="font-bold text-accent hover:underline flex items-center gap-1 mt-0.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Live on YouTube
                      </a>
                    ) : (
                      <span className="text-text-muted mt-0.5 block">Pending Upload</span>
                    )}
                  </div>
                </div>

                {/* Modal Footer Controls */}
                <div className="pt-3 border-t border-border flex items-center justify-end gap-3 mt-auto">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setSelectedVideo(null)}
                  >
                    Close
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="bg-accent text-black hover:bg-accent/90 font-bold text-xs"
                    disabled={!selectedVideo.storage_exists || selectedVideo.status === 'published' || publishMutation.isPending}
                    onClick={() => publishMutation.mutate(selectedVideo.id)}
                  >
                    {publishMutation.isPending ? (
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Publish to YouTube Now
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


