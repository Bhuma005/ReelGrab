import { useAppStore } from '../stores/appStore';
import { authApi } from '../api/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { MonitorPlay, Link2, CheckCircle2, Camera, Globe, Lock } from 'lucide-react';
import { toast } from 'sonner';

export default function ConnectionsPage() {
  const { isYtAuthenticated, ytChannelName, setYtAuth } = useAppStore();

  const handleYtLogin = async () => {
    if (isYtAuthenticated) {
      try {
        await authApi.logout();
        setYtAuth(false, '');
        toast.success("Disconnected from YouTube");
      } catch (err) {
        toast.error("Failed to disconnect");
      }
      return;
    }

    try {
      const res = await authApi.getLoginUrl();
      if (res.error) throw new Error(res.error);
      
      window.open(res.auth_url, '_blank');
      toast.info("Please complete authentication in the new tab");
      
      const poll = setInterval(async () => {
        try {
          const s = await authApi.getStatus();
          if (s.is_authenticated) {
            clearInterval(poll);
            setYtAuth(true, s.channel_name || 'Connected');
            toast.success("YouTube channel connected successfully!");
          }
        } catch (e) {
          // Ignore polling errors
        }
      }, 3000);
      
      // Stop polling after 2 minutes to prevent infinite loops
      setTimeout(() => clearInterval(poll), 120000);
      
    } catch (err) {
      toast.error(err.message || "Failed to start login");
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Platform Connections</h2>
        <p className="text-text-muted">Link your social media accounts for automated publishing.</p>
      </div>

      <div className="grid gap-4">
        <Card className={isYtAuthenticated ? 'border-success/50 bg-success/5' : ''}>
          <CardHeader className="flex flex-row items-center gap-4 pb-4">
            <div className={`p-3 rounded-full ${isYtAuthenticated ? 'bg-success/20 text-success' : 'bg-surface-elevated text-text-muted'}`}>
              <MonitorPlay className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <CardTitle>YouTube Data API v3</CardTitle>
              <CardDescription>
                {isYtAuthenticated ? (
                  <span className="flex items-center gap-1 text-success font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Connected as {ytChannelName}
                  </span>
                ) : (
                  "Required for scheduling and uploading Shorts"
                )}
              </CardDescription>
            </div>
            <Button 
              variant={isYtAuthenticated ? 'outline' : 'default'} 
              className={!isYtAuthenticated ? "bg-[#FF0000] text-white hover:bg-[#FF0000]/90" : ""}
              onClick={handleYtLogin}
            >
              <Link2 className="w-4 h-4 mr-2" />
              {isYtAuthenticated ? 'Disconnect' : 'Connect Account'}
            </Button>
          </CardHeader>
        </Card>

        {/* Instagram */}
        <Card className="opacity-70">
          <CardHeader className="flex flex-row items-center gap-4 pb-4">
            <div className="p-3 rounded-full bg-surface-elevated text-text-muted">
              <Camera className="w-6 h-6 text-[#E1306C]" />
            </div>
            <div className="flex-1">
              <CardTitle>Instagram Graph API</CardTitle>
              <CardDescription>
                Automate posting to Instagram Reels (Coming Soon)
              </CardDescription>
            </div>
            <Button variant="outline" disabled>
              <Lock className="w-4 h-4 mr-2" />
              Coming Soon
            </Button>
          </CardHeader>
        </Card>

        {/* Facebook */}
        <Card className="opacity-70">
          <CardHeader className="flex flex-row items-center gap-4 pb-4">
            <div className="p-3 rounded-full bg-surface-elevated text-text-muted">
              <Globe className="w-6 h-6 text-[#1877F2]" />
            </div>
            <div className="flex-1">
              <CardTitle>Facebook Page API</CardTitle>
              <CardDescription>
                Cross-post videos to Facebook Pages (Coming Soon)
              </CardDescription>
            </div>
            <Button variant="outline" disabled>
              <Lock className="w-4 h-4 mr-2" />
              Coming Soon
            </Button>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
