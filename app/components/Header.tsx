"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { Search, Bell, Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';

export default function Header() {
  const { isDarkMode } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isRinging, setIsRinging] = useState(false);

  useEffect(() => {
    // 1. Initial count check
    const fetchUnreadCount = async () => {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'unread')
        .eq('sender', 'customer');
        
      setUnreadCount(count || 0);
    };
    fetchUnreadCount();

    // 2. REAL-TIME LISTENER: Listen for new messages
    const channel = supabase.channel('header-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'status=eq.unread' }, () => {
        // When a NEW unread message arrives, increase count and ring the bell!
        setUnreadCount(prev => prev + 1);
        setIsRinging(true);
        setTimeout(() => setIsRinging(false), 2000); // Stop shaking after 2 seconds
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => {
        // If a message was updated (like being marked as read), just quietly sync the count
        fetchUnreadCount();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <header className={`h-16 flex items-center justify-between px-6 border-b fixed top-0 right-0 left-0 md:left-64 z-40 transition-colors duration-200 ${isDarkMode ? 'bg-slate-950/80 border-slate-800 backdrop-blur-md text-white' : 'bg-white/80 border-slate-200 backdrop-blur-md text-slate-900'}`}>
      
      {/* Search Bar */}
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
          <input 
            type="text" 
            placeholder="Search orders, customers..." 
            className={`w-full pl-10 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors border ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'}`}
          />
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4 ml-4">
        
        {/* Live Notification Bell */}
        <Link href="/inbox" className="relative p-2 rounded-full hover:bg-slate-500/10 transition-colors group">
          <Bell size={20} className={`${isDarkMode ? 'text-slate-400' : 'text-slate-600'} group-hover:text-indigo-500 transition-colors ${isRinging ? 'animate-bounce text-indigo-500' : ''}`} />
          
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white dark:ring-slate-950 animate-pulse"></span>
          )}
        </Link>

        {/* Connect Shop Shortcut */}
        <Link href="/settings" className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
          <LinkIcon size={14} /> Connect Shop
        </Link>

      </div>
    </header>
  );
}