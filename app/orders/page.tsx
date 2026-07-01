"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

interface Order {
  id: string;
  order_id_string: string;
  total_amount: number;
  status: string;
  customers: {
    name: string;
  } | null;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      // Fetches orders and performs an automatic backend join to get the customer's name
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_id_string,
          total_amount,
          status,
          customers ( name )
        `);
      
      if (!error && data) {
        // Cast the data to our Order array type safely
        setOrders(data as unknown as Order[]);
      }
      setLoading(false);
    };

    fetchOrders();
  }, []);

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

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-slate-500">Loading orders...</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-4">Order ID</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-mono text-sm font-semibold text-slate-700">{order.order_id_string}</td>
                      <td className="px-6 py-4 text-slate-900 font-medium">
                        {order.customers?.name || "Unknown Customer"}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900">${Number(order.total_amount).toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wider ${
                          order.status === 'shipped' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {order.status}
                        </span>
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