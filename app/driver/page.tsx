"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { 
  Truck, MapPin, Phone, Camera, CheckCircle2, ChevronRight, X, Receipt 
} from 'lucide-react';

interface Order {
  id: string;
  order_id_string: string;
  total_amount: number;
  status: string;
  payment_status: string;
  created_at: string;
  customers: { name: string } | null;
}

export default function DriverApp() {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  
  const [userId, setUserId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Delivery Modal States
  const [activeDelivery, setActiveDelivery] = useState<Order | null>(null);
  const [paymentStatus, setPaymentStatus] = useState('Cash Received');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        router.replace('/login');
        return;
      }
      setUserId(session.user.id);
    };
    checkSession();
  }, [router]);

  const fetchDeliveries = async () => {
    if (!userId) return;
    // Fetch ONLY orders that are 'in_transit' for the driver to handle
    const { data, error } = await supabase
      .from('orders')
      .select('*, customers(name)')
      .eq('user_id', userId)
      .eq('status', 'in_transit')
      .order('created_at', { ascending: true });

    if (!error && data) setDeliveries(data as Order[]);
    setLoading(false);
  };

  useEffect(() => { if (userId) fetchDeliveries(); }, [userId]);

  const submitDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDelivery) return;
    setIsSubmitting(true);

    try {
      let uploadedUrl = null;

      if (evidenceFile) {
        const fileExt = evidenceFile.name.split('.').pop();
        const fileName = `delivery-${activeDelivery.id}-${Math.random()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('delivery_evidence')
          .upload(fileName, evidenceFile);
          
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('delivery_evidence')
          .getPublicUrl(fileName);
          
        uploadedUrl = publicUrl;
      }

      const { error: dbError } = await supabase.from('orders').update({ 
        status: 'fulfilled',
        payment_status: paymentStatus,
        delivery_evidence_url: uploadedUrl
      }).eq('id', activeDelivery.id);

      if (dbError) throw dbError;

      // Close and refresh
      setActiveDelivery(null);
      setEvidenceFile(null);
      fetchDeliveries();

    } catch (error: any) {
      alert(`Delivery failed: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!userId) return <div className={`min-h-screen ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}></div>;

  return (
    <div className={`min-h-screen font-sans flex flex-col ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Mobile Header */}
      <header className={`pt-12 pb-4 px-6 shadow-sm z-10 ${isDarkMode ? 'bg-slate-900' : 'bg-indigo-600 text-white'}`}>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-black tracking-tight">Driver Portal</h1>
            <p className="text-xs opacity-80 mt-0.5">{deliveries.length} active routes today</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md">
            <Truck size={20} />
          </div>
        </div>
      </header>

      {/* Delivery List */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="text-center text-sm font-bold opacity-50 py-10 animate-pulse">SYNCING ROUTES...</div>
        ) : deliveries.length === 0 ? (
          <div className="text-center py-20">
            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-indigo-100 text-indigo-400'}`}>
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-lg font-bold">All caught up!</h3>
            <p className="text-sm opacity-60">No pending deliveries right now.</p>
          </div>
        ) : (
          deliveries.map(order => (
            <div 
              key={order.id} 
              onClick={() => setActiveDelivery(order)}
              className={`p-5 rounded-2xl shadow-sm border active:scale-95 transition-transform cursor-pointer ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-sm font-bold font-mono">{order.order_id_string}</h3>
                  <p className={`text-lg font-black mt-1 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    ${Number(order.total_amount).toFixed(2)}
                  </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                  In Transit
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm font-medium">
                  <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}><MapPin size={16} /></div>
                  {order.customers?.name || 'Unknown Customer'}
                </div>
              </div>

              <div className={`mt-5 pt-4 border-t flex justify-between items-center ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <span className="text-xs font-bold text-indigo-500">Tap to complete delivery</span>
                <ChevronRight size={16} className="text-indigo-500" />
              </div>
            </div>
          ))
        )}
      </main>

      {/* Full Screen Delivery Confirmation Modal */}
      {activeDelivery && (
        <div className={`fixed inset-0 z-50 flex flex-col animate-slide-up ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
          <div className={`pt-12 pb-4 px-6 flex justify-between items-center border-b ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h2 className="text-lg font-bold">Complete Order</h2>
            <button onClick={() => setActiveDelivery(null)} className="p-2 bg-slate-200 dark:bg-slate-800 rounded-full"><X size={20} /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-black font-mono">{activeDelivery.order_id_string}</h3>
              <p className="text-sm font-medium opacity-60 mt-1">{activeDelivery.customers?.name}</p>
              <div className={`inline-block mt-4 px-6 py-2 rounded-xl text-xl font-black ${isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
                Collect: ${Number(activeDelivery.total_amount).toFixed(2)}
              </div>
            </div>

            <form onSubmit={submitDelivery} className="space-y-6">
              {/* Payment Collection */}
              <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <label className="flex items-center gap-2 text-sm font-bold mb-3 uppercase tracking-wider text-slate-500"><Receipt size={16} /> Payment Status</label>
                <select 
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className={`w-full px-4 py-4 rounded-xl text-base font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 border appearance-none ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                >
                  <option value="Cash Received">Cash Received (COD)</option>
                  <option value="Already Paid (Online)">Already Paid Online</option>
                  <option value="Transferred on Delivery">Bank Transfer</option>
                  <option value="Pending">Payment Failed</option>
                </select>
              </div>

              {/* Camera Upload */}
              <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <label className="flex items-center gap-2 text-sm font-bold mb-3 uppercase tracking-wider text-slate-500"><Camera size={16} /> Photo Evidence</label>
                <label className={`w-full flex flex-col items-center justify-center py-10 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${evidenceFile ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : (isDarkMode ? 'border-slate-700 bg-slate-950 text-slate-400' : 'border-slate-300 bg-slate-50 text-slate-500')}`}>
                  <Camera size={36} className="mb-3" />
                  <span className="text-base font-bold">{evidenceFile ? 'Photo Captured!' : 'Tap to Open Camera'}</span>
                  {/* MAGIC: capture="environment" opens the rear camera directly on phones! */}
                  <input type="file" accept="image/*" capture="environment" onChange={(e) => e.target.files && setEvidenceFile(e.target.files[0])} className="hidden" />
                </label>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-lg py-5 rounded-2xl transition-all shadow-lg shadow-indigo-500/30 disabled:opacity-50 active:scale-95">
                {isSubmitting ? 'Uploading Data...' : 'Mark as Delivered'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}