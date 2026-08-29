import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { useAppStore } from '../stores/appStore';
import { Cpu } from 'lucide-react';

export default function SettingsPage() {
  const { ollamaStatus } = useAppStore();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-text-muted">Configure your local pipeline and AI instances.</p>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-accent" /> Local LLM Configuration
            </CardTitle>
            <CardDescription>Ollama must be running locally on port 11434</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-surface-elevated rounded border border-border">
              <span className="text-sm font-medium">Status</span>
              <span className={`text-sm font-bold ${ollamaStatus.includes('✅') ? 'text-success' : 'text-danger'}`}>
                {ollamaStatus}
              </span>
            </div>
            <p className="text-xs text-text-muted">
              Models are automatically detected. Ensure you have pulled `llama3` or `mistral` to use the AI tagging and optimization features.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
