"use client";

import { formatNumber, formatCurrency } from '../../lib/formatters';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import Papa from 'papaparse';
import { 
  Package, Plus, FileSpreadsheet, ScanLine, Trash2, 
  UploadCloud, AlertCircle, CheckCircle2, X, RefreshCw, Box
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  created_at: string;
}

export default function InventoryManagement() {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  
  const [userId, setUserId] = useState<string | null>(null);
  const [inventory, setInventory] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals State
  const [activeModal, setActiveModal] = useState<'none' | 'manual' | 'csv' | 'ocr'>('none');

  // Manual Add States
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formQty, setFormQty] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // CSV Bulk Upload States
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvStatus, setCsvStatus] = useState<{type: 'idle'|'processing'|'success'|'error', msg: string}>({type: 'idle', msg: ''});

  // OCR Scan States
  const [ocrImage, setOcrImage] = useState<File | null>(null);
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = useState<{type: 'idle'|'scanning'|'success'|'error', msg: string}>({type: 'idle', msg: ''});
  const [extractedReceipt, setExtractedReceipt] = useState<any | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) { router.replace('/login'); return; }
      setUserId(session.user.id);
    };
    checkSession();
  }, [router]);

  const fetchInventory = async () => {
    if (!userId) return;
    const { data, error } = await supabase.from('inventory').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (!error && data) setInventory(data as Product[]);
    setLoading(false);
  };

  useEffect(() => { if (userId) fetchInventory(); }, [userId]);

  // 1. MANUAL ADD LOGIC
  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setIsSubmitting(true);
    
    const { error } = await supabase.from('inventory').insert({
      user_id: userId, name: formName, price: parseFloat(formPrice), stock_quantity: parseInt(formQty)
    });

    setIsSubmitting(false);
    if (error) { alert(`Error: ${error.message}`); } 
    else { setFormName(''); setFormPrice(''); setFormQty(''); setActiveModal('none'); fetchInventory(); }
  };

  const handleDelete = async (id: string) => {
    if(!confirm("Are you sure you want to delete this product?")) return;
    await supabase.from('inventory').delete().eq('id', id);
    setInventory(prev => prev.filter(p => p.id !== id));
  };

  // 2. BULK CSV UPLOAD LOGIC
  const handleCsvUpload = async () => {
    if (!csvFile || !userId) return;
    setCsvStatus({ type: 'processing', msg: 'Parsing CSV data...' });

    Papa.parse(csvFile, {
      header: true, skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        const payload = rows.map(row => ({
          user_id: userId,
          name: row.name || row.Name || row.NAME || 'Unknown Item',
          price: parseFloat(row.price || row.Price || row.PRICE || '0'),
          stock_quantity: parseInt(row.quantity || row.Quantity || row.qty || row.QTY || '0')
        }));

        if (payload.length === 0) { setCsvStatus({ type: 'error', msg: 'No valid rows found in CSV.' }); return; }
        setCsvStatus({ type: 'processing', msg: `Uploading ${payload.length} items to database...` });
        
        const { error } = await supabase.from('inventory').insert(payload);
        if (error) { setCsvStatus({ type: 'error', msg: error.message }); } 
        else {
          setCsvStatus({ type: 'success', msg: `Successfully imported ${payload.length} items!` });
          fetchInventory();
          setTimeout(() => { setActiveModal('none'); setCsvFile(null); setCsvStatus({type: 'idle', msg: ''}); }, 2000);
        }
      },
      error: (error) => { setCsvStatus({ type: 'error', msg: `Parse Error: ${error.message}` }); }
    });
  };

  // 3. AI DOCUMENT OCR SCANNER
  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setOcrImage(file);
      setOcrPreviewUrl(URL.createObjectURL(file));
      setOcrStatus({ type: 'idle', msg: '' });
      setExtractedReceipt(null);
    }
  };

  const toBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const processOcrScan = async () => {
    if (!ocrImage) return;
    setOcrStatus({ type: 'scanning', msg: 'Uploading to Vision AI...' });

    try {
      const base64Image = await toBase64(ocrImage);
      setOcrStatus({ type: 'scanning', msg: 'AI is analyzing receipt layout & items...' });
      
      const response = await fetch('/api/ocr-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64Image })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unknown server error");

      setExtractedReceipt(result.data);
      setOcrStatus({ type: 'success', msg: `Successfully extracted ${result.data.items?.length || 0} items!` });

    } catch (error: any) {
      setOcrStatus({ type: 'error', msg: `AI Error: ${error.message}` });
    }
  };

  const handleSaveBulkOcrItems = async () => {
    if (!userId || !extractedReceipt || !extractedReceipt.items) return;
    setIsSubmitting(true);
    
    const payload = extractedReceipt.items.map((item: any) => ({
      user_id: userId,
      name: item.name || 'Unknown Receipt Item',
      price: item.unitPrice || 0,
      stock_quantity: item.quantity || 1
    }));

    const { error } = await supabase.from('inventory').insert(payload);

    setIsSubmitting(false);
    if (error) { alert(`Database Error: ${error.message}`); } 
    else {
      setActiveModal('none');
      setOcrImage(null); setOcrPreviewUrl(null); setExtractedReceipt(null);
      fetchInventory();
    }
  };


  if (!userId) return <div className={`min-h-screen ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}></div>;

  return (
    <div className={`flex font-sans min-h-screen transition-colors duration-200 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <Sidebar />
      <main className="flex-1 md:ml-64 flex flex-col relative h-screen overflow-hidden">
        <Header />
        
        <div className="flex-1 overflow-y-auto mt-16 p-4 md:p-8">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Inventory Matrix</h2>
              <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Manage stock levels, bulk import CSVs, or use AI slip extraction.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setActiveModal('ocr')} className="px-4 py-2.5 rounded-lg text-sm font-bold border transition flex items-center gap-2 bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20 dark:hover:bg-indigo-500/20">
                <ScanLine size={16} /> Scan Slip (OCR)
              </button>
              <button onClick={() => setActiveModal('csv')} className={`px-4 py-2.5 rounded-lg text-sm font-bold border transition flex items-center gap-2 ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
                <FileSpreadsheet size={16} /> Bulk CSV
              </button>
              <button onClick={() => setActiveModal('manual')} className="px-4 py-2.5 rounded-lg text-sm font-bold transition flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 shadow-md">
                <Plus size={16} /> Add Item
              </button>
            </div>
          </div>

          <div className={`rounded-2xl border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className={`uppercase text-[10px] font-black tracking-wider ${isDarkMode ? 'bg-slate-950/50 text-slate-500' : 'bg-slate-50 text-slate-500'}`}>
                  <tr>
                    <th className="p-4 border-b border-slate-200 dark:border-slate-800">Product Name</th>
                    <th className="p-4 border-b border-slate-200 dark:border-slate-800">Unit Price</th>
                    <th className="p-4 border-b border-slate-200 dark:border-slate-800">Stock Qty</th>
                    <th className="p-4 border-b border-slate-200 dark:border-slate-800 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                  {loading ? (
                    <tr><td colSpan={4} className="p-8 text-center font-mono text-indigo-500 animate-pulse">SYNCING INVENTORY...</td></tr>
                  ) : inventory.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-slate-500">No products found. Add items to begin.</td></tr>
                  ) : (
                    inventory.map(item => (
                      <tr key={item.id} className={`transition-colors ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                        <td className="p-4 font-bold flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`}><Box size={14}/></div>
                          {item.name}
                        </td>
                        <td className="p-4 font-black text-indigo-500">{formatCurrency(item.price, 'USD')}</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${item.stock_quantity > 10 ? (isDarkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700') : (isDarkMode ? 'bg-rose-500/10 text-rose-400' : 'bg-rose-50 text-rose-700')}`}>
                            {formatNumber(item.stock_quantity)} IN STOCK
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button onClick={() => handleDelete(item.id)} className={`p-1.5 rounded transition ${isDarkMode ? 'text-slate-500 hover:bg-rose-500/10 hover:text-rose-400' : 'text-slate-400 hover:bg-rose-50 hover:text-rose-600'}`}><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* MODAL 1: MANUAL ADD */}
        {activeModal === 'manual' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setActiveModal('none')}>
            <div className={`w-full max-w-md p-6 rounded-2xl shadow-xl ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2"><Package className="text-indigo-500"/> Add Product</h3>
                <button onClick={() => setActiveModal('none')} className="p-1 rounded opacity-50 hover:opacity-100"><X size={20}/></button>
              </div>
              <form onSubmit={handleManualAdd} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase mb-1 opacity-70">Product Name</label>
                  <input type="text" required value={formName} onChange={e => setFormName(e.target.value)} className={`w-full p-3 rounded-lg text-sm focus:outline-none border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase mb-1 opacity-70">Price</label>
                    <input type="number" step="0.01" required value={formPrice} onChange={e => setFormPrice(e.target.value)} className={`w-full p-3 rounded-lg text-sm focus:outline-none border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase mb-1 opacity-70">Initial Stock</label>
                    <input type="number" required value={formQty} onChange={e => setFormQty(e.target.value)} className={`w-full p-3 rounded-lg text-sm focus:outline-none border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`} />
                  </div>
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg mt-4 transition-all">
                  {isSubmitting ? 'Saving...' : 'Save Product'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: BULK CSV UPLOAD */}
        {activeModal === 'csv' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setActiveModal('none')}>
            <div className={`w-full max-w-md p-6 rounded-2xl shadow-xl ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2"><FileSpreadsheet className="text-indigo-500"/> Bulk Import</h3>
                <button onClick={() => setActiveModal('none')} className="p-1 rounded opacity-50 hover:opacity-100"><X size={20}/></button>
              </div>

              <div className="space-y-4">
                <div className={`p-4 rounded-lg text-xs border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                  <strong>Required CSV Format:</strong> Ensure your file has a header row with columns specifically named: <code className="text-indigo-500">name, price, quantity</code>
                </div>

                <label className={`w-full flex flex-col items-center justify-center py-10 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${csvFile ? (isDarkMode ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' : 'border-emerald-500 bg-emerald-50 text-emerald-600') : (isDarkMode ? 'border-slate-700 hover:border-indigo-500/50 bg-slate-950 hover:bg-slate-900 text-slate-400' : 'border-slate-300 hover:border-indigo-500 bg-slate-50 hover:bg-slate-100 text-slate-500')}`}>
                  <UploadCloud size={32} className="mb-2" />
                  <span className="text-sm font-bold">{csvFile ? csvFile.name : 'Click to select CSV File'}</span>
                  <input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} className="hidden" />
                </label>

                {csvStatus.msg && (
                  <div className={`p-3 rounded-lg text-xs font-bold flex items-center gap-2 ${csvStatus.type === 'error' ? 'bg-rose-500/10 text-rose-500' : csvStatus.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
                    {csvStatus.type === 'processing' ? <RefreshCw size={14} className="animate-spin" /> : csvStatus.type === 'error' ? <AlertCircle size={14}/> : <CheckCircle2 size={14}/>}
                    {csvStatus.msg}
                  </div>
                )}

                <button onClick={handleCsvUpload} disabled={!csvFile || csvStatus.type === 'processing'} className="w-full bg-slate-900 dark:bg-indigo-600 text-white font-bold py-3 rounded-lg mt-2 transition-all disabled:opacity-50">
                  Execute Bulk Import
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 3: AI DOCUMENT OCR SCANNER */}
        {activeModal === 'ocr' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setActiveModal('none')}>
            <div className={`w-full max-w-3xl p-6 rounded-2xl shadow-xl flex flex-col max-h-[90vh] ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2"><ScanLine className="text-indigo-500"/> AI Receipt Extraction</h3>
                <button onClick={() => setActiveModal('none')} className="p-1 rounded opacity-50 hover:opacity-100"><X size={20}/></button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-5 custom-scrollbar pr-2">
                {!ocrPreviewUrl ? (
                  <label className={`w-full flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${isDarkMode ? 'border-slate-700 hover:border-indigo-500/50 bg-slate-950 hover:bg-slate-900 text-slate-400' : 'border-slate-300 hover:border-indigo-500 bg-slate-50 hover:bg-slate-100 text-slate-500'}`}>
                    <ScanLine size={40} className="mb-3 opacity-50" />
                    <span className="text-base font-bold">Snap or Upload Supplier Receipt</span>
                    <span className="text-xs opacity-60 mt-1">Vision AI will auto-extract all line items regardless of language.</span>
                    <input type="file" accept="image/*" capture="environment" onChange={handleImageCapture} className="hidden" />
                  </label>
                ) : (
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <img src={ocrPreviewUrl} alt="Slip" className="w-1/3 object-contain max-h-48 rounded-lg border border-slate-200 dark:border-slate-700" />
                      <div className="flex-1 flex flex-col justify-center">
                        {ocrStatus.type === 'idle' && (
                          <button onClick={processOcrScan} className="bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg shadow w-full flex justify-center gap-2"><ScanLine size={18}/> Run AI Extraction</button>
                        )}
                        {ocrStatus.type === 'scanning' && (
                          <div className="text-center p-4 border rounded-lg bg-indigo-500/10 text-indigo-500 border-indigo-500/20 font-bold text-sm flex flex-col items-center gap-2">
                            <RefreshCw size={20} className="animate-spin" /> {ocrStatus.msg}
                          </div>
                        )}
                        {ocrStatus.type === 'success' && (
                          <div className="p-4 border rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold text-sm flex items-center gap-2">
                            <CheckCircle2 size={18}/> {ocrStatus.msg}
                          </div>
                        )}
                        
                        {ocrStatus.type === 'error' && (
                          <div className="p-4 border rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 font-bold text-sm flex flex-col items-center gap-2 text-center">
                            <AlertCircle size={20} />
                            {ocrStatus.msg}
                            <button onClick={() => setOcrStatus({type: 'idle', msg: ''})} className="mt-2 text-xs underline text-rose-500 hover:text-rose-600 cursor-pointer">Try Again</button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* STRUCTURED DATA REVIEW PANEL */}
                    {ocrStatus.type === 'success' && extractedReceipt && (
                      <div className="animate-fade-in border-t border-slate-200 dark:border-slate-800 pt-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                          <div><span className="block text-[9px] uppercase font-bold text-slate-500">Store</span><span className="text-sm font-semibold">{extractedReceipt.storeName || 'N/A'}</span></div>
                          <div><span className="block text-[9px] uppercase font-bold text-slate-500">Receipt No</span><span className="text-sm font-semibold">{extractedReceipt.receiptNo || 'N/A'}</span></div>
                          <div><span className="block text-[9px] uppercase font-bold text-slate-500">Date</span><span className="text-sm font-semibold">{extractedReceipt.date || 'N/A'}</span></div>
                          <div><span className="block text-[9px] uppercase font-bold text-slate-500">Total</span><span className="text-sm font-black text-indigo-500">{formatCurrency(extractedReceipt.total, 'USD')}</span></div>
                        </div>

                        <h4 className="text-xs font-black uppercase text-indigo-500 mb-3 flex items-center gap-2"><Package size={14}/> Extracted Items ({extractedReceipt.items?.length || 0})</h4>
                        
                        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mb-6">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-slate-100 dark:bg-slate-950 text-[10px] uppercase text-slate-500 font-bold">
                              <tr>
                                <th className="p-3">Item Name</th>
                                <th className="p-3 w-20">Qty</th>
                                <th className="p-3 w-24">Unit Price</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {extractedReceipt.items?.map((item: any, idx: number) => (
                                <tr key={idx} className="bg-white dark:bg-slate-900">
                                  <td className="p-3 font-semibold">{item.name}</td>
                                  <td className="p-3 font-mono">{formatNumber(item.quantity)}</td>
                                  <td className="p-3 font-mono">{formatCurrency(item.unitPrice, 'USD')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <button onClick={handleSaveBulkOcrItems} disabled={isSubmitting} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-md transition-all">
                          {isSubmitting ? 'Syncing to Database...' : `Auto-Create ${extractedReceipt.items?.length || 0} Inventory Items`}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}