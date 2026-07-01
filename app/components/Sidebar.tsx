"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { LayoutDashboard, Inbox, Users, ShoppingCart, Settings, LogOut } from 'lucide-react';

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState('Loading...');

  useEffect(() => {
    const fetchActiveProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      } else {
        setUserEmail('Active Session');
      }
    };
    fetchActiveProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Tracking color matrix wrapper helper for sidebar navigation links
  const isActive = (path: string) => pathname === path;

  return (
    <aside className="hidden md:flex bg-white fixed left-0 top-0 h-full w-64 border-r border-slate-200 flex-col py-6 px-4 z-50">
      <div className="mb-10 px-2">
        <h1 className="text-2xl font-extrabold text-indigo-600 tracking-tight">MyanHub</h1>
      </div>
      
      <nav className="flex-1 space-y-1">
        <Link href="/" className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition-colors ${isActive('/') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
          <LayoutDashboard size={20} />
          Dashboard
        </Link>
        <Link href="/inbox" className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition-colors ${isActive('/inbox') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
          <Inbox size={20} />
          Unified Inbox
          <span className="ml-auto bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">3</span>
        </Link>
        <Link href="/customers" className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition-colors ${isActive('/customers') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
          <Users size={20} />
          Customers
        </Link>
        <Link href="/orders" className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition-colors ${isActive('/orders') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
          <ShoppingCart size={20} />
          Orders
        </Link>
      </nav>

      {/* Account Info Profile Integration Area */}
      <div className="mt-auto pt-6 border-t border-slate-200 space-y-4">
        <Link href="/settings" className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition-colors ${isActive('/settings') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
          <Settings size={20} />
          Settings
        </Link>
        
        <div className="flex items-center justify-between px-2 bg-slate-50 py-2.5 rounded-xl border border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex-shrink-0 flex items-center justify-center font-bold text-sm uppercase">
              {userEmail[0]}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate uppercase" title={userEmail}>
                {userEmail.split('@')[0]}
              </p>
              <p className="text-xs text-slate-400 truncate">Workspace Node</p>
            </div>
          </div>
          <button 
            onClick={handleLogout} 
            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-slate-100 transition-colors" 
            title="Disconnect/Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}