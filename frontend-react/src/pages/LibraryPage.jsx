import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Trash2, Film, RefreshCw, Upload, CheckCircle2, AlertTriangle, CloudOff } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function LibraryPage() {
  const queryClient = useQueryClient();
  const { data: videosData, isLoading } = useQuery({
    queryKey: ['dashboardVideos'],
    queryFn: dashboardApi.getVideos,
    refetchInterval: 5000 // Poll every 5s to keep UI updated
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
      toast.success("Video published successfully");
      queryClient.invalidateQueries(['dashboardVideos']);
    },
    onError: (err) => toast.error(err.message)
  });

  const videos = videosData?.videos || [];

  const getStatusDisplay = (v) => {
    if (v.status === 'published') return { text: 'Published', color: 'text-success border-success/30 bg-success/10', icon: <CheckCircle2 className="w-3 h-3 mr-1 inline" /> };
    if (v.status === 'cleaned') return { text: 'Archived (Cleaned)', color: 'text-text-muted border-border bg-surface', icon: <CloudOff className="w-3 h-3 mr-1 inline" /> };
    if (v.status === 'failed') return { text: 'Failed', color: 'text-danger border-danger/30 bg-danger/10', icon: <AlertTriangle className="w-3 h-3 mr-1 inline" /> };
    if (v.status === 'uploading') return { text: 'Uploading...', color: 'text-primary border-primary/30 bg-primary/10', icon: <RefreshCw className="w-3 h-3 mr-1 inline animate-spin" /> };
    if (v.status === 'scheduled') return { text: 'Scheduled', color: 'text-warning border-warning/30 bg-warning/10' };
    return { text: v.status || 'Created', color: 'text-text-muted border-border bg-surface' };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Content Library</h2>
          <p className="text-text-muted">Manage all your downloaded and generated Reels.</p>
        </div>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries(['dashboardVideos'])}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-text-muted">Loading library...</div>
      ) : videos.length === 0 ? (
        <div className="text-center py-12 border border-border rounded-lg border-dashed">
          <Film className="w-8 h-8 text-text-muted mx-auto mb-3 opacity-50" />
          <h3 className="text-sm font-medium">Library is empty</h3>
          <p className="text-xs text-text-muted mt-1">Videos scheduled in the workflow will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {videos.map(video => {
            const statusDisplay = getStatusDisplay(video);
            const canPublish = video.storage_exists && video.status !== 'published' && video.status !== 'cleaned' && video.status !== 'uploading';
            
            return (
              <Card key={video.id} className="overflow-hidden group">
                <div className="aspect-[9/16] bg-surface-elevated relative">
                  {video.public_url ? (
                    <video src={video.public_url} className="w-full h-full object-cover" muted loop onMouseEnter={e => e.target.play()} onMouseLeave={e => e.target.pause()} />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-text-muted text-xs p-4 text-center">
                      <CloudOff className="w-8 h-8 opacity-20 mb-2" />
                      <span>{video.status === 'cleaned' ? 'Cloud file cleaned' : 'No media'}</span>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex gap-2">
                    <span className={`text-[10px] uppercase px-2 py-1 rounded font-bold backdrop-blur-md border flex items-center ${statusDisplay.color}`}>
                      {statusDisplay.icon} {statusDisplay.text}
                    </span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h4 className="text-sm font-bold text-white line-clamp-2 leading-tight mb-1">{video.title}</h4>
                    <p className="text-[10px] text-white/70">
                      {video.created_at ? format(new Date(video.created_at), 'MMM d, yyyy h:mm a') : 'Unknown Date'}
                    </p>
                    {video.youtube_url && (
                      <a href={video.youtube_url} target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline mt-1 inline-block">
                        View on YouTube
                      </a>
                    )}
                  </div>
                </div>
                <div className="p-3 grid grid-cols-2 gap-2 border-t border-border bg-background/50">
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="text-xs w-full" 
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
                  <Button variant="destructive" size="sm" className="text-xs w-full" onClick={() => {
                    if(confirm("Delete this video completely?")) deleteMutation.mutate(video.id);
                  }} disabled={deleteMutation.isPending}>
                    <Trash2 className="w-3 h-3 mr-1" /> Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
