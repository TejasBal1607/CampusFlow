import { useState, useEffect } from 'react';
import axios from 'axios';
import { Shield, XCircle, Trash2, Database, AlertOctagon, RefreshCw, Search } from 'lucide-react';

const API_HOST = (import.meta as any).env.VITE_API_URL || 'http://localhost:8000';

export default function AdminDashboard({ navigateTo }: { navigateTo: (tab: string) => void }) {
  const token = localStorage.getItem('cf_token');
  
  const [mainTab, setMainTab] = useState<'moderator' | 'database'>('moderator');
  
  // 🚀 REPLACED TIMETABLES WITH MARKET & EVENTS
  const [modTab, setModTab] = useState<'menus' | 'vault' | 'market' | 'events'>('menus');
  const [menus, setMenus] = useState<any[]>([]);
  const [vaultItems, setVaultItems] = useState<any[]>([]);
  const [marketItems, setMarketItems] = useState<any[]>([]);
  const [eventItems, setEventItems] = useState<any[]>([]);

  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tableData, setTableData] = useState<any[]>([]);
  const [editingRow, setEditingRow] = useState<any>(null);
  const [editJson, setEditJson] = useState('');

  const executeDbAction = async (action: 'update' | 'delete' | 'insert') => {
    try {
      const payload = JSON.parse(editJson);
      await axios.post(`${API_HOST}/admin/db/table/${selectedTable}/raw?action=${action}&token=${token}`, payload);
      setEditingRow(null);
      fetchTableRows(selectedTable);
      alert(`Successfully executed ${action}`);
    } catch (e: any) { alert("DB Error: " + (e.response?.data?.detail || e.message)); }
  };

  const fetchModeratorData = async () => {
    try {
      if (modTab === 'menus') setMenus((await axios.get(`${API_HOST}/admin/menus?token=${token}`)).data);
      else if (modTab === 'vault') setVaultItems((await axios.get(`${API_HOST}/admin/vault?token=${token}`)).data);
      else if (modTab === 'market') setMarketItems((await axios.get(`${API_HOST}/admin/market?token=${token}`)).data);
      else if (modTab === 'events') setEventItems((await axios.get(`${API_HOST}/admin/events?token=${token}`)).data);
    } catch (e) { console.error("Fetch Error"); }
  };

  const fetchTables = async () => {
    try { setTables((await axios.get(`${API_HOST}/admin/db/tables?token=${token}`)).data);
    } catch (e) { console.error("DB Fetch Error"); }
  };

  const fetchTableRows = async (tableName: string) => {
    setSelectedTable(tableName);
    try { setTableData((await axios.get(`${API_HOST}/admin/db/table/${tableName}?token=${token}`)).data);
    } catch (e) { alert("Failed to fetch rows."); }
  };

  useEffect(() => {
    if (mainTab === 'moderator') fetchModeratorData();
    if (mainTab === 'database') fetchTables();
  }, [mainTab, modTab]);

  const deleteItem = async (type: string, id: number) => {
    if(!confirm("Are you sure you want to completely delete this?")) return;
    await axios.delete(`${API_HOST}/admin/${type}/${id}?token=${token}`);
    fetchModeratorData();
  };

  const updateQueueStatus = async (type: string, id: number, action: 'approve' | 'reject') => {
    if (action === 'approve') await axios.put(`${API_HOST}/admin/${type}/${id}/approve?token=${token}`);
    if (action === 'reject') await axios.delete(`${API_HOST}/admin/${type}/${id}/reject?token=${token}`);
    fetchModeratorData();
  };

  return (
    <div className="w-full min-h-[100dvh] bg-slate-950 text-slate-100 p-4 pb-32 flex flex-col font-sans">
      <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-red-500/30 font-caveat">
        <div className="flex items-center gap-3">
          <Shield size={32} className="text-red-500" />
          <div>
            <h1 className="text-2xl font-black uppercase tracking-widest text-slate-100 leading-none">God Mode</h1>
            <p className="text-[10px] text-red-400 font-bold tracking-widest uppercase mt-1">Super Admin Access</p>
          </div>
        </div>
        <button onClick={() => navigateTo('daily')} className="p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 hover:text-white">
          <XCircle size={20} />
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setMainTab('moderator')} className={`flex-1 py-3 font-black text-xs uppercase tracking-widest rounded-lg border-2 transition-colors ${mainTab === 'moderator' ? 'bg-red-900/40 text-red-400 border-red-500/50' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>
          <AlertOctagon size={14} className="inline mr-2"/> Moderator
        </button>
        <button onClick={() => setMainTab('database')} className={`flex-1 py-3 font-black text-xs uppercase tracking-widest rounded-lg border-2 transition-colors ${mainTab === 'database' ? 'bg-blue-900/40 text-blue-400 border-blue-500/50' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>
          <Database size={14} className="inline mr-2"/> Database
        </button>
      </div>

      {mainTab === 'moderator' && (
        <div className="space-y-4">
          <div className="flex gap-2 mb-4 overflow-x-auto hide-scrollbar">
            {['menus', 'vault', 'market', 'events'].map(tab => (
              <button key={tab} onClick={() => setModTab(tab as any)} className={`px-4 py-2 font-bold text-xs uppercase rounded-md border ${modTab === tab ? 'bg-slate-800 text-white border-slate-600' : 'bg-transparent text-slate-500 border-slate-800'}`}>
                {tab}
              </button>
            ))}
          </div>

          {/* MENUS */}
          {modTab === 'menus' && menus.length === 0 && <p className="text-center text-slate-600 text-sm font-bold mt-10">No menus uploaded.</p>}
          {modTab === 'menus' && menus.map(menu => (
            <div key={menu.id} className={`bg-slate-900 border-2 rounded-xl p-4 transition-all ${menu.report_count > 0 ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'border-slate-700'}`}>
              <div className="flex justify-between">
                <div>
                  <h3 className="font-black text-lg text-white">{menu.hostel}</h3>
                  {menu.report_count > 0 && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded font-bold uppercase">{menu.report_count} Reports</span>}
                </div>
                <div className="cursor-pointer group relative rounded border border-slate-700 overflow-hidden w-16 h-16 shrink-0">
                  <img src={menu.image_url} className="w-full h-full object-cover group-hover:opacity-40 transition-opacity" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none"><Search size={20} className="text-white drop-shadow-md" /></div>
                </div>
              </div>
              <button onClick={() => deleteItem('menus', menu.id)} className="w-full mt-4 py-2 bg-slate-800 text-red-400 font-bold text-xs uppercase rounded hover:bg-slate-700">Delete Menu</button>
            </div>
          ))}

          {/* VAULT */}
          {modTab === 'vault' && vaultItems.length === 0 && <p className="text-center text-slate-600 text-sm font-bold mt-10">Vault queue is empty.</p>}
          {modTab === 'vault' && vaultItems.map(res => (
            <div key={res.id} className={`bg-slate-900 border-2 rounded-xl p-4 ${res.status === 'pending' ? 'border-yellow-500/50' : 'border-slate-700'}`}>
              <h3 className="font-black text-lg text-white">{res.title}</h3>
              <div className="flex justify-between items-center mb-3">
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${res.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>{res.status}</span>
                <a href={res.file_url} target="_blank" className="text-xs text-blue-400 underline font-bold uppercase tracking-widest">View File</a>
              </div>
              {res.status === 'pending' ? (
                <div className="flex gap-2">
                  <button onClick={() => updateQueueStatus('vault', res.id, 'reject')} className="flex-1 py-2 bg-slate-800 text-slate-400 font-bold text-xs uppercase rounded">Reject</button>
                  <button onClick={() => updateQueueStatus('vault', res.id, 'approve')} className="flex-1 py-2 bg-blue-600 text-white font-bold text-xs uppercase rounded">Approve</button>
                </div>
              ) : (
                <button onClick={() => deleteItem('vault', res.id)} className="w-full py-2 bg-slate-800 text-red-400 font-bold text-xs uppercase rounded">Delete Resource</button>
              )}
            </div>
          ))}

          {/* MARKETPLACE QUEUE */}
          {modTab === 'market' && marketItems.length === 0 && <p className="text-center text-slate-600 text-sm font-bold mt-10">Marketplace is clean.</p>}
          {modTab === 'market' && marketItems.map(item => (
            <div key={item.id} className={`bg-slate-900 border-2 rounded-xl p-4 ${item.status === 'pending' ? 'border-yellow-500/50' : 'border-slate-700'}`}>
              <div className="flex justify-between">
                <div>
                  <h3 className="font-black text-lg text-white">{item.title}</h3>
                  <p className="text-lime-400 font-bold text-sm">₹{item.price}</p>
                </div>
                <div className="w-16 h-16 shrink-0 rounded border border-slate-700 overflow-hidden"><img src={item.image_url} className="w-full h-full object-cover"/></div>
              </div>
              <div className="flex justify-between items-center mb-3 mt-2">
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${item.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>{item.status}</span>
              </div>
              {item.status === 'pending' ? (
                <div className="flex gap-2">
                  <button onClick={() => updateQueueStatus('market', item.id, 'reject')} className="flex-1 py-2 bg-slate-800 text-slate-400 font-bold text-xs uppercase rounded">Reject</button>
                  <button onClick={() => updateQueueStatus('market', item.id, 'approve')} className="flex-1 py-2 bg-blue-600 text-white font-bold text-xs uppercase rounded">Approve</button>
                </div>
              ) : (
                <button onClick={() => deleteItem('market', item.id)} className="w-full py-2 bg-slate-800 text-red-400 font-bold text-xs uppercase rounded">Delete from Feed</button>
              )}
            </div>
          ))}

          {/* EVENTS QUEUE */}
          {modTab === 'events' && eventItems.length === 0 && <p className="text-center text-slate-600 text-sm font-bold mt-10">No events pending.</p>}
          {modTab === 'events' && eventItems.map(ev => (
            <div key={ev.id} className={`bg-slate-900 border-2 rounded-xl p-4 ${ev.status === 'pending' ? 'border-yellow-500/50' : 'border-slate-700'}`}>
              <h3 className="font-black text-lg text-white">{ev.title}</h3>
              <p className="text-rose-400 font-bold text-xs mb-2">by @{ev.organizer_name}</p>
              
              <div className="flex justify-between items-center mb-3 mt-2">
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${ev.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>{ev.status}</span>
              </div>
              {ev.status === 'pending' ? (
                <div className="flex gap-2">
                  <button onClick={() => updateQueueStatus('events', ev.id, 'reject')} className="flex-1 py-2 bg-slate-800 text-slate-400 font-bold text-xs uppercase rounded">Reject</button>
                  <button onClick={() => updateQueueStatus('events', ev.id, 'approve')} className="flex-1 py-2 bg-blue-600 text-white font-bold text-xs uppercase rounded">Approve</button>
                </div>
              ) : (
                <button onClick={() => deleteItem('events', ev.id)} className="w-full py-2 bg-slate-800 text-red-400 font-bold text-xs uppercase rounded">Delete Event from Feed</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* DATABASE CRUD VIEW */}
      {mainTab === 'database' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex justify-between items-center">
              Raw Database <RefreshCw size={14} className="cursor-pointer hover:text-white" onClick={() => selectedTable && fetchTableRows(selectedTable)}/>
            </h2>
            
            <div className="flex gap-2 mb-4">
              <select onChange={e => fetchTableRows(e.target.value)} value={selectedTable} className="flex-1 bg-slate-950 border border-slate-800 rounded p-2 text-sm text-white">
                <option value="">Select Table...</option>
                {tables.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button onClick={() => { setEditingRow({}); setEditJson('{\n  "column_name": "value"\n}'); }} className="px-4 bg-green-900/40 text-green-400 border border-green-500/50 rounded font-bold text-xs uppercase">
                + Insert Row
              </button>
            </div>

            {editingRow && (
              <div className="mb-4 p-4 bg-slate-950 border border-blue-500/50 rounded-lg">
                <h3 className="text-xs font-bold text-blue-400 mb-2 uppercase">Raw JSON Editor</h3>
                <textarea value={editJson} onChange={e => setEditJson(e.target.value)} className="w-full h-32 bg-slate-900 text-green-400 font-mono text-xs p-2 rounded outline-none border border-slate-800" />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setEditingRow(null)} className="flex-1 py-1.5 bg-slate-800 text-slate-400 rounded text-xs font-bold uppercase">Cancel</button>
                  {editingRow.id ? (
                    <>
                      <button onClick={() => executeDbAction('delete')} className="flex-1 py-1.5 bg-red-900/50 text-red-400 rounded text-xs font-bold uppercase">Delete Row</button>
                      <button onClick={() => executeDbAction('update')} className="flex-1 py-1.5 bg-blue-600 text-white rounded text-xs font-bold uppercase">Update Row</button>
                    </>
                  ) : (
                    <button onClick={() => executeDbAction('insert')} className="flex-1 py-1.5 bg-green-600 text-white rounded text-xs font-bold uppercase">Execute Insert</button>
                  )}
                </div>
              </div>
            )}

            {selectedTable && !editingRow && (
              <div className="overflow-x-auto bg-slate-950 rounded border border-slate-800 max-h-[400px] overflow-y-auto hide-scrollbar">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800 text-slate-400 sticky top-0">
                    <tr>
                      <th className="p-2">Action</th>
                      {tableData.length > 0 && Object.keys(tableData[0]).map(key => (
                        <th key={key} className="p-2 whitespace-nowrap">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.map((row, i) => (
                      <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/50">
                        <td className="p-2">
                          <button onClick={() => { setEditingRow(row); setEditJson(JSON.stringify(row, null, 2)); }} className="text-blue-400 underline font-bold">Edit</button>
                        </td>
                        {Object.values(row).map((val: any, j) => (
                          <td key={j} className="p-2 whitespace-nowrap truncate max-w-[150px]" title={String(val)}>
                            {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {tableData.length === 0 && <p className="p-4 text-center text-slate-600">Table is empty.</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}