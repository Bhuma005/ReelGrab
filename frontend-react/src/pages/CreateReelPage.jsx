import React from 'react';
import { useVideoStore } from '../stores/videoStore';
import { useAppStore } from '../stores/appStore';
import { metadataApi } from '../api/metadata';
import { videosApi } from '../api/videos';
import { automationApi } from '../api/automation';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { toast } from 'sonner';
import { Loader2, Download, Wand2, MonitorPlay, Play, Check, Sparkles, CheckCircle2, RotateCcw, XCircle, Clock, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

export default function CreateReelPage() {
  const store = useVideoStore();
  const appStore = useAppStore();
  
  const [isLoading, setIsLoading] = React.useState(false);
  const [isAutomating, setIsAutomating] = React.useState(false);
  const [automationResult, setAutomationResult] = React.useState(null);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);

  const pollTimerRef = React.useRef(null);
  const stopwatchRef = React.useRef(null);

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (stopwatchRef.current) {
      clearInterval(stopwatchRef.current);
      stopwatchRef.current = null;
    }
  };

  React.useEffect(() => {
    return () => stopPolling();
  }, []);

  const startAiAnalysis = async (title, description, videoUrl) => {
    stopPolling();
    setElapsedSeconds(0);
    stopwatchRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);

    store.setAiAnalysisStatus('loading');
    store.setAiJobProgress(null, 15, 'Queued for background analysis...');

    try {
      const initRes = await metadataApi.analyze(title, description, videoUrl);
      if (!initRes) {
        store.setAiAnalysisStatus('error', 'Failed to initialize AI analysis');
        return;
      }

      if (initRes.status === 'COMPLETED' && initRes.result) {
        store.setAiAnalysisResult(initRes.result);
        if (initRes.cached) {
          toast.success("⚡ Instant AI optimization loaded from cache!");
        }
        return;
      }

      const jobId = initRes.job_id;
      if (!jobId) {
        store.setAiAnalysisStatus('error', 'No job ID received from server');
        return;
      }

      store.setAiJobProgress(jobId, initRes.progress || 15, initRes.current_step || 'Processing video...');

      // Start Polling every 1.5 seconds
      let pollCount = 0;
      const MAX_POLLS = 200; // ~300 seconds timeout limit

      pollTimerRef.current = setInterval(async () => {
        pollCount++;
        if (pollCount > MAX_POLLS) {
          stopPolling();
          store.setAiAnalysisStatus('timeout', 'AI analysis timed out after 5 minutes.');
          return;
        }

        try {
          const statusRes = await metadataApi.getAnalysisStatus(jobId);
          if (!statusRes) return;

          if (statusRes.status === 'COMPLETED' && statusRes.result) {
            stopPolling();
            store.setAiAnalysisResult(statusRes.result);
            toast.success("✨ AI Content Optimization complete!");
          } else if (statusRes.status === 'FAILED') {
            stopPolling();
            store.setAiAnalysisStatus('error', statusRes.error || 'AI analysis failed');
          } else if (statusRes.status === 'CANCELLED') {
            stopPolling();
            store.setAiAnalysisStatus('cancelled', 'AI analysis was cancelled');
          } else {
            store.setAiJobProgress(jobId, statusRes.progress || 20, statusRes.current_step || 'Working...');
          }
        } catch (pollErr) {
          console.warn("Polling error:", pollErr);
        }
      }, 1500);

    } catch (err) {
      console.error(err);
      store.setAiAnalysisStatus('error', err.message || 'Failed to start AI optimization');
    }
  };

  const handleCancelAi = async () => {
    stopPolling();
    if (store.aiJobId) {
      try {
        await metadataApi.cancelAnalysis(store.aiJobId);
      } catch (e) {
        console.warn("Cancel request failed", e);
      }
    }
    store.setAiAnalysisStatus('cancelled', 'AI analysis was cancelled.');
    toast.info("AI Analysis cancelled");
  };

  const handleRetryAi = () => {
    if (store.metadata?.title || store.metadata?.description || store.url) {
      startAiAnalysis(store.metadata?.title, store.metadata?.description, store.url);
    } else {
      handleFetch();
    }
  };

  const handleContinueWithoutAi = () => {
    stopPolling();
    const fallbackTitle = store.metadata?.title || 'Trending Reel';
    const fallbackDesc = store.metadata?.description || '';
    const fallbackTags = store.allHashtags && store.allHashtags.length > 0 ? store.allHashtags : ['#Shorts', '#Viral', '#Trending'];
    
    store.setAiAnalysisResult({
      viral_title: fallbackTitle,
      optimized_description: fallbackDesc,
      youtube: fallbackTags,
      instagram: fallbackTags,
      analysis: "Using original video metadata (bypassed AI model).",
      confidence_notes: "MANUAL",
      scheduled_time: "07:30 PM",
      raw_result: {
        title: fallbackTitle,
        description: fallbackDesc,
        youtube_hashtags: fallbackTags,
        instagram_hashtags: fallbackTags,
        title_candidates: [{ strategy: 'Original Source', title: fallbackTitle }],
        viewer_appeal_score: 75,
        title_reason: ['Original Source Metadata'],
        posting_recommendation: {
          human_readable_time: "07:30 PM",
          reason: "Standard evening posting slot."
        }
      }
    });
    toast.info("Proceeding with standard metadata");
  };

  const handleFetch = async () => {
    if (!store.url.trim()) return;
    
    setIsLoading(true);
    stopPolling();
    store.resetWorkflow(); // clears previous results but we need the url back
    const targetUrl = store.url.trim();
    store.setUrl(targetUrl);
    
    try {
      // 1. Fetch Formats
      const formatsPromise = metadataApi.getFormats(targetUrl);
      
      // 2. Fetch Metadata
      const metadataPromise = metadataApi.getMetadata(targetUrl);
      
      // 3. Fetch Comments
      const commentsPromise = metadataApi.getComments(targetUrl);

      // Handle Metadata eagerly
      metadataPromise.then(meta => {
        if (!meta) return;
        store.setMetadata(meta);
        const tags = meta.hashtags || [];
        if (tags.length > 0) store.setAllHashtags(tags);

        if (meta.title || meta.description || targetUrl) {
          startAiAnalysis(meta.title, meta.description, targetUrl);
        }
      });

      // Handle Comments eagerly
      commentsPromise.then(comm => {
        if (comm?.available && comm.hashtags?.length > 0) {
          store.setAllHashtags([...new Set([...useVideoStore.getState().allHashtags, ...comm.hashtags])]);
        }
      });

      const formats = await formatsPromise;
      store.setFormats(formats);

    } catch (err) {
      toast.error(err.message || "Failed to fetch video details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (formatId) => {
    toast.promise(
      videosApi.downloadVideo(store.url, formatId).then(r => videosApi.handleFileDownload(r)),
      {
        loading: 'Starting download...',
        success: 'Download started!',
        error: 'Download failed'
      }
    );
  };

  const triggerAutomation = async () => {
    if (!appStore.isYtAuthenticated) {
      toast.error("Please connect YouTube first in Settings/Connections");
      return;
    }
    
    setIsAutomating(true);
    try {
      const payload = {
        title: store.aiAnalysisResult?.viral_title || store.metadata.title || 'Untitled',
        description: store.aiAnalysisResult?.optimized_description || store.metadata.description || '',
        hashtags: store.allHashtags || [],
        thumbnail_url: store.metadata.thumbnail_url || '',
        url: store.url,
        opus_mode: store.isOpusMode,
        iso_schedule: store.aiAnalysisResult?.raw_result?.posting_recommendation?.iso_time || store.aiAnalysisResult?.iso_schedule || null,
        scheduled_time_human: store.aiAnalysisResult?.scheduled_time || null
      };
      
      const res = await automationApi.triggerAutomation(payload);
      setAutomationResult(res.automation_details);
      toast.success("Scheduled successfully to Cloud!");
    } catch (err) {
      toast.error(err.message || "Automation failed");
    } finally {
      setIsAutomating(false);
    }
  };

  const hasResults = store.metadata || store.formats.length > 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-3xl font-black uppercase tracking-tighter">New Workflow</h1>
        <p className="text-text-muted">Paste a Reel link to extract metadata, download, or schedule to YouTube.</p>
      </div>

      <div className="flex gap-2">
        <input 
          type="text" 
          value={store.url}
          onChange={(e) => store.setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
          placeholder="https://instagram.com/reel/..."
          className="flex-1 bg-surface-elevated border border-border rounded-md px-4 py-3 focus:outline-none focus:border-accent transition-colors font-mono text-sm"
          disabled={isLoading || isAutomating}
        />
        <Button onClick={handleFetch} disabled={isLoading || isAutomating || !store.url} className="h-auto px-8">
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Load"}
        </Button>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12 text-accent">
          <Loader2 className="w-10 h-10 animate-spin mb-4" />
          <p className="text-sm font-semibold tracking-widest uppercase">Processing Media...</p>
        </div>
      )}

      {hasResults && !isLoading && (
        <div className="grid gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Metadata & Preview Section */}
          <div className="grid md:grid-cols-[300px_1fr] gap-6">
            <Card className="overflow-hidden border-border/50">
              <div className="aspect-[9/16] bg-black relative">
                {store.metadata?.thumbnail_url ? (
                  <img src={store.metadata.thumbnail_url} alt="Thumbnail" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-text-muted">No Preview</div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-xs font-bold text-white line-clamp-2 leading-snug">{store.metadata?.title || 'Video Title'}</p>
                </div>
              </div>
              <div className="p-3 grid gap-2">
                <Button variant="secondary" className="w-full text-xs" onClick={() => handleDownload(store.formats[0]?.format_id)}>
                  <Download className="w-4 h-4 mr-2" /> Download MP4
                </Button>
                <Button variant="ghost" className="w-full text-xs" onClick={() => videosApi.downloadThumbnail(store.url)}>
                  Download Cover
                </Button>
              </div>
            </Card>

            <div className="space-y-6">
              {/* REELGRAB AI WORKFLOW */}
              {store.aiAnalysisResult?.agent_workflow_state && (
                <Card className="border-accent/30 overflow-hidden shadow-[0_0_15px_rgba(255,107,43,0.1)]">
                  <div className="bg-accent/10 border-b border-accent/20 px-4 py-3 flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-accent" />
                    <span className="font-bold text-xs tracking-wider text-accent">REELGRAB AI WORKFLOW</span>
                  </div>
                  <div className="p-4 space-y-2 text-sm font-mono text-text-muted">
                    <div className="flex items-center gap-2">
                      <span className={store.aiAnalysisResult.agent_workflow_state.video?.status === 'success' ? 'text-success' : 'text-warning'}>✓</span> Video analyzed
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-success">✓</span> Transcript generated
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={store.aiAnalysisResult.agent_workflow_state.content?.status === 'success' ? 'text-success' : 'text-warning'}>✓</span> Content understood
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={store.aiAnalysisResult.agent_workflow_state.metadata?.status === 'success' ? 'text-success' : 'text-warning'}>✓</span> Metadata generated
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={store.aiAnalysisResult.agent_workflow_state.analytics?.reasoning ? 'text-success' : 'text-warning'}>✓</span> Analytics analyzed
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={store.aiAnalysisResult.agent_workflow_state.posting?.status ? 'text-success' : 'text-warning'}>✓</span> Best posting slot calculated
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={store.aiAnalysisResult.agent_workflow_state.validation?.status === 'passed' ? 'text-success' : 'text-error'}>
                        {store.aiAnalysisResult.agent_workflow_state.validation?.status === 'passed' ? '✓' : '✗'}
                      </span> Validation {store.aiAnalysisResult.agent_workflow_state.validation?.status === 'passed' ? 'passed' : 'failed'}
                    </div>
                    <div className="pt-3 mt-2 border-t border-border/50 text-accent font-bold">
                      {store.aiAnalysisResult.agent_workflow_state.validation?.status === 'passed' ? 'READY TO SCHEDULE' : 'VALIDATION BLOCKED'}
                    </div>
                  </div>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-3 border-b border-border/50 bg-accent/5">
                  <CardTitle className="text-sm font-bold tracking-wider text-accent flex items-center gap-2">
                    <Wand2 className="w-4 h-4" /> AI CONTENT OPTIMIZATION
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-6">
                  {store.aiAnalysisResult ? (
                    <>
                      {/* Best Title */}
                      <div className="space-y-2 bg-accent/5 p-4 rounded-lg border border-accent/20">
                        <div className="flex justify-between items-center pb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase text-text-muted font-bold tracking-wider">VIRAL TITLE</span>
                            {store.aiAnalysisResult.source_label ? (
                              <span className={`text-[9px] px-2 py-0.5 rounded border font-medium ${
                                store.aiAnalysisResult.video_analyzed || store.aiAnalysisResult.analysis_source === 'video_visual' || store.aiAnalysisResult.analysis_source === 'video_audio'
                                  ? 'bg-success/20 text-success border-success/30'
                                  : 'bg-warning/20 text-warning border-warning/30'
                              }`}>
                                {store.aiAnalysisResult.source_label}
                              </span>
                            ) : store.aiAnalysisResult.ai_failed ? (
                              <span className="text-[9px] bg-warning/20 text-warning px-2 py-0.5 rounded border border-warning/30 font-medium">
                                From caption — video analysis unavailable
                              </span>
                            ) : (
                              <span className="text-[9px] bg-success/20 text-success px-2 py-0.5 rounded border border-success/30 font-medium">
                                Based on video analysis
                              </span>
                            )}
                          </div>
                          {store.aiAnalysisResult.raw_result?.viewer_appeal_score && (
                            <div className="text-xs font-mono font-bold text-accent">Viewer Appeal: {store.aiAnalysisResult.raw_result.viewer_appeal_score}/100</div>
                          )}
                        </div>
                        <div className="text-base font-bold text-foreground">"{store.aiAnalysisResult.viral_title}"</div>
                        
                        {store.aiAnalysisResult.raw_result?.title_reason && (
                          <div className="pt-2 mt-2 border-t border-accent/10 flex flex-wrap gap-x-3 gap-y-1">
                            {store.aiAnalysisResult.raw_result.title_reason.map((reason, i) => (
                              <div key={i} className="text-xs text-text-muted flex items-center gap-1.5">
                                <span className="text-success">✓</span> {reason}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Description */}
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] uppercase text-text-muted font-bold tracking-wider">SEARCH-OPTIMIZED DESCRIPTION</div>
                          <Button 
                            variant="ghost" 
                            className="h-5 px-2 text-[10px] text-text-muted hover:text-foreground"
                            onClick={() => {
                              navigator.clipboard.writeText(store.aiAnalysisResult.optimized_description || "");
                              toast.success("Description copied to clipboard!");
                            }}
                          >
                            Copy description
                          </Button>
                        </div>
                        <div className="text-xs text-foreground/90 bg-surface-elevated p-3.5 rounded-lg border border-border/60 leading-relaxed whitespace-pre-line font-sans">
                          {store.aiAnalysisResult.optimized_description}
                        </div>
                      </div>

                      {/* Dedicated Hashtags Section */}
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase text-text-muted font-bold tracking-wider">HASHTAGS</span>
                            <span className="text-[10px] bg-surface px-2 py-0.5 rounded-full border border-border font-mono text-text-muted">
                              {(store.aiAnalysisResult.youtube || []).length} tags
                            </span>
                          </div>
                          <Button 
                            variant="ghost" 
                            className="h-6 px-2.5 text-xs bg-surface hover:bg-surface-elevated text-accent border border-border/80 flex items-center gap-1"
                            onClick={() => {
                              const tags = (store.aiAnalysisResult.youtube || []).join(' ');
                              navigator.clipboard.writeText(tags);
                              toast.success(`Copied ${(store.aiAnalysisResult.youtube || []).length} hashtags!`);
                            }}
                          >
                            Copy all
                          </Button>
                        </div>

                        {/* Editable / Removable Hashtag Chips */}
                        <div className="flex flex-wrap gap-1.5 p-3 bg-surface rounded-lg border border-border/60 min-h-[50px]">
                          {(store.aiAnalysisResult.youtube || []).map((tag, idx) => (
                            <span 
                              key={idx} 
                              className="group text-xs px-2.5 py-1 bg-surface-elevated hover:bg-surface-elevated/80 text-accent border border-accent/20 rounded-full flex items-center gap-1 transition-all"
                            >
                              <span>{tag}</span>
                              <button 
                                type="button"
                                className="w-3.5 h-3.5 rounded-full hover:bg-danger/20 hover:text-danger text-text-muted inline-flex items-center justify-center text-[10px] transition-colors ml-0.5"
                                title="Remove tag"
                                onClick={() => {
                                  const updated = (store.aiAnalysisResult.youtube || []).filter((_, i) => i !== idx);
                                  store.setAiAnalysisResult({
                                    ...store.aiAnalysisResult,
                                    youtube: updated,
                                    instagram: updated
                                  });
                                }}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Recommended Publish */}
                      <div className="border-t border-border/50 pt-4 space-y-2">
                        <div className="text-[10px] uppercase text-text-muted font-bold tracking-wider flex items-center justify-between">
                          <span className="flex items-center gap-1">🗓 POSTING INTELLIGENCE</span>
                          {store.aiAnalysisResult.raw_result?.posting_recommendation?.data_status === 'INSUFFICIENT_DATA' && (
                            <span className="text-[9px] bg-warning/20 text-warning px-1.5 py-0.5 rounded border border-warning/30">TESTING MODE</span>
                          )}
                        </div>
                        
                        <div className="bg-surface border border-border p-3 rounded space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-bold text-sm text-success">{store.aiAnalysisResult.scheduled_time} {store.aiAnalysisResult.raw_result?.posting_recommendation?.timezone || 'IST'}</div>
                              <div className="text-xs text-text-muted mt-0.5 flex gap-2">
                                <span>Score: <span className="font-mono text-accent">{store.aiAnalysisResult.raw_result?.posting_recommendation?.score || '--'}</span></span>
                                <span>•</span>
                                <span>Confidence: <span className="font-bold">{store.aiAnalysisResult.raw_result?.posting_recommendation?.confidence?.toUpperCase() || 'LOW'}</span></span>
                              </div>
                            </div>
                          </div>

                          <div className="text-xs text-text-muted italic bg-background p-2 rounded border-l-2 border-accent">
                            {store.aiAnalysisResult.analysis || store.aiAnalysisResult.raw_result?.posting_recommendation?.reason || "Based on audience activity and historical performance."}
                          </div>

                          {store.aiAnalysisResult.raw_result?.posting_recommendation?.alternatives && store.aiAnalysisResult.raw_result.posting_recommendation.alternatives.length > 0 && (
                            <div className="pt-2 border-t border-border/50">
                              <div className="text-[10px] uppercase text-text-muted font-bold mb-1">Alternative Slots</div>
                              <div className="flex flex-col gap-1">
                                {store.aiAnalysisResult.raw_result.posting_recommendation.alternatives.slice(0,2).map((alt, i) => (
                                  <div key={i} className="text-xs flex justify-between text-text-muted">
                                    <span>{alt.time}</span>
                                    <span className="font-mono opacity-70">Score: {alt.score}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 mt-3">
                          <Button variant="outline" className="flex-1 text-xs h-8">Edit Metadata</Button>
                          <Button 
                            className="flex-1 text-xs h-8 bg-accent text-black hover:bg-accent/90"
                            onClick={triggerAutomation}
                            disabled={isAutomating || !appStore.isYtAuthenticated}
                          >
                            {isAutomating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Schedule"}
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : store.aiAnalysisStatus === 'loading' ? (
                    <div className="space-y-4 p-3 bg-surface-elevated/40 rounded-lg border border-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-accent font-semibold text-xs tracking-wider uppercase">
                          <Sparkles className="w-4 h-4 animate-spin text-accent" />
                          <span>AI Content Optimization</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-text-muted bg-background/80 px-2 py-0.5 rounded border border-border">
                            ⏱ Elapsed: {elapsedSeconds}s
                          </span>
                          <span className="text-xs font-mono font-bold bg-accent/15 text-accent px-2 py-0.5 rounded border border-accent/30">
                            {store.aiProgress}%
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-surface h-2 rounded-full overflow-hidden border border-border/80">
                        <div 
                          className="bg-gradient-to-r from-accent via-[#e5a955] to-accent h-full transition-all duration-500 rounded-full"
                          style={{ width: `${Math.max(store.aiProgress, 8)}%` }}
                        />
                      </div>

                      {/* 5-Step Staged Interface */}
                      <div className="space-y-2 text-xs font-mono">
                        <div className="flex items-center gap-2.5">
                          {store.aiProgress >= 20 ? (
                            <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5 text-accent animate-spin flex-shrink-0" />
                          )}
                          <span className={store.aiProgress >= 20 ? "text-foreground font-medium" : "text-text-muted"}>
                            Inspecting video footage & key frames
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5">
                          {store.aiProgress >= 40 ? (
                            <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                          ) : store.aiProgress >= 20 ? (
                            <RefreshCw className="w-3.5 h-3.5 text-accent animate-spin flex-shrink-0" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border border-border flex items-center justify-center text-[9px] text-text-muted">○</div>
                          )}
                          <span className={store.aiProgress >= 40 ? "text-foreground font-medium" : "text-text-muted"}>
                            Extracting visual frames & spoken dialogue
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5">
                          {store.aiProgress >= 60 ? (
                            <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                          ) : store.aiProgress >= 40 ? (
                            <RefreshCw className="w-3.5 h-3.5 text-accent animate-spin flex-shrink-0" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border border-border flex items-center justify-center text-[9px] text-text-muted">○</div>
                          )}
                          <span className={store.aiProgress >= 60 ? "text-foreground font-medium" : "text-text-muted"}>
                            Analyzing visual scene & emotional retention hooks
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5">
                          {store.aiProgress >= 80 ? (
                            <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                          ) : store.aiProgress >= 60 ? (
                            <RefreshCw className="w-3.5 h-3.5 text-accent animate-spin flex-shrink-0" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border border-border flex items-center justify-center text-[9px] text-text-muted">○</div>
                          )}
                          <span className={store.aiProgress >= 80 ? "text-foreground font-medium" : "text-text-muted"}>
                            Writing algorithm-grounded viral title & description
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5">
                          {store.aiProgress >= 100 ? (
                            <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                          ) : store.aiProgress >= 80 ? (
                            <RefreshCw className="w-3.5 h-3.5 text-accent animate-spin flex-shrink-0" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border border-border flex items-center justify-center text-[9px] text-text-muted">○</div>
                          )}
                          <span className={store.aiProgress >= 100 ? "text-foreground font-medium" : "text-text-muted"}>
                            Optimizing guaranteed hashtag bundle (≥7 tags)
                          </span>
                        </div>
                      </div>

                      {/* Current message and Action buttons */}
                      <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                        <p className="text-[11px] text-text-muted truncate font-mono">
                          {store.aiStepMessage || "Processing with local LLM..."}
                        </p>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 text-xs text-danger hover:bg-danger/10 flex items-center gap-1"
                            onClick={handleCancelAi}
                          >
                            <XCircle className="w-3.5 h-3.5" /> Cancel
                          </Button>
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="h-7 text-xs bg-accent text-black hover:bg-accent/90"
                            onClick={handleContinueWithoutAi}
                          >
                            Skip AI
                          </Button>
                        </div>
                      </div>

                      <div className="bg-background/80 p-2.5 rounded border border-border/60 text-[11px] text-text-muted">
                        💡 <strong>Non-blocking:</strong> You can download formats or configure schedule settings below while AI runs in background.
                      </div>
                    </div>
                  ) : store.aiAnalysisStatus === 'cancelled' ? (
                    <div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
                      <div className="w-10 h-10 rounded-full bg-surface-elevated flex items-center justify-center text-text-muted mb-1">
                        <XCircle className="w-5 h-5" />
                      </div>
                      <h3 className="font-bold text-sm">AI Analysis Cancelled</h3>
                      <p className="text-xs text-text-muted max-w-[280px]">You stopped the background AI worker. You can restart AI or proceed with standard video metadata.</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleRetryAi} className="text-xs">
                          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restart AI
                        </Button>
                        <Button variant="secondary" size="sm" onClick={handleContinueWithoutAi} className="text-xs bg-accent text-black hover:bg-accent/90">
                          Continue Without AI
                        </Button>
                      </div>
                    </div>
                  ) : store.aiAnalysisStatus === 'timeout' ? (
                    <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
                      <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center text-warning mb-2">
                        <Clock className="w-5 h-5" />
                      </div>
                      <h3 className="font-bold text-sm">AI Optimization Timed Out</h3>
                      <p className="text-xs text-text-muted max-w-[280px]">{store.aiAnalysisError || "The AI took too long to respond. You can retry or proceed using existing video details."}</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleRetryAi} className="text-xs">
                          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Try Again
                        </Button>
                        <Button variant="secondary" size="sm" onClick={handleContinueWithoutAi} className="text-xs bg-accent text-black hover:bg-accent/90">
                          Continue Without AI
                        </Button>
                      </div>
                    </div>
                  ) : store.aiAnalysisStatus === 'error' ? (
                    <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
                      <div className="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center text-danger mb-2">
                        <span className="text-xl">⚠️</span>
                      </div>
                      <h3 className="font-bold text-sm">AI Optimization Failed</h3>
                      <p className="text-xs text-text-muted max-w-[280px]">{store.aiAnalysisError || "An error occurred while generating metadata."}</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleRetryAi} className="text-xs">
                          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Retry AI
                        </Button>
                        <Button variant="secondary" size="sm" onClick={handleContinueWithoutAi} className="text-xs bg-accent text-black hover:bg-accent/90">
                          Continue Without AI
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {/* Automation Box */}
              <Card className="border-accent/30 bg-accent/5">
                <CardHeader className="pb-3 border-b border-accent/10">
                  <CardTitle className="text-sm font-bold tracking-wider text-accent flex items-center justify-between">
                    <div className="flex items-center gap-2"><MonitorPlay className="w-4 h-4" /> Cloud Publisher</div>
                    {appStore.isYtAuthenticated && <span className="text-[10px] bg-success/20 text-success px-2 py-1 rounded-full border border-success/30">Connected</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="flex items-center justify-between p-3 bg-background rounded border border-border">
                    <div>
                      <div className="text-sm font-medium text-accent">OpusClip Engine</div>
                      <div className="text-xs text-text-muted">Auto-generate animated captions</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={store.isOpusMode} onChange={e => store.setIsOpusMode(e.target.checked)} />
                      <div className="w-11 h-6 bg-surface-elevated peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent border border-border"></div>
                    </label>
                  </div>

                  {automationResult ? (
                    <div className="bg-success/10 border border-success/30 p-4 rounded-md space-y-2">
                      <div className="flex items-center gap-2 text-success font-bold text-sm">
                        <Check className="w-4 h-4" /> Pipeline Scheduled
                      </div>
                      <div className="text-xs text-success/80">
                        Posting at: <strong>{automationResult.scheduled_time}</strong>
                      </div>
                    </div>
                  ) : (
                    <Button 
                      className="w-full font-bold uppercase tracking-wider h-12 bg-gradient-to-r from-accent to-[#C88A3B] text-black hover:opacity-90"
                      onClick={triggerAutomation}
                      disabled={isAutomating || !appStore.isYtAuthenticated}
                    >
                      {isAutomating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Deploy to YouTube Shorts"}
                    </Button>
                  )}
                  
                  {!appStore.isYtAuthenticated && (
                    <p className="text-xs text-danger text-center font-medium">Link YouTube in Connections before publishing.</p>
                  )}
                </CardContent>
              </Card>

            </div>
          </div>
          
          {/* Formats Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Available Formats</CardTitle>
            </CardHeader>
            <div className="divide-y divide-border">
              {store.formats.map((f, idx) => (
                <div key={f.format_id} className={`flex items-center justify-between p-4 transition-colors cursor-pointer group ${f.is_original ? 'bg-accent/10 border-l-4 border-accent hover:bg-accent/20' : 'hover:bg-surface-elevated'}`} onClick={() => handleDownload(f.format_id)}>
                  <div className="flex items-center gap-4">
                    <div className={cn("w-16 text-center text-[10px] font-bold py-1.5 rounded uppercase tracking-wider", f.is_original ? "bg-accent text-black" : "bg-surface border border-border text-text-muted")}>
                      {f.is_original ? 'ORIGINAL' : f.ext}
                    </div>
                    <div>
                      <div className="text-sm font-bold flex items-center gap-2">
                        {f.is_original ? '✓ Original Source' : 'Alternative Format'}
                        {f.is_original && <span className="text-[10px] bg-success/20 text-success px-2 py-0.5 rounded-full border border-success/30 font-normal">Source Quality</span>}
                      </div>
                      <div className="text-xs text-text-muted mt-1 font-mono">
                        {f.resolution} • {f.aspect_ratio} • {f.fps} FPS
                        {f.is_original && ' • No crop • No resize'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono">{f.filesize ? (f.filesize / 1024 / 1024).toFixed(1) + ' MB' : '???'}</div>
                    <div className="text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 justify-end mt-1">
                      <Download className="w-3 h-3" /> {f.is_original ? 'Download Original' : 'Download'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {store.formats.length > 0 && (
              <div className="p-4 border-t border-border bg-background/50">
                <div className="text-sm font-medium mb-2">Need a different shape?</div>
                <Button variant="outline" className="w-full text-xs">
                  <Wand2 className="w-3 h-3 mr-2" /> Convert / Reframe (Coming Soon)
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
