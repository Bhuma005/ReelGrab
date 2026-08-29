import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Activity, Clock, Upload, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: dashboardApi.getStats,
    refetchInterval: 5000,
  });

  const { data: videosData, isLoading: videosLoading } = useQuery({
    queryKey: ['dashboardVideos'],
    queryFn: dashboardApi.getVideos,
    refetchInterval: 5000,
  });

  const videos = videosData?.videos || [];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-text-muted">Overview of your scheduled and processed Reels.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-text-muted">Pending Automation</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsLoading ? '-' : (stats?.pending || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-text-muted">Ready to Post</CardTitle>
            <Upload className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsLoading ? '-' : (stats?.uploaded || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-text-muted">Failed Pipelines</CardTitle>
            <AlertCircle className="h-4 w-4 text-danger" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsLoading ? '-' : (stats?.failed || 0)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="col-span-3">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {videosLoading ? (
            <div className="text-sm text-text-muted">Loading...</div>
          ) : videos.length === 0 ? (
            <div className="text-sm text-text-muted">No scheduled videos found.</div>
          ) : (
            <div className="space-y-4">
              {videos.slice(0, 5).map((v) => (
                <div key={v.id} className="flex items-center gap-4 p-4 border border-border rounded-lg bg-background/50 hover:bg-surface-elevated transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{v.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-bold ${
                        v.status === 'uploaded' ? 'bg-success/10 text-success border border-success/20' :
                        v.status === 'failed' ? 'bg-danger/10 text-danger border border-danger/20' :
                        'bg-warning/10 text-warning border border-warning/20'
                      }`}>
                        {v.status}
                      </span>
                      <span className="text-xs text-text-muted truncate flex-1">
                        {v.description}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-text-muted text-right whitespace-nowrap">
                    {v.created_at ? formatDistanceToNow(new Date(v.created_at), { addSuffix: true }) : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
