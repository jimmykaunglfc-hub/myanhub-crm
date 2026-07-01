"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { useTheme } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';

export default function Home() {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
      } else {
        setIsAuthorized(true);
      }
    };
    checkAuth();
  }, [router]);

  if (!isAuthorized) {
    return (
      <div className={`min-h-screen flex items-center justify-center font-medium transition-colors duration-200 ${isDarkMode ? 'bg-slate-950 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
        Securing connection...
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex font-sans transition-colors duration-200 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <Sidebar />
      
      <main className="flex-1 md:ml-64 flex flex-col relative">
        <Header />
        
        {/* Main Content Area Canvas */}
        <div className="flex-1 overflow-y-auto mt-16 p-6 md:p-8">
          
          <div className="mb-8">
            <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Good morning, Manager</h2>
            <p className="text-slate-500 mt-1">Here's what's happening with your MyanHub shops today.</p>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className={`rounded-xl p-6 border shadow-sm transition-colors duration-200 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h3 className="text-sm font-medium text-slate-500 mb-4">Total Sales Today</h3>
              <div className={`text-3xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>$4,250.00</div>
              <div className="text-sm font-medium text-emerald-600">+12.5% <span className="text-slate-400 font-normal">vs yesterday</span></div>
            </div>
            
            <div className="bg-indigo-600 rounded-xl p-6 border border-indigo-700 shadow-md">
              <h3 className="text-sm font-medium text-indigo-100 mb-4">Unread Messages</h3>
              <div className="text-3xl font-bold text-white mb-2">18</div>
              <div className="text-sm font-medium text-indigo-200">Action required</div>
            </div>

            <div className={`rounded-xl p-6 border shadow-sm transition-colors duration-200 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h3 className="text-sm font-medium text-slate-500 mb-4">Active Orders</h3>
              <div className={`text-3xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>142</div>
              <div className="text-sm font-medium text-slate-500">45 pending fulfillment</div>
            </div>

            <div className={`rounded-xl p-6 border shadow-sm transition-colors duration-200 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h3 className="text-sm font-medium text-slate-500 mb-4">New Customers</h3>
              <div className={`text-3xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>24</div>
              <div className="text-sm font-medium text-emerald-600">+5.2%</div>
            </div>
          </div>

          {/* Lower Layout Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
            
            {/* Inbox Panel */}
            <div className={`rounded-xl border shadow-sm h-[400px] flex flex-col transition-colors duration-200 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className={`p-5 border-b flex justify-between items-center ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Unified Inbox</h3>
                <button className="text-indigo-600 text-sm font-medium hover:underline">View All</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
                 <p className="text-slate-400 text-sm text-center">Messages from Supabase<br/>will appear here.</p>
              </div>
            </div>

            {/* Orders Table Panel */}
            <div className={`rounded-xl border shadow-sm h-[400px] flex flex-col transition-colors duration-200 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className={`p-5 border-b flex justify-between items-center ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Recent Orders</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
                <p className="text-slate-400 text-sm text-center">Order data from Supabase<br/>will load here.</p>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}