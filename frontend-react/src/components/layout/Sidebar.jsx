import { NavLink } from 'react-router-dom';
import { useAppStore } from '../../stores/appStore';
import { LayoutDashboard, Video, Library, Calendar, Activity, Link2, Settings, Terminal, X } from 'lucide-react';

export default function Sidebar() {
  const { isSidebarOpen, setSidebarOpen } = useAppStore();

  const links = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/create', icon: Video, label: 'Create Reel' },
    { to: '/library', icon: Library, label: 'Library' },
    { to: '/scheduler', icon: Calendar, label: 'Scheduler' },
    { to: '/analytics', icon: Activity, label: 'Analytics' },
    { to: '/connections', icon: Link2, label: 'Connections' },
    { to: '/logs', icon: Terminal, label: 'Logs' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-surface border-r border-border transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } flex flex-col`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-border">
          <div className="flex items-center gap-2 text-accent font-black text-xl tracking-tighter uppercase">
            <Video className="w-6 h-6" />
            ReelGrab
          </div>
          <button className="lg:hidden text-muted-foreground hover:text-text" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => 
                `flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium ${
                  isActive 
                    ? 'bg-accent/10 text-accent' 
                    : 'text-text-muted hover:text-text hover:bg-surface-elevated'
                }`
              }
            >
              <link.icon className="w-4 h-4" />
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <SystemStatus />
        </div>
      </aside>
    </>
  );
}

function SystemStatus() {
  const { ollamaStatus, isYtAuthenticated } = useAppStore();
  
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">System Health</div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-muted">Local AI</span>
        <span className={ollamaStatus.includes('✅') ? 'text-success' : 'text-danger'}>
          {ollamaStatus.includes('✅') ? 'Online' : 'Offline'}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-muted">YouTube</span>
        <span className={isYtAuthenticated ? 'text-success' : 'text-text-muted'}>
          {isYtAuthenticated ? 'Connected' : 'Disconnected'}
        </span>
      </div>
    </div>
  );
}
