"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

interface Customer { id: string; name: string; platform: string; tags: string[]; }

export default function CustomersPage() {
  const { isDarkMode } = useTheme();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCustomers = async () => {
      const { data } = await supabase.from('customers').select('*');
      if (data) setCustomers(data);
      setLoading(false);
    };
    fetchCustomers();
  }, []);

  return (
    <div className={`min-h-screen flex font-sans transition-colors duration-200 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <Sidebar />
      <main className="flex-1 md:ml-64 flex flex-col relative">
        <Header />
        <div className="flex-1 overflow-y-auto mt-16 p-6 md:p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold">Customers</h2>
            <p className="text-slate-500 mt-1">View and manage your shoppers from integrated platforms.</p>
          </div>

          <div className={`rounded-xl border shadow-sm overflow-hidden transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            {loading ? (
              <div className="p-8 text-center text-slate-500">Loading customer profiles...</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`border-b text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Platform</th>
                    <th className="px-6 py-4">Tags</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                  {customers.map((c) => (
                    <tr key={c.id} className={`transition-colors ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/80'}`}>
                      <td className="px-6 py-4 font-medium">{c.name}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${c.platform === 'TikTok Shop' ? (isDarkMode ? 'bg-slate-800 text-white' : 'bg-black text-white') : (isDarkMode ? 'bg-blue-900/40 text-blue-400' : 'bg-blue-100 text-blue-800')}`}>
                          {c.platform}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {c.tags?.map((tag, idx) => (
                          <span key={idx} className={`text-xs px-2 py-0.5 rounded-full mr-1 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>{tag}</span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}