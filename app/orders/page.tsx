import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export default function OrdersPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      <Sidebar />
      <main className="flex-1 md:ml-64 flex flex-col relative">
        <Header />
        <div className="flex-1 overflow-y-auto mt-16 p-6 md:p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Orders</h2>
            <p className="text-slate-500 mt-1">Track fulfillments and sales from all connected shops.</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm h-[500px] flex items-center justify-center">
             <p className="text-slate-400">Order tracking table will load here...</p>
          </div>
        </div>
      </main>
    </div>
  );
}