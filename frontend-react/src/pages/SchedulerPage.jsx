import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { format, isFuture, isPast } from 'date-fns';
import { Calendar as CalendarIcon, Clock, Wand2, Info } from 'lucide-react';

const HEATMAP_ROWS = [
  { time: '06:00', vals: [0, 0, 0, 0, 0, 0, 0] },
  { time: '09:00', vals: [0, 1, 1, 0, 1, 1, 0] },
  { time: '12:00', vals: [1, 1, 1, 1, 1, 2, 1] },
  { time: '15:00', vals: [0, 1, 1, 1, 2, 2, 1] },
  { time: '18:00', vals: [2, 2, 2, 2, 2, 2, 2] },
  { time: '20:00', vals: [2, 2, 2, 2, 3, 3, 2] },
  { time: '22:00', vals: [1, 1, 1, 1, 2, 2, 1] },
];
const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

function getColor(val) {
  if (val === 3) return 'bg-accent text-black'; // Best
  if (val === 2) return 'bg-accent/70 text-black'; // Strong
  if (val === 1) return 'bg-accent/30 text-accent'; // Moderate
  return 'bg-surface border border-border/50 text-text-muted'; // Weak
}

export default function SchedulerPage() {
  const { data: videosData, isLoading: isLoadingVideos } = useQuery({
    queryKey: ['dashboardVideos'],
    queryFn: dashboardApi.getVideos,
  });
  
  const { data: recommendation, isLoading: isLoadingRec } = useQuery({
    queryKey: ['schedulerRecommendation'],
    queryFn: dashboardApi.getRecommendation,
  });

  const videos = (videosData?.videos || []).filter(v => v.scheduled_time).sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Timeline Scheduler</h2>
        <p className="text-text-muted">Chronological view of your upcoming and past publications.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recommendation Panel */}
        <Card className="border-accent/30 bg-accent/5">
          <CardHeader className="pb-3 border-b border-accent/10">
            <CardTitle className="text-sm font-bold tracking-wider text-accent flex items-center justify-between">
              <span className="flex items-center gap-2"><Wand2 className="w-4 h-4" /> AI RECOMMENDED PUBLISH TIME</span>
              {recommendation?.data_status === 'INSUFFICIENT_DATA' && (
                <span className="text-[9px] bg-warning/20 text-warning px-1.5 py-0.5 rounded border border-warning/30">TESTING MODE</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {isLoadingRec ? (
              <div className="text-sm text-text-muted">Loading intelligence...</div>
            ) : recommendation ? (
              <>
                <div>
                  <div className="text-sm font-medium text-text-muted">{recommendation.recommended_date}</div>
                  <div className="text-2xl font-bold text-success mt-1">{recommendation.recommended_time} <span className="text-sm">{recommendation.timezone}</span></div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <div className="text-[10px] uppercase text-text-muted font-bold tracking-wider">Score</div>
                    <div className="font-mono text-accent">{recommendation.score}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-text-muted font-bold tracking-wider">Confidence</div>
                    <div className="font-bold">{recommendation.confidence.toUpperCase()}</div>
                  </div>
                </div>

                <div className="text-xs bg-surface-elevated p-3 rounded border-l-2 border-accent">
                  <div className="font-bold mb-1">Based on:</div>
                  <ul className="list-disc pl-4 space-y-0.5 text-text-muted">
                    <li>Audience activity</li>
                    <li>Historical Shorts performance</li>
                    <li>Day & Hour performance</li>
                  </ul>
                  <div className="mt-2 italic opacity-80">{recommendation.reason}</div>
                </div>
              </>
            ) : (
              <div className="text-sm text-text-muted">Unavailable</div>
            )}
          </CardContent>
        </Card>

        {/* Heatmap Panel */}
        <Card>
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-bold tracking-wider text-text-muted flex items-center justify-between">
              PERFORMANCE HEATMAP
              {recommendation?.data_status === 'INSUFFICIENT_DATA' && (
                 <Info className="w-4 h-4 text-warning" title="Collect more data" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {recommendation?.data_status === 'INSUFFICIENT_DATA' ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-text-muted">
                <CalendarIcon className="w-8 h-8 mb-3 opacity-30" />
                <p className="text-sm font-medium">Collect more data</p>
                <p className="text-xs mt-1 max-w-[200px]">Publish more shorts to unlock personalized performance heatmaps.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[300px]">
                  <div className="grid grid-cols-8 gap-1 mb-1">
                    <div></div>
                    {DAYS.map(d => <div key={d} className="text-[9px] font-bold text-center text-text-muted">{d}</div>)}
                  </div>
                  <div className="space-y-1">
                    {HEATMAP_ROWS.map((row, i) => (
                      <div key={i} className="grid grid-cols-8 gap-1 items-center">
                        <div className="text-[9px] font-mono text-text-muted text-right pr-2">{row.time}</div>
                        {row.vals.map((v, j) => (
                          <div key={j} className={`h-6 rounded-sm ${getColor(v)}`} title={DAYS[j] + ' ' + row.time} />
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-4 mt-4 justify-center text-[9px] font-bold text-text-muted">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-accent"></div> Best</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-accent/70"></div> Strong</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-accent/30"></div> Mod</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-surface border border-border/50"></div> Weak</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoadingVideos ? (
            <div className="p-12 text-center text-text-muted">Loading timeline...</div>
          ) : videos.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <CalendarIcon className="w-10 h-10 text-muted-foreground mb-4 opacity-50" />
              <p className="text-sm font-medium">No scheduled posts</p>
            </div>
          ) : (
            <div className="relative border-l border-border ml-6 my-8 space-y-8">
              {videos.map(video => {
                const date = new Date(video.scheduled_time);
                const isUpcoming = isFuture(date);
                
                return (
                  <div key={video.id} className="relative pl-8 pr-4">
                    <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-background ${isUpcoming ? 'bg-accent' : 'bg-success'}`} />
                    <div className="bg-surface-elevated border border-border p-4 rounded-lg">
                      <div className="flex items-center gap-2 text-xs font-bold mb-2">
                        <Clock className="w-3 h-3 text-text-muted" />
                        <span className={isUpcoming ? 'text-accent' : 'text-success'}>
                          {format(date, 'MMM d, yyyy - h:mm a')}
                        </span>
                        <span className="text-muted-foreground font-normal ml-auto">
                          {isUpcoming ? 'Upcoming' : 'Published'}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold">{video.title}</h4>
                      <p className="text-xs text-text-muted mt-1 line-clamp-2">{video.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
