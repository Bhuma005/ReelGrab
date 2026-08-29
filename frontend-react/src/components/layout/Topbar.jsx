import { Menu, Plus } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useNavigate } from 'react-router-dom';

export default function Topbar() {
  const { setSidebarOpen } = useAppStore();
  const navigate = useNavigate();

  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden text-muted-foreground hover:text-text"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="text-sm font-medium text-text-muted hidden md:block">
          Creator Dashboard
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/create')}
          className="flex items-center gap-2 bg-accent text-accent-foreground hover:bg-accent/90 px-4 py-2 rounded-md text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Reel
        </button>
      </div>
    </header>
  );
}
