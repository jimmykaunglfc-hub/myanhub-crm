import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export default function InboxPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      <Sidebar />
      
      <main className="flex-1 md:ml-64 flex flex-col relative">
        <Header />
        
        <div className="flex-1 overflow-y-auto mt-16 p-6 md:p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Unified Inbox</h2>
            <p className="text-slate-500 mt-1">Manage all your Facebook and TikTok messages here.</p>
          </div>
          
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm h-[500px] flex items-center justify-center">
             <p className="text-slate-400">Message list will load here...</p>
          </div>
        </div>
      </main>
    </div>
  );
}