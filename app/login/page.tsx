"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    // SIGNUP LOGIC
    if (!isLogin) {
      setMessage("MyanHub is currently invite-only. Please contact support@myanhub.com to request an account.");
      return;
    }

    // LOGIN LOGIC
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Check role immediately upon login
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        // VIP ROUTING: Push to the correct portal based on their assigned role
        if (profile?.role === 'admin') {
          router.push('/admin-panel');
        } else if (profile?.role === 'driver') {
          router.push('/driver');
        } else {
          router.push('/');
        }
      }
    } catch (err: any) {
      setError("Invalid email credentials or password.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans p-4 relative overflow-hidden">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="bg-white max-w-md w-full rounded-[24px] shadow-2xl shadow-slate-200/50 border border-slate-100 p-8 relative z-10 animate-fade-in">
        
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-600/30">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">MyanHub</h1>
          <p className="text-slate-500 font-medium text-sm">
            {isLogin ? 'Secure access to your workspace.' : 'Apply for a commercial workspace.'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          {error && (
            <div className="bg-rose-50 text-rose-600 p-3.5 rounded-xl text-sm font-bold text-center border border-rose-100 flex items-center justify-center gap-2 animate-fade-in">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
            </div>
          )}
          
          {message && (
            <div className="bg-indigo-50 text-indigo-700 p-4 rounded-xl text-sm font-bold text-center border border-indigo-100 leading-relaxed animate-fade-in">
              {message}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              {/* 🚀 BUG FIX: Explicit text-slate-900 added here */}
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                placeholder="manager@workspace.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              {/* 🚀 BUG FIX: Explicit text-slate-900 added here */}
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                placeholder="••••••••"
                required
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading || (!email || !password && isLogin)}
            className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 disabled:shadow-none flex items-center justify-center gap-2 mt-2"
          >
            {isLoading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Authenticating...</>
            ) : (
              <>{isLogin ? 'Access Workspace' : 'Submit Request'} <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-slate-100 pt-6">
          <button 
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setMessage('');
            }} 
            className="text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors"
          >
            {isLogin ? "Don't have an account? Request access." : "Already approved? Sign in here."}
          </button>
        </div>

      </div>
    </div>
  );
}