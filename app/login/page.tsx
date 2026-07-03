"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        // NEW: Check role immediately upon login
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        // Push to the correct portal based on their assigned role
        if (profile?.role === 'driver') {
          router.push('/driver');
        } else {
          router.push('/');
        }
      }
    } catch (err: any) {
      setError("Invalid email or password.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans p-4">
      <div className="bg-white max-w-md w-full rounded-2xl shadow-xl border border-slate-100 p-8">
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-indigo-600 tracking-tight mb-2">MyanHub</h1>
          <p className="text-slate-500 font-medium">
            {isLogin ? 'Welcome back to your dashboard' : 'Apply for a MyanHub account'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium text-center border border-red-100">
              {error}
            </div>
          )}
          
          {message && (
            <div className="bg-indigo-50 text-indigo-700 p-4 rounded-lg text-sm font-medium text-center border border-indigo-100 leading-relaxed">
              {message}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Email Address</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              placeholder="manager@shop.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-indigo-600 text-white font-semibold py-2.5 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {isLoading ? 'Signing in...' : (isLogin ? 'Sign In' : 'Request Access')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setMessage('');
            }} 
            className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>

      </div>
    </div>
  );
}