"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { 
  LayoutDashboard, Inbox, Users, ShoppingCart, Settings, LogOut 
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [userEmail, setUserEmail] = useState('Loading...');
  const [userInitial, setUserInitial] = useState('?');

  useEffect(() => {
    // 1. Fetch user profile
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
        setUserInitial(user.email.charAt(0).toUpperCase());
      }
    };
    fetchUser();

    // 2. Fetch the initial unread message count
    const fetchUnreadCount = async () => {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'unread')
        .eq('sender', 'customer');
        
      setUnreadCount(count || 0);
    };
    fetchUnreadCount();

    // 3. REAL-TIME LISTENER: Watch for new inbound messages or messages being marked 'read'
    const channel = supabase.channel('sidebar-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        fetchUnreadCount();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const navLinks = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={18} /> },
    { name: 'Unified Inbox', path: '/inbox', icon: <Inbox size={18} />, badge: unreadCount },
    { name: 'Customers', path: '/customers', icon: <Users size={18} /> },
    { name: 'Orders', path: '/orders', icon: <ShoppingCart size={18} /> },
  ];

  return (
    <aside className="w-64 bg-[#0B0F19] text-slate-300 h-screen hidden md:flex flex-col border-r border-slate-800 fixed left-0 top-0 z-50">
      
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800">
        <h1 className="text-xl font-black text-indigo-500 tracking-tight">MyanHub</h1>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {navLinks.map((link) => {
          const isActive = pathname === link.path || (link.path !== '/' && pathname.startsWith(link.path));
          
          return (
            <Link key={link.name} href={link.path} className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors font-medium text-sm ${isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' : 'hover:bg-slate-800/50 hover:text-slate-100'}`}>
              <div className="flex items-center gap-3">
                <span className={isActive ? 'text-indigo-200' : 'text-slate-500'}>{link.icon}</span>
                {link.name}
              </div>
              
              {/* Live Notification Badge */}
              {link.badge !== undefined && link.badge > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">
                  {link.badge > 99 ? '99+' : link.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Settings & User */}
      <div className="p-4 border-t border-slate-800 space-y-2">
        <Link href="/settings" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium text-sm ${pathname === '/settings' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50 hover:text-slate-100'}`}>
          <Settings size={18} className="text-slate-500" /> Settings
        </Link>
        
        <div className="flex items-center justify-between bg-slate-900/50 border border-slate-800 p-2.5 rounded-xl mt-2">
          <div className="flex items-center gap-2 truncate">
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-black text-white flex-shrink-0">
              {userInitial}
            </div>
            <span className="text-xs font-bold truncate text-slate-300">{userEmail.split('@')[0].toUpperCase()}</span>
          </div>
          <button onClick={() => supabase.auth.signOut().then(() => window.location.href='/login')} className="text-slate-500 hover:text-rose-400 transition-colors p-1">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}