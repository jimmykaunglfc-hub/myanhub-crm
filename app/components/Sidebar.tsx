"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { 
  LayoutDashboard, Inbox, Users, ShoppingCart, Settings, LogOut, Package, Shield, Menu, X
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isDarkMode } = useTheme();
  
  const [unreadCount, setUnreadCount] = useState(0);
  const [userEmail, setUserEmail] = useState('Loading...');
  const [userInitial, setUserInitial] = useState('?');
  const [isMobileOpen, setIsMobileOpen] = useState(false); // NEW: Mobile menu state

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
        setUserInitial(user.email.charAt(0).toUpperCase());
      }
    };
    fetchUser();
    // (Unread count fetcher remains the same...)
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navLinks = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={18} /> },
    { name: 'Unified Inbox', path: '/inbox', icon: <Inbox size={18} />, badge: unreadCount },
    { name: 'Customers', path: '/customers', icon: <Users size={18} /> },
    { name: 'Orders', path: '/orders', icon: <ShoppingCart size={18} /> },
    { name: 'Inventory', path: '/inventory', icon: <Package size={18} /> },
    { name: 'Team Access', path: '/team', icon: <Shield size={18} /> }, 
  ];

  return (
    <>
      {/* MOBILE HAMBURGER MENU */}
      <button 
        onClick={() => setIsMobileOpen(true)}
        className={`md:hidden fixed top-4 left-4 z-[60] p-2 rounded-lg shadow-md ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900'}`}
      >
        <Menu size={24} />
      </button>

      {/* MOBILE OVERLAY */}
      {isMobileOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-[60] backdrop-blur-sm"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* SIDEBAR (Responsive) */}
      <aside className={`fixed top-0 left-0 h-screen w-64 z-[70] transform transition-transform duration-300 ease-in-out flex flex-col border-r ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 ${isDarkMode ? 'bg-[#0B0F19] border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
        
        <div className={`h-16 flex items-center justify-between px-6 border-b flex-shrink-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
          <h1 className="text-xl font-black text-indigo-600 dark:text-indigo-500 tracking-tight">MyanHub</h1>
          <button className="md:hidden p-1 opacity-50 hover:opacity-100" onClick={() => setIsMobileOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto custom-scrollbar">
          {navLinks.map((link) => {
            const isActive = pathname === link.path || (link.path !== '/' && pathname.startsWith(link.path));
            return (
              <Link 
                key={link.name} 
                href={link.path} 
                onClick={() => setIsMobileOpen(false)} // Close menu on mobile tap
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors font-medium text-sm ${isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' : (isDarkMode ? 'hover:bg-slate-800/50 hover:text-slate-100' : 'hover:bg-slate-200/50 hover:text-slate-900')}`}
              >
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

        {/* PROPER LOGOUT & PROFILE FOOTER */}
        <div className={`p-4 border-t space-y-3 flex-shrink-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3 px-2 py-1 mb-2">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-black text-white flex-shrink-0">
              {userInitial}
            </div>
            <div className="overflow-hidden">
              <p className={`text-xs font-bold truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{userEmail.split('@')[0]}</p>
              <p className="text-[10px] text-slate-500 truncate">Workspace Admin</p>
            </div>
          </div>

          <Link href="/settings" onClick={() => setIsMobileOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium text-sm ${pathname === '/settings' ? (isDarkMode ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-900') : (isDarkMode ? 'hover:bg-slate-800/50 hover:text-slate-100' : 'hover:bg-slate-200/50 hover:text-slate-900')}`}>
            <Settings size={18} className={isDarkMode ? 'text-slate-500' : 'text-slate-400'} /> System Settings
          </Link>
          
          <button 
            onClick={handleLogout} 
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-bold text-sm ${isDarkMode ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'}`}
          >
            <LogOut size={18} /> Sign Out Securely
          </button>
        </div>
      </aside>
    </>
  );
}