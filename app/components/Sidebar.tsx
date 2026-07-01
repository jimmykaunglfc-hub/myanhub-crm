"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { LayoutDashboard, Inbox, Users, ShoppingCart, Settings, LogOut } from 'lucide-react';

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isDarkMode } = useTheme();
  const [userEmail, setUserEmail] = useState('Loading...');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchActiveProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setUserEmail(user.email);
    };
    
    const fetchUnreadMetrics = async () => {
      const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('status', 'unread');
      if (count !== null) setUnreadCount(count);
    };

    fetchActiveProfile();
    fetchUnreadMetrics();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isActive = (path: string) => pathname === path;

  return (
    <aside className={`hidden md:flex fixed left-0 top-0 h-full w-64 border-r flex-col py-6 px-4 z-50 transition-colors duration-200 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
      <div className="mb-10 px-2">
        <h1 className="text-2xl font-extrabold text-indigo-600 tracking-tight">MyanHub</h1>
      </div>
      
      <nav className="flex-1 space-y-1">
        {[
          { href: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
          { href: '/inbox', label: 'Unified Inbox', icon: <Inbox size={20} />, count: unreadCount },
          { href: '/customers', label: 'Customers', icon: <Users size={20} /> },
          { href: '/orders', label: 'Orders', icon: <ShoppingCart size={20} /> },
        ].map((item) => (
          <Link 
            key={item.href}
            href={item.href} 
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition-colors ${isActive(item.href) ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' : isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            {item.icon}
            {item.label}
            {!!item.count && <span className="ml-auto bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{item.count}</span>}
          </Link>
        ))}
      </nav>

      <div className={`mt-auto pt-4 border-t space-y-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        <Link href="/settings" className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition-colors ${isActive('/settings') ? 'bg-indigo-600 text-white' : isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
          <Settings size={20} /> Settings
        </Link>
        
        <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex-shrink-0 flex items-center justify-center font-bold text-xs uppercase">{userEmail[0]}</div>
            <p className="text-xs font-bold truncate uppercase">{userEmail.split('@')[0]}</p>
          </div>
          <button onClick={handleLogout} className="text-slate-400 hover:text-rose-500 p-1 rounded"><LogOut size={16} /></button>
        </div>
      </div>
    </aside>
  );
}