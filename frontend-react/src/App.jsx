import { useState, useEffect, useRef } from 'react'

const API_BASE = '';

export default function App() {
  // Global State
  const [url, setUrl] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Results State
  const [metadata, setMetadata] = useState(null);
  const [formats, setFormats] = useState([]);
  const [allHashtags, setAllHashtags] = useState([]);
  const [aiTagsList, setAiTagsList] = useState([]);
  const [aiAnalysisResult, setAiAnalysisResult] = useState(null);

  // YouTube Auth & Auto
  const [isYtAuthenticated, setIsYtAuthenticated] = useState(false);
  const [ytChannelName, setYtChannelName] = useState('');
  const [isOpusMode, setIsOpusMode] = useState(false);
  const [authStatusError, setAuthStatusError] = useState(false);
  const [isConnectingYt, setIsConnectingYt] = useState(false);

  // Ollama
  const [ollamaStatus, setOllamaStatus] = useState('Checking...');

  // Automation State
  const [isAutomating, setIsAutomating] = useState(false);
  const [autoStatusText, setAutoStatusText] = useState('🚀 Automate & Post to YouTube');
  const [automationResult, setAutomationResult] = useState(null);

  // Toast
  const [toastMsg, setToastMsg] = useState('');
  const [showToastFlag, setShowToastFlag] = useState(false);
  const toastTimeoutRef = useRef(null);

  // Element Ref (for button flashing animation, though in react we can just use class state)
  const [flashBtnId, setFlashBtnId] = useState('');

  // Dashboard States
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState('home');
  const [dashboardStats, setDashboardStats] = useState({ pending: 0, uploaded: 0, failed: 0 });
  const [dashboardVideos, setDashboardVideos] = useState([]);
  const [isFetchingDashboard, setIsFetchingDashboard] = useState(false);
  const [previewVideo, setPreviewVideo] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/auth/status`)
      .then(r => r.json())
      .then(status => {
        if (status.is_authenticated) {
          setIsYtAuthenticated(true);
          setYtChannelName(status.channel_name || "Ready to Post");
        }
      })
      .catch(err => {
        console.error("Auth status error:", err);
        setAuthStatusError(true);
      });

    // Check Ollama Health
    fetch('http://127.0.0.1:11434/api/tags')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (data.models && data.models.length > 0) {
          setOllamaStatus(`✅ Local AI: ${data.models[0].name}`);
        } else {
          setOllamaStatus('⚠️ Local AI: No Models');
        }
      })
      .catch(() => setOllamaStatus('🔴 Local AI: Offline'));
  }, []);

  const loadDashboardData = () => {
    setIsFetchingDashboard(true);
    fetch(`${API_BASE}/api/dashboard/stats`).then(r => r.json()).then(setDashboardStats).catch(() => { });
    fetch(`${API_BASE}/api/dashboard/videos`).then(r => r.json()).then(v => {
      setDashboardVideos(v.videos || []);
      setIsFetchingDashboard(false);
    }).catch(() => setIsFetchingDashboard(false));
  };

  const [isConverting, setIsConverting] = useState(false);
  const convertVideo = async (vidId, ratio) => {
    setIsConverting(true);
    try {
        const r = await fetch(`${API_BASE}/api/dashboard/videos/${vidId}/convert`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ ratio })
        });
        const res = await r.json();
        if (res.status === 'success') {
            alert(`Video converted to ${ratio}!`);
            // Cache busting logic: immediately append timestamp
            setPreviewVideo(prev => ({ ...prev, public_url: prev.public_url.split('?')[0] + '?t=' + Date.now() }));
        } else {
            alert("Failed to convert: " + res.message);
        }
    } catch(err) {
        alert("Error converting video.");
    }
    setIsConverting(false);
  };
  const deleteDashboardVideo = async (id) => {
    if (!confirm("Are you sure you want to completely delete this scheduled video from the cloud and database?")) return;
    try {
        const r = await fetch(`${API_BASE}/api/dashboard/videos/${id}`, { method: 'DELETE' });
        const res = await r.json();
        if (res.status === 'success') {
            alert("Video deleted successfully.");
            setPreviewVideo(null); // Close modal
            loadDashboardData(); // Refresh UI
        } else {
            alert("Failed to delete video: " + res.message);
        }
    } catch(err) {
        alert("Error deleting video.");
    }
  };

  const flash = (id) => {
    setFlashBtnId(id);
    setTimeout(() => setFlashBtnId(''), 300);
  };

  const showToast = (msg = "Copied") => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMsg(msg);
    setShowToastFlag(true);
    toastTimeoutRef.current = setTimeout(() => {
      setShowToastFlag(false);
    }, 2000);
  };

  const showError = (msg) => {
    setErrorMsg(msg);
    setIsLoading(false);
  };

  const copyToClipboard = (text, elementId) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => showToast())
        .catch(() => fallbackCopyTextToClipboard(text));
    } else {
      fallbackCopyTextToClipboard(text);
    }
  };

  const fallbackCopyTextToClipboard = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      showToast();
    } catch (err) {
      console.error('Fallback: Oops, unable to copy', err);
    }
    document.body.removeChild(textArea);
  };

  const handleFetch = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    setCurrentUrl(trimmedUrl);

    setErrorMsg('');
    setMetadata(null);
    setFormats([]);
    setAllHashtags([]);
    setAiTagsList([]);
    setAiAnalysisResult(null);
    setAutomationResult(null);
    setIsLoading(true);

    try {
      const pFormats = fetch(`${API_BASE}/formats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmedUrl })
      }).then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e)));

      const pMetadata = fetch(`${API_BASE}/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmedUrl })
      }).then(r => r.ok ? r.json() : {});

      const pComments = fetch(`${API_BASE}/metadata/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmedUrl })
      }).then(r => r.ok ? r.json() : {});

      // Metadata early handling
      pMetadata.then(meta => {
        if (!meta) return;
        setMetadata(meta);
        const tags = meta.hashtags || [];
        if (tags.length > 0) {
          setAllHashtags(prev => {
            const copy = [...prev];
            tags.forEach(t => { if (!copy.includes(t)) copy.push(t); });
            return copy;
          });
        }

        if (meta.title || meta.description) {
          fetch(`${API_BASE}/metadata/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: meta.title, description: meta.description })
          })
            .then(r => r.ok ? r.json() : null)
            .then(analysis => {
              if (analysis) {
                setAiAnalysisResult(analysis);
                const allTags = [...(analysis.youtube || []), ...(analysis.instagram || [])];
                if (allTags.length > 0) {
                  setAiTagsList(allTags);
                }
              }
            })
            .catch(e => console.error("Analyze error:", e));
        }
      });

      pComments.then(comm => {
        if (comm && comm.available && comm.hashtags && comm.hashtags.length > 0) {
          setAllHashtags(prev => {
            const copy = [...prev];
            comm.hashtags.forEach(t => { if (!copy.includes(t)) copy.push(t); });
            return copy;
          });
        }
      });

      const fetchedFormats = await pFormats;
      setFormats(fetchedFormats);
      setIsLoading(false);
    } catch (err) {
      showError(err.detail || 'Failed to fetch video formats');
    }
  };

  const handleReset = () => {
    setUrl('');
    setCurrentUrl('');
    setErrorMsg('');
    setMetadata(null);
    setFormats([]);
    setAllHashtags([]);
    setAiTagsList([]);
    setAiAnalysisResult(null);
    setAutomationResult(null);
  };

  const downloadVideo = (formatId) => {
    fetch(`${API_BASE}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: currentUrl, format_id: formatId })
    })
      .then(r => {
        if (!r.ok) throw new Error("Download failed on server");
        handleFileDownload(r);
      })
      .catch(err => {
        showToast("Error starting download");
        console.error(err);
      });
  };

  const downloadThumbnail = () => {
    fetch(`${API_BASE}/download-thumbnail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: currentUrl })
    })
      .then(r => {
        if (!r.ok) throw new Error("Thumbnail download failed");
        handleFileDownload(r);
      })
      .catch(err => {
        showToast("Error downloading thumbnail");
        console.error(err);
      });
  };

  const handleFileDownload = (response) => {
    const disposition = response.headers.get('content-disposition');
    let filename = 'download';
    if (disposition && disposition.indexOf('filename=') !== -1) {
      const matches = /filename="([^"]+)"/.exec(disposition);
      if (matches != null && matches[1]) filename = matches[1];
      else filename = disposition.split('filename=')[1];
    }
    response.blob().then(blob => {
      const a = document.createElement('a');
      const blobUrl = window.URL.createObjectURL(blob);
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      a.remove();
    });
  };

  const handleYtLogin = () => {
    if (isYtAuthenticated) {
      fetch(`${API_BASE}/auth/logout`).then(() => {
        setIsYtAuthenticated(false);
        setYtChannelName('');
      });
      return;
    }

    setIsConnectingYt(true);
    fetch(`${API_BASE}/auth/login`).then(r => r.json()).then(res => {
      if (res.error) {
        showError('⚠️ ' + res.error);
        setIsConnectingYt(false);
      } else if (res.auth_url) {
        window.open(res.auth_url, '_blank');
        showToast('Login window opened — please grant access');
        const poll = setInterval(() => {
          fetch(`${API_BASE}/auth/status`).then(r => r.json()).then(s => {
            if (s.is_authenticated) {
              clearInterval(poll);
              setIsYtAuthenticated(true);
              setYtChannelName(s.channel_name || 'Connected');
              setIsConnectingYt(false);
              showToast('YouTube channel connected!');
            }
          });
        }, 3000);
      }
    }).catch(() => {
      showError('Failed to start login. Is the backend running?');
      setIsConnectingYt(false);
    });
  };

  const triggerAutomation = () => {
    if (!isYtAuthenticated) {
      showError("Please connect your YouTube channel first!");
      return;
    }
    if (!metadata) {
      showError("No metadata available to automate.");
      return;
    }

    setIsAutomating(true);
    setAutoStatusText('⏱ Downloading & Syncing to Cloud...');

    const payload = {
      title: metadata.title || 'Untitled',
      description: (aiAnalysisResult && aiAnalysisResult.optimized_description) || metadata.description || '',
      hashtags: allHashtags || [],
      thumbnail_url: metadata.thumbnail_url || '',
      url: currentUrl,
      opus_mode: isOpusMode
    };

    fetch(`${API_BASE}/automate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(r => r.ok ? r.json() : Promise.reject("Automation failed"))
      .then(data => {
        setAutomationResult(data.automation_details);
        setAutoStatusText('✅ Scheduled Successfully');
        showToast("Post scheduled securely!");
      })
      .catch(err => {
        console.error(err);
        showToast("Error starting automation pipeline");
        setAutoStatusText('🚀 Automate & Post to YouTube');
      })
      .finally(() => {
        setIsAutomating(false);
      });
  };

  // Rendering Helpers
  const hasResults = metadata || formats.length > 0;

  const videoTitle = metadata?.title ? metadata.title.toUpperCase() : "VIDEO details";
  const bestFormatId = formats.length > 0 ? formats[0].format_id : null;
  const maxFormatSize = formats.reduce((max, f) => f.filesize > max ? f.filesize : max, 0);

  return (
    <div className="app-container" id="app">
      <div style={{ textAlign: 'right', fontSize: '0.75rem', position: 'absolute', top: '16px', right: '16px', color: 'var(--text-muted)' }}>
        {ollamaStatus}
      </div>
            <div className="hamburger-btn" onClick={() => setIsSidebarOpen(true)}>
        <span></span>
        <span></span>
        <span></span>
      </div>

      <div className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`} onClick={() => setIsSidebarOpen(false)}></div>
      <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div>
          <div className="section-title">ReelGrab Menu</div>
          <button className="btn-secondary" style={{ width: '100%', marginBottom: '8px' }} onClick={() => { setCurrentView('home'); setIsSidebarOpen(false); }}>Download Reel</button>
          <button className="btn-secondary" style={{ width: '100%', marginBottom: '8px' }} onClick={() => { setCurrentView('dashboard'); loadDashboardData(); setIsSidebarOpen(false); }}>Dashboard & Previews</button>
          <button className="btn-secondary" style={{ width: '100%', marginBottom: '8px' }} onClick={() => { setCurrentView('connections'); setIsSidebarOpen(false); }}>Platform Connections</button>
        </div>

        <div>
          <div className="section-title">Supabase Cloud Stats</div>
          <div className="sidebar-stat-grid">
            <div className="sidebar-stat-box">
              <div className="sidebar-stat-value">{dashboardStats?.pending || 0}</div>
              <div className="sidebar-stat-label">Pending</div>
            </div>
            <div className="sidebar-stat-box">
              <div className="sidebar-stat-value" style={{ color: '#4CAF50' }}>{dashboardStats?.uploaded || 0}</div>
              <div className="sidebar-stat-label">Ready</div>
            </div>
            <div className="sidebar-stat-box">
              <div className="sidebar-stat-value" style={{ color: '#F44336' }}>{dashboardStats?.failed || 0}</div>
              <div className="sidebar-stat-label">Failed</div>
            </div>
          </div>
        </div>
      </div>

      <header className="header">
        <h1 className="wordmark">ReelGrab</h1>
        <p className="tagline">Personal Instagram Reel Downloader</p>
      </header>

      <main className="main-panel">
        <div className="sprocket-edge sprocket-top"></div>
        <div className="panel-content">
<div className="view-transition" style={{ display: currentView === 'home' ? 'block' : 'none' }}>
<div className="view-transition" style={{ display: currentView === 'home' ? 'block' : 'none' }}>

          <div className="input-row" id="input-section">
            <input
              type="text"
              placeholder="Paste Reel URL here..."
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleFetch()}
              disabled={isLoading || isAutomating}
              autoComplete="off"
            />
            <button type="button" onClick={handleFetch} disabled={isLoading || isAutomating}>Load</button>
          </div>

          {isLoading && (
            <div id="loading-state">
              <div className="sprocket-spinner">
                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                  <path d="M50 10 A40 40 0 1 0 50 90 A40 40 0 1 0 50 10 Z" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray="8 6" />
                  <circle cx="50" cy="50" r="15" fill="none" stroke="currentColor" strokeWidth="6" />
                </svg>
              </div>
              <div className="tape-head"></div>
            </div>
          )}

          {errorMsg && (
            <div id="error-panel" style={{ animation: 'error-pulse 0.4s ease-out 1' }}>
              <span>{errorMsg}</span>
            </div>
          )}

          {hasResults && !isLoading && (
            <div id="results-content">

              {/* Preview Card */}
              {metadata?.thumbnail_url && (
                <div id="preview-card" className="card">
                  <div className="thumbnail-wrapper">
                    <img src={metadata.thumbnail_url} alt="Thumbnail" />
                  </div>
                  <div className="preview-actions">
                    <button
                      className={`btn-primary ${flashBtnId === 'dl-best' ? 'flash' : ''}`}
                      onClick={() => { flash('dl-best'); if (bestFormatId) downloadVideo(bestFormatId); }}
                    >
                      Download Best Quality
                    </button>
                    <button
                      className={`btn-secondary ${flashBtnId === 'dl-thumb' ? 'flash' : ''}`}
                      onClick={() => { flash('dl-thumb'); downloadThumbnail(); }}
                    >
                      Download Thumbnail
                    </button>
                  </div>
                </div>
              )}

              {/* Caption Card */}
              {(metadata?.description_clean || allHashtags.length > 0) && (
                <div id="caption-card" className="card">
                  <div className="caption-header">
                    <span className="small-label">CAPTION</span>
                    <button className="icon-btn" aria-label="Copy Caption" onClick={() => copyToClipboard(metadata.description_clean || '')}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8 4v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.242a2 2 0 0 0-.602-1.43L16.083 2.57A2 2 0 0 0 14.685 2H10a2 2 0 0 0-2 2Z"></path>
                        <path d="M16 18v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2"></path>
                      </svg>
                    </button>
                  </div>
                  <div className="content-text">{metadata.description_clean}</div>

                  <div className="divider"></div>

                  {aiAnalysisResult && (aiAnalysisResult.youtube?.length > 0 || aiAnalysisResult.instagram?.length > 0) && (
                    <>
                      <div className="caption-header">
                        <span className="small-label" style={{ color: 'var(--accent)' }}>🔥 VIRAL HASHTAGS (AI)</span>
                        <button className="icon-btn" onClick={() => copyToClipboard(aiTagsList.map(t => t.startsWith('#') ? t : '#' + t).join(' '))}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M8 4v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.242a2 2 0 0 0-.602-1.43L16.083 2.57A2 2 0 0 0 14.685 2H10a2 2 0 0 0-2 2Z"></path>
                            <path d="M16 18v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2"></path>
                          </svg>
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
                        <div style={{ flex: 1 }}>
                          <div className="small-label" style={{ marginBottom: '8px', opacity: 0.7 }}>YOUTUBE SHORTS</div>
                          <div className="chip-container">
                            {aiAnalysisResult.youtube.map(tag => (
                              <span key={tag} className="chip" onClick={() => copyToClipboard(tag)}>{tag}</span>
                            ))}
                          </div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div className="small-label" style={{ marginBottom: '8px', opacity: 0.7 }}>INSTAGRAM REELS</div>
                          <div className="chip-container">
                            {aiAnalysisResult.instagram.map(tag => (
                              <span key={tag} className="chip" onClick={() => copyToClipboard(tag)}>{tag}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="caption-header">
                    <span className="small-label">ORIGINAL HASHTAGS</span>
                    <button className="icon-btn" onClick={() => copyToClipboard(allHashtags.map(t => t.startsWith('#') ? t : '#' + t).join(' '))}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8 4v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.242a2 2 0 0 0-.602-1.43L16.083 2.57A2 2 0 0 0 14.685 2H10a2 2 0 0 0-2 2Z"></path>
                        <path d="M16 18v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2"></path>
                      </svg>
                    </button>
                  </div>
                  <div className="chip-container">
                    {allHashtags.map(tag => (
                      <span key={tag} className="chip" onClick={() => copyToClipboard(tag)}>{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Gen Card */}
              {aiAnalysisResult && (aiAnalysisResult.viral_title || aiAnalysisResult.optimized_description) && (
                <div className="card" style={{ border: '1px solid rgba(95,191,179,0.3)', background: 'rgba(95,191,179,0.04)' }}>
                  <div className="caption-header" style={{ marginBottom: '14px' }}>
                    <span className="small-label" style={{ color: 'var(--accent-2)' }}>🤖 AI GENERATED CONTENT</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: '8px', background: 'rgba(95,191,179,0.1)', padding: '2px 8px', borderRadius: '20px', border: '1px solid rgba(95,191,179,0.2)' }}>
                      {aiAnalysisResult.confidence_notes?.match(/Generated by ([^\s.]+)/i)
                        ? `⚡ ${aiAnalysisResult.confidence_notes.match(/Generated by ([^\s.]+)/i)[1]}`
                        : 'Powered by Ollama'}
                    </span>
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <div className="small-label" style={{ color: 'var(--accent-2)', marginBottom: '6px', fontSize: '0.7rem' }}>🔥 AI VIRAL TITLE</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, letterSpacing: '-0.01em' }}>
                      {aiAnalysisResult.viral_title || '—'}
                    </div>
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <div className="small-label" style={{ color: 'var(--accent-2)', marginBottom: '6px', fontSize: '0.7rem' }}>📝 AI OPTIMIZED DESCRIPTION</div>
                    <div style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-muted)', fontStyle: 'italic', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '4px', borderLeft: '2px solid var(--accent-2)' }}>
                      {aiAnalysisResult.optimized_description || '—'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {aiAnalysisResult.scheduled_time && (
                      <div style={{ fontSize: '0.75rem', color: '#5fbfb3', background: 'rgba(95,191,179,0.1)', padding: '4px 10px', borderRadius: '20px', border: '1px solid rgba(95,191,179,0.25)' }}>
                        🕐 <span>Best time to post: {aiAnalysisResult.scheduled_time}</span>
                      </div>
                    )}
                  </div>
                  {aiAnalysisResult.analysis && (
                    <div style={{ fontSize: '0.78rem', color: '#5fbfb3', opacity: 0.85, marginTop: '8px' }}>
                      💡 {aiAnalysisResult.analysis}
                    </div>
                  )}
                  {aiAnalysisResult.confidence_notes && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px', fontStyle: 'italic' }}>
                      {aiAnalysisResult.confidence_notes}
                    </div>
                  )}
                </div>
              )}

              {/* Analytics Card */}
              {(metadata?.view_count || metadata?.like_count || aiAnalysisResult?.analysis) && (
                <div className="card">
                  <div className="caption-header">
                    <span className="small-label" style={{ color: 'var(--accent-2)' }}>📈 VIRALITY METRICS</span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
                    <div style={{ flex: 1, background: '#0c0b09', padding: '12px', borderRadius: '4px', textAlign: 'center' }}>
                      <div className="small-label" style={{ opacity: 0.7, marginBottom: '4px' }}>ENGAGEMENT</div>
                      <div className="cs-resolution" style={{ color: 'var(--text)' }}>
                        {metadata?.view_count || metadata?.like_count ?
                          (((metadata.like_count || 0) + (metadata.comment_count || 0)) / Math.max((metadata.view_count || (metadata.like_count * 12)), 1) * 100).toFixed(2) + '%'
                          : 'N/A'
                        }
                      </div>
                    </div>
                    <div style={{ flex: 1, background: '#0c0b09', padding: '12px', borderRadius: '4px', textAlign: 'center', border: '1px solid var(--accent-2)' }}>
                      <div className="small-label" style={{ opacity: 0.7, marginBottom: '4px', color: 'var(--accent-2)' }}>VIRAL POTENTIAL</div>
                      <div className="cs-resolution" style={{ color: 'var(--accent-2)' }}>
                        {metadata?.view_count || metadata?.like_count ? (() => {
                          const likes = metadata.like_count || 0;
                          const comments = metadata.comment_count || 0;
                          const views = metadata.view_count || (likes * 12);
                          const engRate = ((likes + comments) / views) * 100;
                          let vScore = (engRate * 5) + Math.min((views / 100000), 50);
                          vScore = Math.min(Math.max(vScore, 1), 100).toFixed(0);
                          return vScore + '/100';
                        })() : 'N/A'}
                      </div>
                    </div>
                    <div style={{ flex: 1, background: '#0c0b09', padding: '12px', borderRadius: '4px', textAlign: 'center' }}>
                      <div className="small-label" style={{ opacity: 0.7, marginBottom: '4px' }}>VIEWS / LIKES</div>
                      <div className="cs-codec" style={{ fontSize: '12px' }}>
                        {(() => {
                          if (!metadata?.view_count && !metadata?.like_count) return 'Hidden / Hidden';
                          const formatNum = (num) => num > 1000000 ? (num / 1000000).toFixed(1) + 'M' : num > 1000 ? (num / 1000).toFixed(1) + 'K' : num;
                          const views = metadata.view_count ? formatNum(metadata.view_count) : 'Hidden';
                          const likes = metadata.like_count ? formatNum(metadata.like_count) : 'Hidden';
                          return `${views} / ${likes}`;
                        })()}
                      </div>
                    </div>
                  </div>

                  {aiAnalysisResult?.analysis && (
                    <div style={{ marginTop: '16px', background: 'rgba(95, 191, 179, 0.1)', borderLeft: '2px solid var(--accent-2)', padding: '16px' }}>
                      <div className="small-label" style={{ color: 'var(--accent-2)', marginBottom: '8px' }}>🤖 OLLAMA AI DEEP PREDICTION</div>
                      <div style={{ fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--text)', fontStyle: 'italic' }}>
                        "{aiAnalysisResult.analysis}"
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Automation Card */}
              {(metadata?.title || metadata?.description) && (
                <div className="card" style={{ border: '1px solid rgba(227,168,87,0.3)', background: 'rgba(227,168,87,0.05)' }}>
                  <div className="caption-header">
                    <span className="small-label" style={{ color: 'var(--accent)' }}>🤖 YOUTUBE SHORTS AUTOMATOR</span>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Fetch video, download, and seamlessly schedule your post to YouTube with AI-optimized metadata and trending timings.
                  </p>

                  <div style={{ background: authStatusError ? 'rgba(255, 68, 68, 0.1)' : 'rgba(224, 17, 95, 0.1)', border: `1px solid ${authStatusError ? '#FF4444' : '#E0115F'}`, padding: '12px', borderRadius: '4px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ color: 'white', fontSize: '0.9rem', fontWeight: 'bold' }}>YouTube Account</div>
                      <div style={{ color: (isYtAuthenticated ? '#4CAF50' : (authStatusError ? '#FF4444' : 'var(--text-muted)')), fontSize: '0.8rem' }}>
                        {isYtAuthenticated ? `✅ ${ytChannelName}` : (authStatusError ? 'Backend Connection Failed' : 'Not connected')}
                      </div>
                    </div>
                    <button
                      className="btn-primary"
                      style={{ padding: '8px 16px', fontSize: '0.8rem', background: isYtAuthenticated ? '#333' : '#E0115F', borderRadius: '4px' }}
                      onClick={handleYtLogin}
                      disabled={isConnectingYt}
                    >
                      {isConnectingYt ? 'Connecting...' : (isYtAuthenticated ? 'Disconnect' : 'Connect')}
                    </button>
                  </div>

                  <div style={{ marginBottom: '16px', padding: '12px', background: '#0c0b09', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ color: '#D4AF37', fontSize: '0.9rem', fontWeight: 'bold' }}>✨ OpusClip Mode</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Auto-Generate Animated Captions before uploading</div>
                    </div>
                    <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '40px', height: '20px' }}>
                      <input type="checkbox" style={{ opacity: 0, width: 0, height: 0 }} checked={isOpusMode} onChange={e => setIsOpusMode(e.target.checked)} />
                      <span className="slider toggle-slider" style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isOpusMode ? '#D4AF37' : '#333', transition: '.4s', borderRadius: '34px' }}>
                        <span className="slider-before" style={{ position: 'absolute', height: '16px', width: '16px', left: '2px', bottom: '2px', backgroundColor: 'white', transition: '.4s', borderRadius: '50%', transform: isOpusMode ? 'translateX(20px)' : 'none' }}></span>
                      </span>
                    </label>
                  </div>

                  {automationResult && (
                    <div style={{ marginTop: '16px', background: 'rgba(0, 0, 0, 0.4)', padding: '16px', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '16px' }}>
                      <div className="small-label" style={{ color: 'var(--accent)', marginBottom: '8px' }}>🔥 AI GENERATED TITLE</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text)', marginBottom: '12px' }}>{automationResult.title}</div>
                      <div className="small-label" style={{ color: 'var(--accent)', marginBottom: '8px' }}>📝 AI OPTIMIZED DESCRIPTION</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px', whiteSpace: 'pre-wrap' }}>{automationResult.description}</div>
                      <div className="small-label" style={{ color: '#5FBFB3', marginBottom: '8px' }}>⏰ OPTIMAL SCHEDULE TIME</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#5FBFB3', marginBottom: '4px' }}>{automationResult.scheduled_time}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{automationResult.reasoning}</div>
                    </div>
                  )}

                  <button
                    className={`btn-primary ${flashBtnId === 'automate' ? 'flash' : ''}`}
                    style={{ width: '100%', fontSize: '1rem', padding: '16px', background: !isYtAuthenticated ? '#666' : (automationResult ? '#4CAF50' : 'linear-gradient(135deg, #E0115F, #800a36)'), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    onClick={() => { flash('automate'); triggerAutomation(); }}
                    disabled={isAutomating}
                  >
                    <span>{autoStatusText}</span>
                    {isAutomating && (
                      <div className="sprocket-spinner" style={{ width: '20px', height: '20px' }}>
                        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                          <path d="M50 10 A40 40 0 1 0 50 90 A40 40 0 1 0 50 10 Z" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray="8 6" />
                          <circle cx="50" cy="50" r="15" fill="none" stroke="currentColor" strokeWidth="6" />
                        </svg>
                      </div>
                    )}
                  </button>
                </div>
              )}

              {/* Formats List */}
              {formats.length > 0 && (
                <div>
                  <div className="results-header">
                    <span className="small-label">{videoTitle}</span>
                    <div className="thin-rule"></div>
                  </div>
                  <div className="channel-strip-container">
                    {formats.map((f, idx) => {
                      const isBest = idx === 0;
                      const sizeMb = f.filesize ? (f.filesize / 1024 / 1024).toFixed(1) + ' MB' : '??? MB';
                      const vuWidth = f.filesize && maxFormatSize > 0 ? Math.max((f.filesize / maxFormatSize) * 100, 5) : 5;
                      const delay = Math.min(idx * 40, 6 * 40);

                      return (
                        <div
                          key={f.format_id}
                          className={`channel-strip ${flashBtnId === f.format_id ? 'flash' : ''}`}
                          style={{ animation: `strip-stagger 0.3s ease-out ${delay}ms both` }}
                          onClick={() => { flash(f.format_id); downloadVideo(f.format_id); }}
                        >
                          <div className="cs-left">
                            <span className={`cs-badge ${isBest ? 'best' : ''}`}>{isBest ? 'BEST' : f.ext.toUpperCase()}</span>
                          </div>
                          <div className="cs-middle">
                            <span className="cs-resolution">{f.resolution}</span>
                            <span className="cs-codec">Codec: {f.format_note || f.ext}</span>
                          </div>
                          <div className="cs-right">
                            <span className="cs-size">{sizeMb}</span>
                            <div className="cs-vu-meter" style={{ width: `${vuWidth}%` }}></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <button className="btn-text" onClick={handleReset}>Download another reel</button>

            </div>
          )}
            </div>

            <div className="view-transition" style={{ display: currentView === 'connections' ? 'block' : 'none' }}>
              <div className="section-title" style={{ marginTop: '0', fontSize: '1.2rem', marginBottom: '24px' }}>Connected Platforms</div>
              <div className={`connection-item ${isYtAuthenticated ? 'active' : ''}`}>
                <div>
                  <div className="platform">YouTube Shorts API</div>
                  <div className="status">{isYtAuthenticated ? ytChannelName : 'Not Connected'}</div>
                </div>
                <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => document.location.href = `${API_BASE}/auth/login`}>
                  {isYtAuthenticated ? 'API Linked' : 'Connect'}
                </button>
              </div>
            </div>

            <div className="view-transition" style={{ display: currentView === 'dashboard' ? 'block' : 'none' }}>
              <div className="section-title" style={{ marginTop: '0', fontSize: '1.2rem', marginBottom: '8px' }}>Saved Videos Dashboard</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px' }}>Supabase cloud syncing queue metadata.</p>
              
              {isFetchingDashboard ? (
                 <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Loading records...</div>
              ) : (
                <div className="dashboard-list">
                  {dashboardVideos.map(vid => (
                    <div className="dashboard-list-item" key={vid.id} onClick={() => setPreviewVideo(vid)} style={{ cursor: 'pointer', padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, marginRight: '16px', overflow: 'hidden' }}>
                        <div style={{ color: 'var(--text)', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{vid.title || 'Untitled Video'}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{vid.description || 'No description'}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                         <div className={`dvc-status ${vid.upload_status}`}>{vid.upload_status}</div>
                         <div style={{ fontSize: '0.75rem', color: '#888' }}>{new Date(vid.schedule_time).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {previewVideo && (
                <div className="preview-modal-overlay" onClick={() => setPreviewVideo(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
                  <div className="preview-modal-content" onClick={e => e.stopPropagation()} style={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: '12px', width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                    
                    <div style={{ padding: '16px 24px', borderBottom: '1px solid #3f3f46', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#27272a', position: 'sticky', top: 0, zIndex: 10 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#fff' }}>
                            <div>YouTube Shorts Studio Preview</div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                {isConverting ? (
                                    <span style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>⏳ Converting layout in cloud (this may take a minute)...</span>
                                ) : (
                                    <>
                                        <span style={{ fontSize: '0.85rem', color: '#a1a1aa', alignSelf: 'center', marginRight: '8px' }}>Format Video:</span>
                                        {['9:16', '1:1', '4:5', '16:9'].map(r => (
                                            <button key={r} onClick={() => convertVideo(previewVideo.id, r)} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '4px 8px', fontSize: '0.8rem', borderRadius: '4px', cursor: 'pointer' }}>{r}</button>
                                        ))}
                                    </>
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                            <button onClick={() => deleteDashboardVideo(previewVideo.id)} style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid #FF4444', color: '#FF4444', padding: '6px 12px', fontSize: '0.85rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🗑 Delete Video</button>
                            <button onClick={() => setPreviewVideo(null)} style={{ background: 'transparent', border: 'none', color: '#a1a1aa', fontSize: '1.5rem', cursor: 'pointer', outline: 'none' }}>&times;</button>
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', padding: '24px', gap: '24px' }}>
                        {/* Video Player Side */}
                        <div style={{ flex: '1 1 300px', maxWidth: '350px' }}>
                            <div style={{ background: '#000', borderRadius: '8px', overflow: 'hidden', border: '1px solid #3f3f46', aspectRatio: '9/16', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {previewVideo.public_url ? (
                                    <video controls preload="metadata" autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover' }} src={previewVideo.public_url} />
                                ) : (
                                    <span style={{ color: '#555' }}>Video missing</span>
                                )}
                            </div>
                            <div style={{ marginTop: '16px', background: '#27272a', borderRadius: '6px', padding: '12px', border: '1px solid #3f3f46' }}>
                                <div style={{ fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '4px' }}>Visibility</div>
                                <div style={{ fontWeight: 500, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#4CAF50', borderRadius: '50%' }}></span>
                                    <span>Scheduled</span>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#a1a1aa', marginTop: '12px', marginBottom: '4px' }}>Schedule time</div>
                                <div style={{ color: '#3b82f6', fontWeight: 500 }}>{new Date(previewVideo.schedule_time).toLocaleString()}</div>
                            </div>
                        </div>

                        {/* Metadata Side */}
                        <div style={{ flex: '2 1 400px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            
                            {/* Title Box */}
                            <div>
                                <div style={{ fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '8px' }}>Title (required)</div>
                                <div style={{ background: '#000', border: '1px solid #3b82f6', borderRadius: '6px', padding: '12px', color: '#fff', fontSize: '0.95rem' }}>
                                    {previewVideo.title}
                                </div>
                            </div>
                            
                            {/* Description Box */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '8px' }}>Description</div>
                                <div style={{ background: '#000', border: '1px solid #3f3f46', borderRadius: '6px', padding: '12px', color: '#d4d4d8', fontSize: '0.9rem', whiteSpace: 'pre-wrap', lineHeight: '1.5', flex: 1, minHeight: '200px', overflowY: 'auto' }}>
                                    {previewVideo.description}
                                </div>
                            </div>

                            {/* Hashtags Box */}
                            <div>
                                <div style={{ fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '8px' }}>Tags</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {(previewVideo.hashtags || []).map(t => (
                                        <span key={t} style={{ background: '#3f3f46', color: '#e4e4e7', padding: '4px 10px', borderRadius: '16px', fontSize: '0.8rem' }}>{t}</span>
                                    ))}
                                </div>
                            </div>
                            
                        </div>
                    </div>
                  </div>
                </div>
              )}
    {!isFetchingDashboard && dashboardVideos.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No videos found in Supabase.</div>
              )}
            </div>

            </div>

            <div className="view-transition" style={{ display: currentView === 'connections' ? 'block' : 'none' }}>
              <div className="section-title" style={{ marginTop: '0', fontSize: '1.2rem', marginBottom: '24px' }}>Connected Platforms</div>
              <div className={`connection-item ${isYtAuthenticated ? 'active' : ''}`}>
                <div>
                  <div className="platform">YouTube Shorts API</div>
                  <div className="status">{isYtAuthenticated ? ytChannelName : 'Not Connected'}</div>
                </div>
                <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => document.location.href = `${API_BASE}/auth/login`}>
                  {isYtAuthenticated ? 'API Linked' : 'Connect'}
                </button>
              </div>
            </div>

            <div className="view-transition" style={{ display: currentView === 'dashboard' ? 'block' : 'none' }}>
              <div className="section-title" style={{ marginTop: '0', fontSize: '1.2rem', marginBottom: '8px' }}>Saved Videos Dashboard</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px' }}>Supabase cloud syncing queue metadata.</p>
              
              {isFetchingDashboard ? (
                 <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Loading records...</div>
              ) : (
                <div className="dashboard-list">
                  {dashboardVideos.map(vid => (
                    <div className="dashboard-list-item" key={vid.id} onClick={() => setPreviewVideo(vid)} style={{ cursor: 'pointer', padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, marginRight: '16px', overflow: 'hidden' }}>
                        <div style={{ color: 'var(--text)', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{vid.title || 'Untitled Video'}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{vid.description || 'No description'}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                         <div className={`dvc-status ${vid.upload_status}`}>{vid.upload_status}</div>
                         <div style={{ fontSize: '0.75rem', color: '#888' }}>{new Date(vid.schedule_time).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {previewVideo && (
                <div className="preview-modal-overlay" onClick={() => setPreviewVideo(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
                  <div className="preview-modal-content" onClick={e => e.stopPropagation()} style={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: '12px', width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                    
                    <div style={{ padding: '16px 24px', borderBottom: '1px solid #3f3f46', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#27272a', position: 'sticky', top: 0, zIndex: 10 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#fff' }}>
                            <div>YouTube Shorts Studio Preview</div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                {isConverting ? (
                                    <span style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>⏳ Converting layout in cloud (this may take a minute)...</span>
                                ) : (
                                    <>
                                        <span style={{ fontSize: '0.85rem', color: '#a1a1aa', alignSelf: 'center', marginRight: '8px' }}>Format Video:</span>
                                        {['9:16', '1:1', '4:5', '16:9'].map(r => (
                                            <button key={r} onClick={() => convertVideo(previewVideo.id, r)} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '4px 8px', fontSize: '0.8rem', borderRadius: '4px', cursor: 'pointer' }}>{r}</button>
                                        ))}
                                    </>
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                            <button onClick={() => deleteDashboardVideo(previewVideo.id)} style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid #FF4444', color: '#FF4444', padding: '6px 12px', fontSize: '0.85rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🗑 Delete Video</button>
                            <button onClick={() => setPreviewVideo(null)} style={{ background: 'transparent', border: 'none', color: '#a1a1aa', fontSize: '1.5rem', cursor: 'pointer', outline: 'none' }}>&times;</button>
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', padding: '24px', gap: '24px' }}>
                        {/* Video Player Side */}
                        <div style={{ flex: '1 1 300px', maxWidth: '350px' }}>
                            <div style={{ background: '#000', borderRadius: '8px', overflow: 'hidden', border: '1px solid #3f3f46', aspectRatio: '9/16', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {previewVideo.public_url ? (
                                    <video controls preload="metadata" autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover' }} src={previewVideo.public_url} />
                                ) : (
                                    <span style={{ color: '#555' }}>Video missing</span>
                                )}
                            </div>
                            <div style={{ marginTop: '16px', background: '#27272a', borderRadius: '6px', padding: '12px', border: '1px solid #3f3f46' }}>
                                <div style={{ fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '4px' }}>Visibility</div>
                                <div style={{ fontWeight: 500, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#4CAF50', borderRadius: '50%' }}></span>
                                    <span>Scheduled</span>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#a1a1aa', marginTop: '12px', marginBottom: '4px' }}>Schedule time</div>
                                <div style={{ color: '#3b82f6', fontWeight: 500 }}>{new Date(previewVideo.schedule_time).toLocaleString()}</div>
                            </div>
                        </div>

                        {/* Metadata Side */}
                        <div style={{ flex: '2 1 400px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            
                            {/* Title Box */}
                            <div>
                                <div style={{ fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '8px' }}>Title (required)</div>
                                <div style={{ background: '#000', border: '1px solid #3b82f6', borderRadius: '6px', padding: '12px', color: '#fff', fontSize: '0.95rem' }}>
                                    {previewVideo.title}
                                </div>
                            </div>
                            
                            {/* Description Box */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '8px' }}>Description</div>
                                <div style={{ background: '#000', border: '1px solid #3f3f46', borderRadius: '6px', padding: '12px', color: '#d4d4d8', fontSize: '0.9rem', whiteSpace: 'pre-wrap', lineHeight: '1.5', flex: 1, minHeight: '200px', overflowY: 'auto' }}>
                                    {previewVideo.description}
                                </div>
                            </div>

                            {/* Hashtags Box */}
                            <div>
                                <div style={{ fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '8px' }}>Tags</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {(previewVideo.hashtags || []).map(t => (
                                        <span key={t} style={{ background: '#3f3f46', color: '#e4e4e7', padding: '4px 10px', borderRadius: '16px', fontSize: '0.8rem' }}>{t}</span>
                                    ))}
                                </div>
                            </div>
                            
                        </div>
                    </div>
                  </div>
                </div>
              )}
    {!isFetchingDashboard && dashboardVideos.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No videos found in Supabase.</div>
              )}
            </div>


        </div>
        <div className="sprocket-edge sprocket-bottom"></div>
      </main>

      <div id="toast" className={`toast ${showToastFlag ? 'show' : ''}`}>{toastMsg}</div>
    </div>
  )
}
