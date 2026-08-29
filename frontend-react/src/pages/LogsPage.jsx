import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard';
import { Card, CardContent } from '../components/ui/Card';
import { Terminal, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button';

export default function LogsPage() {
  const { data: logsData, isLoading, refetch } = useQuery({
    queryKey: ['dashboardLogs'],
    queryFn: dashboardApi.getLogs,
    refetchInterval: 10000,
  });

  const logs = logsData?.logs || [];

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col space-y-4">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">System Logs</h2>
          <p className="text-text-muted">Real-time audit trailing from the backend pipeline.</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden flex flex-col bg-[#0a0a0a] border-border">
        <div className="bg-surface-elevated px-4 py-2 border-b border-border flex items-center gap-2 shrink-0">
          <Terminal className="w-4 h-4 text-accent" />
          <span className="text-xs font-mono text-text-muted">backend/automate.log</span>
        </div>
        <CardContent className="flex-1 overflow-y-auto p-4 font-mono text-xs">
          {isLoading ? (
            <div className="text-text-muted">Loading logs...</div>
          ) : logs.length === 0 ? (
            <div className="text-text-muted">No logs recorded yet.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-muted-foreground">
                  <th className="py-2 px-4 font-normal w-24">Date</th>
                  <th className="py-2 px-4 font-normal w-24">Time</th>
                  <th className="py-2 px-4 font-normal w-24">Level</th>
                  <th className="py-2 px-4 font-normal">Message</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => {
                  const d = new Date(log.timestamp);
                  return (
                    <tr key={i} className="hover:bg-white/5 border-b border-white/5 transition-colors">
                      <td className="py-2 px-4 text-muted-foreground whitespace-nowrap">{d.toLocaleDateString()}</td>
                      <td className="py-2 px-4 text-muted-foreground whitespace-nowrap">{d.toLocaleTimeString()}</td>
                      <td className={`py-2 px-4 whitespace-nowrap ${
                        log.level === 'ERROR' ? 'text-danger' : 
                        log.level === 'WARN' ? 'text-warning' : 
                        'text-success'
                      }`}>{log.level}</td>
                      <td className="py-2 px-4 text-text whitespace-pre-wrap">{log.message}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
