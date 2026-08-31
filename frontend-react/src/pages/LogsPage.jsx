import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard';
import { Card, CardContent } from '../components/ui/Card';
import { Terminal, RefreshCw, Activity, CheckCircle2, Clock, Upload, Trash2, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { format } from 'date-fns';

export default function LogsPage() {
  const [activeTab, setActiveTab] = useState('activity'); // 'activity' | 'raw'

  const { data: logsData, isLoading, refetch } = useQuery({
    queryKey: ['dashboardLogs'],
    queryFn: dashboardApi.getLogs,
    refetchInterval: 8000,
  });

  const activityEvents = logsData?.activity_events || [];
  const rawLogs = logsData?.logs || [];

  const getEventIcon = (type) => {
    if (type?.includes('SUCCESS') || type?.includes('PUBLISHED')) {
      return <CheckCircle2 className="w-4 h-4 text-success" />;
    }
    if (type?.includes('FAILED') || type?.includes('ERROR')) {
      return <AlertCircle className="w-4 h-4 text-danger" />;
    }
    if (type?.includes('STARTED') || type?.includes('SCHEDULED')) {
      return <Clock className="w-4 h-4 text-warning" />;
    }
    if (type?.includes('DELETE')) {
      return <Trash2 className="w-4 h-4 text-text-muted" />;
    }
    return <Activity className="w-4 h-4 text-accent" />;
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col space-y-4 max-w-6xl mx-auto pb-6">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">System & Activity Logs</h2>
          <p className="text-xs text-text-muted">Permanent cloud audit trail and real-time backend engine logs.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-surface-elevated p-1 rounded-lg border border-border flex gap-1">
            <button
              onClick={() => setActiveTab('activity')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'activity' ? 'bg-accent text-black shadow-sm' : 'text-text-muted hover:text-foreground'
              }`}
            >
              <Activity className="w-3.5 h-3.5" /> Activity Timeline
            </button>
            <button
              onClick={() => setActiveTab('raw')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'raw' ? 'bg-accent text-black shadow-sm' : 'text-text-muted hover:text-foreground'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" /> Raw Engine Logs
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
        </div>
      </div>

      {activeTab === 'activity' ? (
        <Card className="flex-1 min-h-0 overflow-hidden flex flex-col bg-surface border-border">
          <div className="bg-surface-elevated px-4 py-2.5 border-b border-border flex items-center justify-between shrink-0">
            <span className="text-xs font-mono font-bold text-accent uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" /> Supabase Audit Trail (video_activity_log)
            </span>
            <span className="text-[11px] text-text-muted font-mono">{activityEvents.length} events</span>
          </div>
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
            {isLoading ? (
              <div className="text-center py-12 text-text-muted text-xs font-mono animate-pulse">Loading audit trail...</div>
            ) : activityEvents.length === 0 ? (
              <div className="text-center py-16 text-text-muted text-xs">
                <Activity className="w-8 h-8 opacity-20 mx-auto mb-2" />
                <p>No activity events recorded in Supabase yet.</p>
                <p className="text-[10px] opacity-60 mt-1">Events will populate automatically as workflows execute.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {activityEvents.map((evt, i) => (
                  <div key={evt.id || i} className="p-3 rounded-lg bg-surface-elevated border border-border/70 flex items-start gap-3 hover:border-border transition-colors">
                    <div className="mt-0.5 p-1.5 rounded bg-background border border-border/50 flex-shrink-0">
                      {getEventIcon(evt.event_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-bold text-foreground truncate">
                          {evt.event_type}
                        </span>
                        <span className="text-[10px] text-text-muted font-mono whitespace-nowrap">
                          {evt.created_at ? format(new Date(evt.created_at), 'MMM d, yyyy • h:mm:ss a') : ''}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                        {evt.message}
                      </p>
                      {evt.video_library?.title && (
                        <div className="text-[10px] text-accent/80 font-mono mt-1 truncate">
                          Video: "{evt.video_library.title}"
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="flex-1 min-h-0 overflow-hidden flex flex-col bg-[#0a0a0a] border-border">
          <div className="bg-surface-elevated px-4 py-2 border-b border-border flex items-center gap-2 shrink-0">
            <Terminal className="w-4 h-4 text-accent" />
            <span className="text-xs font-mono text-text-muted">reelgrab_audit.log</span>
          </div>
          <CardContent className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1">
            {isLoading ? (
              <div className="text-text-muted">Loading logs...</div>
            ) : rawLogs.length === 0 ? (
              <div className="text-text-muted">No raw log entries found.</div>
            ) : (
              rawLogs.map((logLine, i) => (
                <div key={i} className="text-text-muted/90 hover:text-foreground font-mono text-[11px] leading-relaxed py-0.5 border-b border-white/[0.02]">
                  {logLine}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

