"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { 
  Package, Plus, Search, Edit2, Trash2, AlertTriangle, ArrowUpDown, DollarSign, X
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock_quantity: number;
  created_at: string;
}

export default function Inventory() {
  const { isDarkMode } = useTheme();
  
  const [userId, setUserId] = useState<string | null>(null);
  const [inventory, setInventory] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form States
  const [formName, setFormName] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formQty, setFormQty] = useState('');
  const [formProcessing, setFormProcessing] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        fetchInventory(user.id);
      }
    };
    initialize();
  }, []);

  const fetchInventory = async (uid: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("Fetch Error:", error);
    } else if (data) {
      setInventory(data as Product[]);
    }
    setLoading(false);
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingId(product.id);
      setFormName(product.name);
      setFormSku(product.sku || '');
      setFormPrice(product.price.toString());
      setFormQty(product.stock_quantity.toString());
    } else {
      setEditingId(null);
      setFormName('');
      setFormSku('');
      setFormPrice('');
      setFormQty('');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setFormProcessing(true);

    const payload = {
      user_id: userId,
      name: formName,
      sku: formSku,
      price: parseFloat(formPrice) || 0,
      stock_quantity: parseInt(formQty, 10) || 0,
    };

    try {
      if (editingId) {
        // Update existing
        const { error } = await supabase.from('inventory').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase.from('inventory').insert(payload);
        if (error) throw error;
      }

      await fetchInventory(userId);
      setIsModalOpen(false);
    } catch (error: any) {
      // NEW: Catch the error and force a popup so we know EXACTLY what failed
      alert(`Database Error: ${error.message}`);
    } finally {
      setFormProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    
    try {
      const { error } = await supabase.from('inventory').delete().eq('id', id);
      if (error) throw error;
      setInventory(prev => prev.filter(p => p.id !== id));
    } catch (error: any) {
      alert(`Delete Error: ${error.message}`);
    }
  };

  // Derived Metrics
  const totalProducts = inventory.length;
  const lowStockCount = inventory.filter(p => p.stock_quantity > 0 && p.stock_quantity <= 5).length;
  const outOfStockCount = inventory.filter(p => p.stock_quantity === 0).length;
  const inventoryValue = inventory.reduce((sum, p) => sum + (p.price * p.stock_quantity), 0);

  // Filtered List
  const filteredInventory = inventory.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`flex font-sans min-h-screen transition-colors duration-200 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <Sidebar />
      <main className="flex-1 md:ml-64 flex flex-col relative h-screen overflow-hidden">
        <Header />
        
        <div className="flex-1 overflow-y-auto mt-16 p-6 md:p-8 space-y-8">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Stock Management</h2>
              <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Track inventory levels, manage pricing, and monitor stock alerts.
              </p>
            </div>
            <button 
              onClick={() => openModal()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-md transition-colors flex items-center gap-2"
            >
              <Plus size={16} /> Add Product
            </button>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className={`p-5 rounded-2xl border shadow-sm transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex justify-between items-center mb-2">
                <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Total Items</span>
                <Package size={16} className="text-indigo-500" />
              </div>
              <div className="text-2xl font-black">{totalProducts}</div>
            </div>

            <div className={`p-5 rounded-2xl border shadow-sm transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex justify-between items-center mb-2">
                <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Stock Value</span>
                <DollarSign size={16} className="text-emerald-500" />
              </div>
              <div className="text-2xl font-black">${inventoryValue.toFixed(2)}</div>
            </div>

            <div className={`p-5 rounded-2xl border shadow-sm transition-colors ${isDarkMode ? 'bg-rose-950/20 border-rose-900/30' : 'bg-rose-50 border-rose-100'}`}>
              <div className="flex justify-between items-center mb-2">
                <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-rose-400' : 'text-rose-600'}`}>Out of Stock</span>
                <AlertTriangle size={16} className="text-rose-500" />
              </div>
              <div className={`text-2xl font-black ${isDarkMode ? 'text-rose-500' : 'text-rose-600'}`}>{outOfStockCount}</div>
            </div>

            <div className={`p-5 rounded-2xl border shadow-sm transition-colors ${isDarkMode ? 'bg-amber-950/20 border-amber-900/30' : 'bg-amber-50 border-amber-100'}`}>
              <div className="flex justify-between items-center mb-2">
                <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>Low Stock Alert</span>
                <ArrowUpDown size={16} className="text-amber-500" />
              </div>
              <div className={`text-2xl font-black ${isDarkMode ? 'text-amber-500' : 'text-amber-600'}`}>{lowStockCount}</div>
            </div>
          </div>

          {/* Main Data Table */}
          <div className={`rounded-2xl border shadow-sm overflow-hidden flex flex-col ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className={`p-5 border-b flex justify-between items-center gap-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="relative flex-1 max-w-md">
                <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by product name or SKU..." 
                  className={`w-full pl-10 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'}`}
                />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`text-xs font-bold uppercase tracking-wider border-b ${isDarkMode ? 'bg-slate-950/50 text-slate-400 border-slate-800' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                    <th className="px-6 py-4">Product Name</th>
                    <th className="px-6 py-4">SKU</th>
                    <th className="px-6 py-4 text-right">Price</th>
                    <th className="px-6 py-4 text-center">Stock Qty</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800/50' : 'divide-slate-100'}`}>
                  {loading ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-sm font-mono text-indigo-500 animate-pulse">LOADING INVENTORY...</td></tr>
                  ) : filteredInventory.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">No products found matching your criteria.</td></tr>
                  ) : (
                    filteredInventory.map((item) => (
                      <tr key={item.id} className={`transition-colors ${isDarkMode ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'}`}>
                        <td className="px-6 py-4 font-bold text-sm">{item.name}</td>
                        <td className={`px-6 py-4 font-mono text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{item.sku || '---'}</td>
                        <td className="px-6 py-4 text-right font-medium">${Number(item.price).toFixed(2)}</td>
                        <td className="px-6 py-4 text-center font-bold">{item.stock_quantity}</td>
                        <td className="px-6 py-4 text-center">
                          {item.stock_quantity === 0 ? (
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${isDarkMode ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>Out of Stock</span>
                          ) : item.stock_quantity <= 5 ? (
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${isDarkMode ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>Low Stock</span>
                          ) : (
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>In Stock</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button onClick={() => openModal(item)} className={`p-1.5 rounded transition-colors ${isDarkMode ? 'text-slate-400 hover:text-indigo-400 hover:bg-slate-800' : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-100'}`}><Edit2 size={16} /></button>
                          <button onClick={() => handleDelete(item.id)} className={`p-1.5 rounded transition-colors ${isDarkMode ? 'text-slate-400 hover:text-rose-400 hover:bg-slate-800' : 'text-slate-500 hover:text-rose-600 hover:bg-slate-100'}`}><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Overlay for Add/Edit */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className={`w-full max-w-md p-6 rounded-2xl shadow-xl ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">{editingId ? 'Edit Product' : 'Add New Product'}</h3>
                <button onClick={() => setIsModalOpen(false)} className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}><X size={20} /></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={`block text-xs font-bold uppercase mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Product Name *</label>
                  <input type="text" required value={formName} onChange={e => setFormName(e.target.value)} className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'}`} placeholder="e.g. Premium Wireless Headphones" />
                </div>
                <div>
                  <label className={`block text-xs font-bold uppercase mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>SKU (Stock Keeping Unit)</label>
                  <input type="text" value={formSku} onChange={e => setFormSku(e.target.value)} className={`w-full px-4 py-2.5 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'}`} placeholder="e.g. WH-PRO-01" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-xs font-bold uppercase mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Retail Price ($)</label>
                    <input type="number" step="0.01" value={formPrice} onChange={e => setFormPrice(e.target.value)} className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'}`} placeholder="0.00" />
                  </div>
                  <div>
                    <label className={`block text-xs font-bold uppercase mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Quantity in Stock</label>
                    <input type="number" required value={formQty} onChange={e => setFormQty(e.target.value)} className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'}`} placeholder="0" />
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold border transition ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'}`}>Cancel</button>
                  <button type="submit" disabled={formProcessing} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-6 py-2.5 rounded-lg transition-all shadow-md disabled:opacity-50">
                    {formProcessing ? 'Saving...' : (editingId ? 'Save Changes' : 'Add Product')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}