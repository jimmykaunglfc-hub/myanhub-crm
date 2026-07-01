"use client";

import { useState } from 'react';

export default function AdminPanel() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('Provisioning digital workspace...');

    const res = await fetch('/api/create-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (data.success) {
      setStatus(`Success! Workspace created for ${email}`);
      setEmail(''); setPassword('');
    } else {
      setStatus(`Provisioning Error: ${data.error}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6 font-sans">
      <div className="bg-slate-800 p-8 rounded-xl max-w-md w-full border border-slate-700 shadow-2xl">
        <h2 className="text-xl font-bold mb-1 text-indigo-400">MyanHub Workspace Provisioner</h2>
        <p className="text-slate-400 text-xs mb-6">Register secure access nodes for incoming premium clients.</p>
        
        <form onSubmit={handleCreateClient} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Client Admin Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-sm focus:outline-none focus:border-indigo-500 transition" placeholder="client@shop.com" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Assigned Passkey</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-sm focus:outline-none focus:border-indigo-500 transition" placeholder="••••••••" />
          </div>
          <button type="submit" className="w-full bg-indigo-600 text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-indigo-500 transition shadow-lg">Provision New Client</button>
        </form>
        {status && <p className="mt-4 text-xs font-medium text-center text-amber-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-700/50">{status}</p>}
      </div>
    </div>
  );
}