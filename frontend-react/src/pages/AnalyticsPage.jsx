import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Activity, TrendingUp, Users, Eye, BarChart3 } from 'lucide-react';

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
        <p className="text-text-muted">Track the performance and engagement of your automated Reels.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-text-muted">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-text-muted mt-1">+0% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-text-muted">Avg. Engagement Rate</CardTitle>
            <Activity className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-text-muted mt-1">+0% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-text-muted">New Subscribers</CardTitle>
            <Users className="h-4 w-4 text-info" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-text-muted mt-1">+0% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-text-muted">AI Virality Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--/100</div>
            <p className="text-xs text-text-muted mt-1">Based on recent posts</p>
          </CardContent>
        </Card>
      </div>

      <Card className="min-h-[400px] flex flex-col items-center justify-center border-dashed border-border/60 bg-transparent">
        <BarChart3 className="h-16 w-16 text-muted-foreground mb-4 opacity-20" />
        <h3 className="text-lg font-semibold mb-2">Insufficient Data</h3>
        <p className="text-sm text-text-muted max-w-sm text-center">
          Publish more videos through the workflow to populate your channel analytics. Ensure your YouTube account is connected.
        </p>
      </Card>
    </div>
  );
}
