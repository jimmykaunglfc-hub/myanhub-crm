"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { 
  LayoutDashboard, Inbox, Users, ShoppingCart, Settings, LogOut, Package, Shield 
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { isDarkMode } = useTheme();
  
  const [unreadCount, setUnreadCount] = useState(0);
  const [userEmail, setUserEmail] = useState('Loading...');
  const [userInitial, setUserInitial] = useState('?');

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
        setUserInitial(user.email.charAt(0).toUpperCase());
      }
    };
    fetchUser();

    const fetchUnreadCount = async () => {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'unread')
        .eq('sender', 'customer');
        
      setUnreadCount(count || 0);
    };
    fetchUnreadCount();

    const channel = supabase.channel('sidebar-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        fetchUnreadCount();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // NEW: Added the "Team" link to the array here!
  const navLinks = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={18} /> },
    { name: 'Unified Inbox', path: '/inbox', icon: <Inbox size={18} />, badge: unreadCount },
    { name: 'Customers', path: '/customers', icon: <Users size={18} /> },
    { name: 'Orders', path: '/orders', icon: <ShoppingCart size={18} /> },
    { name: 'Inventory', path: '/inventory', icon: <Package size={18} /> },
    { name: 'Team Access', path: '/team', icon: <Shield size={18} /> }, 
  ];

  return (
    <aside className={`w-64 h-screen hidden md:flex flex-col border-r fixed left-0 top-0 z-50 transition-colors duration-200 ${isDarkMode ? 'bg-[#0B0F19] border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
      <div className={`h-16 flex items-center px-6 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        <h1 className="text-xl font-black text-indigo-600 dark:text-indigo-500 tracking-tight">MyanHub</h1>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {navLinks.map((link) => {
          const isActive = pathname === link.path || (link.path !== '/' && pathname.startsWith(link.path));
          
          return (
            <Link key={link.name} href={link.path} className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors font-medium text-sm ${isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' : (isDarkMode ? 'hover:bg-slate-800/50 hover:text-slate-100' : 'hover:bg-slate-200/50 hover:text-slate-900')}`}>
              <div className="flex items-center gap-3">
                <span className={isActive ? 'text-indigo-200' : (isDarkMode ? 'text-slate-500' : 'text-slate-400')}>{link.icon}</span>
                {link.name}
              </div>
              
              {link.badge !== undefined && link.badge > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">
                  {link.badge > 99 ? '99+' : link.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className={`p-4 border-t space-y-2 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        <Link href="/settings" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium text-sm ${pathname === '/settings' ? (isDarkMode ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-900') : (isDarkMode ? 'hover:bg-slate-800/50 hover:text-slate-100' : 'hover:bg-slate-200/50 hover:text-slate-900')}`}>
          <Settings size={18} className={isDarkMode ? 'text-slate-500' : 'text-slate-400'} /> Settings
        </Link>
        
        <div className={`flex items-center justify-between border p-2.5 rounded-xl mt-2 ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center gap-2 truncate">
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-black text-white flex-shrink-0">
              {userInitial}
            </div>
            <span className={`text-xs font-bold truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{userEmail.split('@')[0].toUpperCase()}</span>
          </div>
          <button onClick={() => supabase.auth.signOut().then(() => window.location.href='/login')} className={`transition-colors p-1 ${isDarkMode ? 'text-slate-500 hover:text-rose-400' : 'text-slate-400 hover:text-rose-500'}`}>
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}