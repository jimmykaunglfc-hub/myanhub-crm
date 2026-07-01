import Link from 'next/link';
import { LayoutDashboard, Inbox, Users, ShoppingCart, Settings } from 'lucide-react';

export default function Sidebar() {
  return (
    <aside className="hidden md:flex bg-white fixed left-0 top-0 h-full w-64 border-r border-slate-200 flex-col py-6 px-4 z-50">
      <div className="mb-10 px-2">
        <h1 className="text-2xl font-extrabold text-indigo-600 tracking-tight">MyanHub</h1>
      </div>
      
      <nav className="flex-1 space-y-1">
        <Link href="/" className="flex items-center gap-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg px-3 py-2.5 font-medium transition-colors">
          <LayoutDashboard size={20} />
          Dashboard
        </Link>
        <Link href="/inbox" className="flex items-center gap-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg px-3 py-2.5 font-medium transition-colors">
          <Inbox size={20} />
          Unified Inbox
          <span className="ml-auto bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">3</span>
        </Link>
        <Link href="/customers" className="flex items-center gap-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg px-3 py-2.5 font-medium transition-colors">
          <Users size={20} />
          Customers
        </Link>
        <Link href="/orders" className="flex items-center gap-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg px-3 py-2.5 font-medium transition-colors">
          <ShoppingCart size={20} />
          Orders
        </Link>
      </nav>

      <div className="mt-auto pt-6 border-t border-slate-200">
        <Link href="/settings" className="flex items-center gap-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg px-3 py-2.5 font-medium transition-colors mb-4">
          <Settings size={20} />
          Settings
        </Link>
        <div className="flex items-center gap-3 px-3">
          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">SM</div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Shop Manager</p>
            <p className="text-xs text-slate-500">Pro Account</p>
          </div>
        </div>
      </div>
    </aside>
  );
}