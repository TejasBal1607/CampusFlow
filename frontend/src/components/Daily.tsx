import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, MapPin, Camera, Radio, FolderOpen, X, Search, Plus, CheckCircle2, XCircle, Slash, ChevronDown, ChevronRight, FileText, RotateCcw, Trash2, Loader2, AlertTriangle, CalendarDays, Target, UploadCloud, Flag, Edit2 } from 'lucide-react';

const API_HOST = (import.meta as any).env.VITE_API_URL || 'http://localhost:8000';

interface ClassSession {
  id: number;
  name: string;
  time: string;
  start_time?: string;
  end_time?: string;
  venue: string;
  type: 'Lecture' | 'Lab' | 'Tutorial' | string;
  status: 'past' | 'active' | 'future';
  attendance: 'attended' | 'bunked' | 'cancelled' | null;
  endsIn?: string;
}

export default function Daily() {
  const token = localStorage.getItem('cf_token');
  
  const [isLoading, setIsLoading] = useState(true);
  const [showArchives, setShowArchives] = useState(false);
  const [showAddComm, setShowAddComm] = useState(false);
  const [showWeekSchedule, setShowWeekSchedule] = useState(false);
  
  const [needsSync, setNeedsSync] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [weekSchedule, setWeekSchedule] = useState<any[]>([]);
  const syncInputRef = useRef<HTMLInputElement>(null);
  
  const [messMenuData, setMessMenuData] = useState<{id: number, url: string, uploader: string, time: string} | null>(null);
  const [showMenuViewer, setShowMenuViewer] = useState(false);
  const [isUploadingMenu, setIsUploadingMenu] = useState(false);
  const menuFileInputRef = useRef<HTMLInputElement>(null);
  
  // FIX: Added role to prevent TS Errors
  const [userData, setUserData] = useState({ 
    email: '', 
    batch: '1A84', 
    hostel: 'Day Scholar', 
    stream: 'COE', 
    role: 'student' 
  });
  
  const isAdmin = userData.role === 'super_admin' || userData.email === 'tejas1607.best@gmail.com';
  const isGuest = userData.role === 'guest';
  const isUnassigned = userData.batch === 'Unassigned' || !userData.batch;

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({ 'streams': true, 'coe': true });
  const toggleFolder = (folderId: string) => setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));

  const [todayClasses, setTodayClasses] = useState<ClassSession[]>([]);
  const [bunkMeter, setBunkMeter] = useState<any[]>([]);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [editingBunk, setEditingBunk] = useState<{id: number, subject: string, attended: number, bunked: number} | null>(null); 
  
  const [commsRadar, setCommsRadar] = useState<any[]>([]);
  const [newComm, setNewComm] = useState({ tag: '', text: '', urgent: false, targetType: 'ALL', targetValue: '' });

  const fetchDailyData = async () => {
    try {
      const profileRes = await axios.get(`${API_HOST}/auth/me?token=${token}`);
      const userHostel = profileRes.data.hostel || 'Day Scholar';
      setUserData({
        email: profileRes.data.email,
        batch: profileRes.data.batch || '1A84',
        hostel: userHostel,
        stream: profileRes.data.stream || 'COE',
        role: profileRes.data.role || 'student'
      });

      try {
        const timeRes = await axios.get(`${API_HOST}/daily/timetable?token=${token}`);
        setWeekSchedule(timeRes.data);
        setNeedsSync(false);
        
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = days[new Date().getDay()];
        const todayData = timeRes.data.find((d: any) => d.day === currentDay);
        
        if (todayData && todayData.classes) {
          const mappedClasses = todayData.classes.map((c: any, i: number) => ({
            ...c,
            id: i + 1,
            status: 'future',
            attendance: null
          }));
          setTodayClasses(mappedClasses);
        } else {
          setTodayClasses([]); 
        }
      } catch (err: any) {
        if (err.response?.status === 404) setNeedsSync(true);
      }

      const [commsRes, bunkRes] = await Promise.all([
        axios.get(`${API_HOST}/daily/comms?token=${token}`),
        axios.get(`${API_HOST}/daily/bunk?token=${token}`)
      ]);
      setCommsRadar(commsRes.data);
      setBunkMeter(bunkRes.data);

      if (userHostel !== 'Day Scholar' && userHostel !== 'Unassigned') {
        try {
          const menuRes = await axios.get(`${API_HOST}/daily/mess-menu?hostel=${encodeURIComponent(userHostel)}&token=${token}`);
          if (menuRes.data && menuRes.data.image_url) {
            const rawUrl = menuRes.data.image_url;
            const finalUrl = rawUrl.startsWith('data:') ? rawUrl : `${API_HOST}${rawUrl}`;
            
            setMessMenuData({
              id: menuRes.data.id,
              url: finalUrl,
              uploader: menuRes.data.uploader_name,
              time: new Date(menuRes.data.updated_at + 'Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            });
          }
        } catch (e) { }
      }
    } catch (error) {
      console.error("Failed to fetch daily data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchDailyData();
  }, [token]);

  const handleSyncUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isGuest) return alert("Only verified users can upload timetables.");
    const file = event.target.files?.[0];
    if (!file) return;

    setIsSyncing(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      await axios.post(`${API_HOST}/daily/timetable/sync?token=${token}`, formData);
      fetchDailyData();
    } catch (error) {
      alert("AI Sync failed. Please make sure you uploaded a clear PNG of the timetable.");
    } finally {
      setIsSyncing(false);
      if (syncInputRef.current) syncInputRef.current.value = '';
    }
  };

  const handleMenuUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isGuest) return alert("Only verified users can upload menus.");
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsUploadingMenu(true);
    const formData = new FormData();
    formData.append('image', file);
    formData.append('hostel', userData.hostel);
    try {
      const res = await axios.post(`${API_HOST}/daily/mess-menu?token=${token}`, formData);
      setMessMenuData({
        id: res.data.id, // <-- CHANGED from menuRes to res
        url: res.data.image_url, 
        uploader: res.data.uploader_name,
        time: 'Just now'
      });
      setShowMenuViewer(true);
    } catch (error) {
      alert("Failed to upload menu. Please try again.");
    } finally {
      setIsUploadingMenu(false);
      if (menuFileInputRef.current) menuFileInputRef.current.value = '';
    }
  };

  const handleMarkAttendance = async (classId: number, subjectName: string, status: 'attended' | 'bunked' | 'cancelled' | null) => {
    setTodayClasses(classes => classes.map(c => c.id === classId ? { ...c, attendance: status } : c));
    const tracker = bunkMeter.find(b => b.subject === subjectName);
    if (tracker) {
      try {
        let actionStr = 'reset';
        if (status === 'attended') actionStr = 'attend';
        if (status === 'bunked') actionStr = 'bunk';
        if (status === 'cancelled') actionStr = 'cancel';
        await axios.put(`${API_HOST}/daily/bunk/${tracker.id}?token=${token}`, { action: actionStr });
        fetchDailyData();
      } catch (error) { console.error("Failed to sync attendance", error); }
    }
  };

  const addBunkSubject = async (name: string) => {
    setShowAddSubject(false);
    try {
      await axios.post(`${API_HOST}/daily/bunk?token=${token}`, { subject: name });
      fetchDailyData();
    } catch (error) { console.error("Failed to add bunk subject", error); }
  };

  const removeBunkSubject = async (id: number) => {
    try {
      await axios.delete(`${API_HOST}/daily/bunk/${id}?token=${token}`);
      fetchDailyData();
    } catch (error) { console.error("Failed to remove bunk subject", error); }
  };

  const saveManualBunkData = async () => {
    if (!editingBunk) return;
    try {
      await axios.put(`${API_HOST}/daily/bunk/${editingBunk.id}/manual?token=${token}`, {
        attended: editingBunk.attended,
        bunked: editingBunk.bunked
      });
      setEditingBunk(null);
      fetchDailyData();
    } catch (error) {
      alert("Failed to update past data.");
    }
  };

  const handleBroadcast = async () => {
    if (!newComm.tag || !newComm.text) return alert("Tag and Text are required!");
    if (newComm.targetType !== 'ALL' && !newComm.targetValue) return alert("Please specify the target value.");

    const payload: any = { tag: newComm.tag.toUpperCase(), text: newComm.text, urgent: newComm.urgent };
    if (newComm.targetType === 'HOSTEL') payload.target_hostel = newComm.targetValue;
    if (newComm.targetType === 'BATCH') payload.target_batch = newComm.targetValue;
    if (newComm.targetType === 'STREAM') payload.target_stream = newComm.targetValue;
    if (newComm.targetType === 'YEAR') payload.target_year = parseInt(newComm.targetValue);

    try {
      await axios.post(`${API_HOST}/daily/comms?token=${token}`, payload);
      setShowAddComm(false);
      setNewComm({ tag: '', text: '', urgent: false, targetType: 'ALL', targetValue: '' });
      fetchDailyData();
    } catch (error: any) { alert(error.response?.data?.detail || "Broadcast failed"); }
  };

  const handleDeleteComm = async (commId: number) => {
    if (!confirm("Delete this broadcast from the radar?")) return;
    try {
      await axios.delete(`${API_HOST}/daily/comms/${commId}?token=${token}`);
      fetchDailyData();
    } catch (error) {
      alert("Failed to delete comm.");
    }
  };

  const getTypeColor = (type: string) => {
    const t = type.toLowerCase();
    if (t === 'lecture') return 'bg-green-500 text-white border-green-600';
    if (t === 'lab' || t === 'practical') return 'bg-yellow-400 text-slate-900 border-yellow-500';
    if (t === 'tutorial') return 'bg-purple-500 text-white border-purple-600';
    return 'bg-slate-500 text-white border-slate-600';
  };

  // ==========================================
  // RENDER HELPERS
  // ==========================================
  const renderClassTracker = () => (
    <div className="mb-6 mt-4">
      <div className="flex items-center justify-between mb-4 border-b-2 border-slate-800 pb-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-2xl font-black uppercase tracking-wider text-slate-100 whitespace-nowrap">Class Tracker</h2>
          <span className="text-xs font-black text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded-sm border border-slate-700">{userData.batch}</span>
        </div>
        
        <div 
          onClick={() => !needsSync && setShowWeekSchedule(true)}
          className={`text-right flex flex-col items-end justify-center transition-transform ${needsSync ? 'opacity-50' : 'cursor-pointer hover:scale-105'}`}
          title={needsSync ? "Sync required to view week" : "View Full Week Schedule"}
        >
          <span className="text-2xl font-black text-blue-400 font-caveat leading-none">
            {(new Date()).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
          </span>
          <span className="text-sm font-bold text-slate-400 font-caveat tracking-widest uppercase leading-none mt-1">
            {(new Date()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-600 size-10" /></div>
      ) : isUnassigned ? (
        // FIX: Replaced upload button with "Assign Batch" message
        <div className="bg-slate-900/80 border-2 border-slate-700 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center mt-2">
          <FileText size={40} className="text-slate-600 mb-3" />
          <h3 className="text-xl font-black text-slate-300 uppercase tracking-widest mb-2">Batch Unassigned</h3>
          <p className="text-sm font-bold text-slate-500 font-sans mb-4 max-w-[250px]">
            Please select your batch in Settings to unlock the class tracker and timetable.
          </p>
        </div>
      ) : needsSync ? (
        <div className="bg-slate-900/80 border-2 border-slate-700 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center mt-2">
          <FileText size={40} className="text-slate-600 mb-3" />
          <h3 className="text-xl font-black text-slate-300 uppercase tracking-widest mb-2">Sync Required</h3>
          <p className="text-sm font-bold text-slate-500 font-sans mb-4 max-w-[250px]">
            Be the hero for batch <span className="text-blue-400">{userData.batch}</span>. Upload the ACM timetable PNG to unlock the schedule for everyone.
          </p>
          <input type="file" accept="image/*" ref={syncInputRef} className="hidden" onChange={handleSyncUpload} />
          <button 
            onClick={() => {
              if(isGuest) return alert("Only verified users can upload timetables.");
              syncInputRef.current?.click();
            }} 
            disabled={isSyncing || isGuest}
            className={`py-3 px-6 font-black text-white border-2 rounded-lg flex items-center gap-2 uppercase tracking-widest disabled:opacity-50 transition-colors ${isGuest ? 'bg-slate-700 border-slate-600 cursor-not-allowed' : 'bg-blue-600 border-blue-500 hover:bg-blue-500'}`}
          >
            {isSyncing ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
            {isSyncing ? 'Extracting Data...' : (isGuest ? 'Verified Only' : 'Upload PNG')}
          </button>
        </div>
      ) : todayClasses.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 text-center text-slate-500 font-sans font-bold mt-2">
          No classes scheduled for today! Enjoy the day off.
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4 -mx-4 px-4 snap-x mt-2">
          {todayClasses.map((cls) => {
            const isActive = cls.status === 'active';
            const isPast = cls.status === 'past';
            
            return (
              <motion.div 
                key={cls.id}
                className={`min-w-[260px] snap-center p-4 rounded-xl border-2 flex flex-col justify-between shrink-0 relative overflow-hidden ${
                  isActive ? 'bg-slate-900/90 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 
                  isPast ? 'bg-slate-900/40 border-slate-800' : 
                  'bg-slate-900/80 border-slate-700'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-sm uppercase tracking-wider border-b-2 ${getTypeColor(cls.type)}`}>
                    {cls.type}
                  </span>
                  {isActive && cls.endsIn && (
                    <span className="text-[10px] font-black text-blue-400 animate-pulse flex items-center gap-1 bg-blue-500/10 px-2 py-0.5 rounded-sm border border-blue-500/20">
                      <Clock size={10} /> {cls.endsIn}
                    </span>
                  )}
                </div>
                
                <div className="mb-2">
                  <h3 className={`text-xl font-black mb-2 truncate ${isActive ? 'text-slate-100' : isPast ? 'text-slate-400' : 'text-slate-300'}`}>{cls.name}</h3>
                  <div className="flex items-center justify-between mt-2">
                     <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 font-sans">
                        <Clock size={12} /> {(cls.time || cls.start_time || "").split('-')[0]?.trim() || "TBA"}
                      </div>
                     <div className={`flex items-center gap-1.5 font-black text-sm ${isActive ? 'text-blue-400' : 'text-slate-400'}`}>
                       <MapPin size={14} /> {cls.venue}
                     </div>
                  </div>
                </div>

                {(isPast || isActive) && (
                  <div className="mt-2 pt-3 border-t border-slate-800 flex gap-2">
                    {cls.attendance ? (
                      <button 
                        onClick={() => handleMarkAttendance(cls.id, cls.name, null)}
                        className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-sm text-xs font-black uppercase tracking-wider hover:opacity-80 transition-opacity
                        ${cls.attendance === 'attended' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 
                          cls.attendance === 'bunked' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
                          'bg-slate-500/20 text-slate-400 border border-slate-500/30'}`}
                      >
                        {cls.attendance === 'attended' && <CheckCircle2 size={14} />}
                        {cls.attendance === 'bunked' && <XCircle size={14} />}
                        {cls.attendance === 'cancelled' && <Slash size={14} />}
                        {cls.attendance}
                        <RotateCcw size={12} className="ml-1 opacity-50" />
                      </button>
                    ) : (
                      <>
                        <button onClick={() => handleMarkAttendance(cls.id, cls.name, 'attended')} className="flex-1 text-[10px] font-black tracking-widest py-2 bg-slate-800 text-slate-300 rounded-sm hover:bg-green-500 hover:text-white transition-colors">ATTEND</button>
                        <button onClick={() => handleMarkAttendance(cls.id, cls.name, 'bunked')} className="flex-1 text-[10px] font-black tracking-widest py-2 bg-slate-800 text-slate-300 rounded-sm hover:bg-red-500 hover:text-white transition-colors">BUNK</button>
                        <button onClick={() => handleMarkAttendance(cls.id, cls.name, 'cancelled')} className="flex-1 text-[10px] font-black tracking-widest py-2 bg-slate-800 text-slate-300 rounded-sm hover:bg-slate-600 transition-colors">CANCEL</button>
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderGrid = () => (
    <div className="grid grid-cols-2 gap-4 mb-6">
      <motion.div 
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`bg-slate-100 p-2 pb-6 rounded-sm shadow-xl -rotate-2 relative flex flex-col h-[180px] group ${isGuest && !messMenuData ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
        onClick={() => {
          if (messMenuData) setShowMenuViewer(true);
          else if (isGuest) alert("Link a verified Thapar ID to upload menus.");
          else menuFileInputRef.current?.click();
        }}
      >
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-3 bg-red-500/50 rotate-3 shadow-sm z-10" /> 
        
        <div className="flex-1 bg-slate-900 w-full rounded-sm border border-slate-300 flex flex-col items-center justify-center overflow-hidden relative">
          {isUploadingMenu ? (
            <Loader2 size={28} className="text-blue-500 animate-spin" />
          ) : messMenuData ? (
            <>
              <img src={messMenuData.url} alt="Mess Menu" className="w-full h-full object-cover opacity-80 group-hover:opacity-40 transition-opacity" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white font-black text-xs uppercase tracking-widest bg-blue-600/90 px-3 py-1.5 rounded-full border border-blue-400">View Menu</span>
              </div>
            </>
          ) : (
            <>
              <Camera size={28} className={`${isGuest ? 'text-slate-700' : 'text-slate-600'} mb-1`} />
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest text-center px-2">
                {isGuest ? 'Verified\nOnly' : 'Snap\nMenu'}
              </span>
            </>
          )}
        </div>
        <p className="text-center font-caveat font-black text-xl text-slate-800 mt-2 leading-none">{userData.hostel}</p>
      </motion.div>

      <input type="file" accept="image/*" ref={menuFileInputRef} className="hidden" onChange={handleMenuUpload} />

      <div className="bg-slate-900/80 border-2 border-slate-700 border-dashed rounded-xl p-3 flex flex-col relative h-[180px]">
        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-2 mb-3">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Bunk Meter</h3>
          <button onClick={() => setShowAddSubject(!showAddSubject)} className="text-slate-400 hover:text-blue-400"><Plus size={16}/></button>
        </div>

        {showAddSubject && (
          <div className="absolute top-10 right-2 left-2 bg-slate-800 border border-slate-600 rounded-md shadow-xl z-20 overflow-hidden font-sans">
            {(Array.isArray(weekSchedule) ? weekSchedule : []).flatMap(day => (day.classes || []).map((c: any) => c.name))
              .filter((name, index, self) => name && self.indexOf(name) === index) // Safely get unique names
              .filter(name => !bunkMeter.some(b => b.subject === name))
              .map((name: any, idx) => (
                <div key={idx} onClick={() => addBunkSubject(name)} className="p-2 text-xs font-bold text-slate-300 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 last:border-0 truncate">
                  + Track {name}
                </div>
            ))}
            {weekSchedule.length > 0 && Array.from(new Set(weekSchedule.flatMap(day => day.classes.map((c: any) => c.name)))).filter(name => !bunkMeter.some(b => b.subject === name)).length === 0 && (
               <div className="p-2 text-xs text-center text-slate-400">All subjects tracked.</div>
            )}
            {weekSchedule.length === 0 && (
               <div className="p-2 text-xs text-center text-slate-400">Sync timetable first.</div>
            )}
            <div onClick={() => setShowAddSubject(false)} className="p-2 text-xs text-center text-slate-500 cursor-pointer bg-slate-900 hover:bg-slate-800">Cancel</div>
          </div>
        )}

        <div className="flex-1 flex flex-col justify-start gap-3 overflow-y-auto hide-scrollbar">
          {isLoading ? (
             <div className="flex justify-center py-4"><Loader2 className="animate-spin text-slate-600" /></div>
          ) : bunkMeter.length === 0 ? (
            <p className="text-xs text-slate-500 font-sans text-center mt-4 leading-tight">Sync timetable to track subjects.</p>
          ) : (
            bunkMeter.map((sub) => {
              const totalClasses = sub.attended + sub.bunked;
              const currentPct = totalClasses === 0 ? 100 : Math.round((sub.attended / totalClasses) * 100);
              const isDanger = totalClasses > 0 && currentPct < 75;
              const safeBunks = Math.max(0, Math.floor((4 / 3) * sub.attended - totalClasses));
              const neededClasses = Math.max(0, Math.ceil(3 * totalClasses - 4 * sub.attended));

              return (
                <div key={sub.id} className="w-full group">
                  <div className="flex justify-between items-end mb-1 relative">
                    <span className="text-xs font-bold text-slate-300 truncate max-w-[70px] group-hover:opacity-0 transition-opacity">{sub.subject}</span>
                    
                    {/* Hover Actions: Edit & Delete */}
                    <div className="absolute left-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                      <button onClick={() => setEditingBunk(sub)} className="text-blue-400 hover:text-blue-300"><Edit2 size={12}/></button>
                      <button onClick={() => removeBunkSubject(sub.id)} className="text-red-500 hover:text-red-400"><Trash2 size={12}/></button>
                    </div>
                    
                    <span className={`text-[10px] font-black ${isDanger ? 'text-red-400' : 'text-green-400'}`}>
                      {totalClasses === 0 ? 'No Data' : isDanger ? `Need ${neededClasses} more` : `${safeBunks} safe`}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden relative">
                     <div className="absolute left-[75%] top-0 bottom-0 w-[2px] bg-slate-400 z-10"></div>
                     <div className={`h-full rounded-full ${isDanger ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${currentPct}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  const renderComms = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2 border-b-2 border-slate-800 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <Radio size={20} className="text-purple-500 animate-pulse" />
            <h2 className="text-xl font-black uppercase tracking-widest text-slate-200">Comms</h2>
          </div>
          <p className="text-[10px] font-bold text-slate-500 font-sans mt-0.5 uppercase tracking-wide">Secured to {userData.batch} & {userData.hostel}</p>
        </div>
        
        {isAdmin ? (
          <button onClick={() => setShowAddComm(true)} className="flex items-center gap-1 text-xs font-black text-slate-400 hover:text-purple-400 bg-slate-900 px-2 py-1 rounded-sm border border-slate-800 transition-colors">
            <Plus size={14} /> POST
          </button>
        ) : (
          <span className="text-[10px] font-bold text-slate-600 bg-slate-900 px-2 py-1 rounded-sm border border-slate-800" title="Only Faculty/CRs can post">READ-ONLY</span>
        )}
      </div>
      
      <div className="bg-slate-900/60 border border-slate-700 rounded-xl overflow-hidden shadow-inner flex flex-col max-h-[220px]">
        <div className="overflow-y-auto hide-scrollbar flex-1">
          {isLoading ? (
             <div className="p-6 flex justify-center"><Loader2 className="animate-spin text-slate-600" /></div>
          ) : commsRadar.length === 0 ? (
             <div className="p-6 text-center text-slate-500 font-sans text-sm">Radio silence. No new comms.</div>
          ) : (
            commsRadar.map((msg, idx) => {
              const d = new Date(msg.created_at + 'Z'); 
              const timeString = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
              return (
                <div key={msg.id} className={`p-4 ${idx !== commsRadar.length - 1 ? 'border-b border-slate-800/50' : ''}`}>
                  <div className="flex justify-between items-center mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-sm ${msg.urgent ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 text-slate-400'}`}>
                        #{msg.tag}
                      </span>
                      {isAdmin && (
                        <button onClick={() => handleDeleteComm(msg.id)} className="text-red-500 hover:text-red-400 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                    <span className="text-xs font-bold text-slate-500 font-sans">{timeString}</span>
                  </div>
                  <p className="text-sm text-slate-300 font-sans leading-relaxed">{msg.text}</p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full min-h-[100dvh] bg-slate-950 text-slate-100 overflow-x-hidden relative flex flex-col">
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" /></filter><rect width="100" height="100" fill="%23fff" filter="url(%23noise)"/></svg>')` }} />

      <main className="flex-1 px-4 relative z-10 pb-32">
        {renderClassTracker()}
        {renderGrid()}
        {renderComms()}
      </main>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowArchives(true)}
        className="fixed bottom-24 right-4 z-40 bg-blue-600 text-white p-4 rounded-2xl shadow-[0_10px_25px_rgba(37,99,235,0.4)] border-2 border-blue-400 flex items-center justify-center gap-2 group"
      >
        <FolderOpen size={28} strokeWidth={2.5} />
      </motion.button>

      {/* ========================================== */}
      {/* MODALS */}
      {/* ========================================== */}

      <AnimatePresence>
        {editingBunk && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-slate-900 border-2 border-slate-700 rounded-2xl p-6 w-full max-w-xs shadow-2xl">
              <h3 className="text-lg font-black text-slate-200 mb-4 tracking-widest uppercase">Set Past Data</h3>
              <p className="text-xs text-slate-400 mb-4 font-sans font-bold">{editingBunk.subject}</p>
              
              <div className="flex gap-4 mb-6">
                <div className="flex-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block text-green-400">Attended</label>
                  <input 
                    type="number" 
                    value={editingBunk.attended} 
                    onChange={e => setEditingBunk({...editingBunk, attended: parseInt(e.target.value) || 0})} 
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-bold text-center focus:border-green-500 focus:outline-none" 
                    min="0" 
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block text-red-400">Bunked</label>
                  <input 
                    type="number" 
                    value={editingBunk.bunked} 
                    onChange={e => setEditingBunk({...editingBunk, bunked: parseInt(e.target.value) || 0})} 
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-bold text-center focus:border-red-500 focus:outline-none" 
                    min="0" 
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <button onClick={() => setEditingBunk(null)} className="flex-1 py-2.5 bg-slate-800 text-slate-400 font-black tracking-wider rounded-lg border border-slate-700 hover:bg-slate-700 transition-colors uppercase text-xs">Cancel</button>
                <button onClick={saveManualBunkData} className="flex-1 py-2.5 bg-blue-600 text-white font-black tracking-wider rounded-lg hover:bg-blue-500 transition-colors uppercase text-xs">Save</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMenuViewer && messMenuData && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowMenuViewer(false)} className="fixed inset-0 bg-black/95 z-[90] flex flex-col items-center justify-center p-4">
              <button onClick={() => setShowMenuViewer(false)} className="absolute top-6 right-4 p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white z-50"><X size={24} /></button>
              
              <div className="w-full max-w-lg mb-4">
                 <h3 className="text-2xl font-black text-white uppercase tracking-widest leading-none">{userData.hostel} Menu</h3>
                 <p className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-widest mt-1">
                   Updated by <span className="text-blue-400">{messMenuData.uploader}</span> on {messMenuData.time}
                 </p>
              </div>

              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-xl overflow-hidden shadow-2xl relative bg-slate-900 flex-1 max-h-[65vh]">
                <img src={messMenuData.url} alt="Mess Menu" className="w-full h-full object-contain" />
              </motion.div>

              <div className="w-full max-w-lg mt-6 flex gap-3">
                <button 
                  onClick={async () => {
                    try {
                      // Call the new 3-Strike Route
                      const res = await axios.post(`${API_HOST}/daily/mess-menu/${messMenuData.id}/report?token=${token}`);
                      alert(res.data.message);
                      setShowMenuViewer(false);
                      fetchDailyData(); // Refresh to see if it got deleted
                    } catch (e: any) {
                      alert("Failed to report menu.");
                    }
                  }} 
                  className="py-4 px-6 font-black bg-slate-900 text-red-500 border-2 border-slate-800 rounded-xl flex items-center justify-center hover:bg-slate-800 transition-colors"
                >
                  <Flag size={20}/>
                </button>
                <button onClick={() => { 
                    if(isGuest) { alert("Only verified users can update photos."); return; }
                    setShowMenuViewer(false); 
                    menuFileInputRef.current?.click(); 
                  }} 
                  className={`flex-1 py-4 font-black text-white border-2 rounded-xl flex items-center justify-center gap-2 uppercase tracking-widest transition-colors ${isGuest ? 'bg-slate-700 border-slate-600 opacity-50 cursor-not-allowed' : 'bg-blue-600 border-blue-500 hover:bg-blue-500'}`}
                >
                  <UploadCloud size={20}/> {isGuest ? 'Verified Only' : 'Update Photo'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWeekSchedule && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowWeekSchedule(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]" />
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t-2 border-slate-700 rounded-t-3xl z-[70] flex flex-col max-h-[85vh] h-[75vh]"
            >
              <div className="p-5 border-b-2 border-slate-800 flex justify-between items-center shrink-0">
                <h2 className="text-2xl font-black tracking-widest uppercase flex items-center gap-2">
                  <CalendarDays className="text-blue-500" /> Week Grid
                </h2>
                <button onClick={() => setShowWeekSchedule(false)} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white"><X size={20} /></button>
              </div>

              <div className="p-4 overflow-y-auto flex-1 hide-scrollbar bg-slate-950/50 space-y-4">
                {weekSchedule.map((dayData, idx) => (
                  <div key={idx} className="bg-slate-900 border-2 border-slate-800 rounded-xl p-3">
                    <h3 className="text-lg font-black text-slate-300 uppercase tracking-wider mb-2 border-b border-slate-800 pb-1">{dayData.day}</h3>
                    <div className="space-y-2">
                      {(dayData.classes || []).map((c: any, i: number) => (
                         <div key={i} className="text-sm font-bold text-slate-400 font-sans flex items-center justify-between gap-2 min-w-0">
                           <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${c.type === 'Lecture' ? 'bg-green-500' : (c.type === 'Lab' || c.type === 'Practical') ? 'bg-yellow-400' : 'bg-purple-500'}`} />                             <span className="truncate">{c.name}</span>
                           </div>
                           <span className="text-slate-500 text-xs whitespace-nowrap shrink-0">
                              ({(c.time || c.start_time || "").split('-')[0]?.trim() || "TBA"})
                            </span>
                         </div>
                      ))}
                      {dayData.classes.length === 0 && <div className="text-xs text-slate-500 italic">No classes</div>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t-2 border-slate-800 bg-slate-900">
                <input type="file" accept="image/*" ref={syncInputRef} className="hidden" onChange={handleSyncUpload} />
                <button 
                  onClick={() => {
                    if (isGuest) return alert("Link a verified Thapar ID to use AI Sync.");
                    syncInputRef.current?.click();
                  }}
                  disabled={isSyncing || isGuest}
                  className={`w-full py-3 font-black text-blue-400 border-2 border-dashed rounded-xl flex items-center justify-center gap-2 uppercase tracking-widest transition-colors ${isGuest ? 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}
                >
                  {isSyncing ? <Loader2 size={18} className="animate-spin" /> : <RotateCcw size={18} />}
                  {isSyncing ? 'Re-Syncing...' : (isGuest ? 'AI Sync (Verified Only)' : 'Fix Errors (Re-upload)')}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showArchives && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowArchives(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]" />
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t-2 border-slate-700 rounded-t-3xl z-[70] flex flex-col max-h-[85vh] h-[85vh]"
            >
              <div className="p-5 border-b-2 border-slate-800 flex justify-between items-center shrink-0">
                <h2 className="text-2xl font-black tracking-widest uppercase flex items-center gap-2">
                  <FolderOpen className="text-blue-500" /> Acad Vault
                </h2>
                <button onClick={() => setShowArchives(false)} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white"><X size={20} /></button>
              </div>

              <div className="p-4 overflow-y-auto flex-1 hide-scrollbar bg-slate-950/50">
                <div className="mb-6 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 text-slate-500" size={20} />
                    <input type="text" placeholder="Search files, tags, codes..." className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-slate-200 font-sans font-bold focus:outline-none focus:border-blue-500 transition-colors" />
                  </div>
                </div>

                <div className="bg-slate-900 border-2 border-slate-800 rounded-xl p-3 font-sans space-y-1">
                  
                  <div className="mb-2">
                    <div onClick={() => toggleFolder('yr1')} className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer py-2 px-2 hover:bg-slate-800/50 rounded-md transition-colors">
                      {expandedFolders['yr1'] ? <ChevronDown size={18} className="text-blue-400" /> : <ChevronRight size={18} className="text-slate-500" />}
                      <FolderOpen size={18} className="text-blue-400" />
                      <span className="font-bold">Year 1 (Common)</span>
                    </div>
                    {expandedFolders['yr1'] && (
                      <div className="pl-9 border-l border-slate-700 ml-4 py-1 space-y-2">
                        <div className="flex items-center gap-2 text-slate-400 hover:text-blue-300 cursor-pointer text-sm">
                          <FolderOpen size={14} className="text-slate-500"/> Mathematics - I (UMA010)
                        </div>
                        <div className="flex items-center gap-2 text-slate-400 hover:text-blue-300 cursor-pointer text-sm">
                          <FolderOpen size={14} className="text-slate-500"/> Physics (UPH004)
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <div onClick={() => toggleFolder('streams')} className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer py-2 px-2 hover:bg-slate-800/50 rounded-md transition-colors">
                      {expandedFolders['streams'] ? <ChevronDown size={18} className="text-purple-400" /> : <ChevronRight size={18} className="text-slate-500" />}
                      <FolderOpen size={18} className="text-purple-400" />
                      <span className="font-bold">Streams</span>
                    </div>
                    {expandedFolders['streams'] && (
                      <div className="pl-6 border-l border-slate-700 ml-4 py-1 space-y-1">
                        <div>
                           <div onClick={() => toggleFolder('coe')} className="flex items-center gap-2 text-slate-400 hover:text-white cursor-pointer py-1.5 px-2 hover:bg-slate-800/50 rounded-md text-sm mt-1">
                            {expandedFolders['coe'] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <FolderOpen size={16} className="text-slate-500" /> Computer Engineering (COE)
                           </div>
                           {expandedFolders['coe'] && (
                             <div className="pl-6 border-l border-slate-700/50 ml-3 py-1 space-y-2">
                               <div className="flex items-center gap-2 text-slate-400 hover:text-white cursor-pointer py-1 px-2 hover:bg-slate-800/50 rounded-md text-sm">
                                 <FileText size={14} className="text-red-400"/> COE_Stream_Scheme.pdf
                               </div>
                               <div>
                                  <div onClick={() => toggleFolder('yr3')} className="flex items-center gap-2 text-slate-500 hover:text-slate-300 cursor-pointer text-sm py-1">
                                    {expandedFolders['yr3'] ? <ChevronDown size={12}/> : <ChevronRight size={12}/>} <FolderOpen size={14}/> Year 3
                                  </div>
                                  {expandedFolders['yr3'] && (
                                    <div className="pl-5 border-l border-slate-700/50 ml-2 py-1 space-y-2">
                                      <div className="flex items-center gap-2 text-slate-500 hover:text-slate-300 cursor-pointer text-sm py-1"><FolderOpen size={14}/> Data Structures</div>
                                      <div className="pl-6 ml-2 space-y-2">
                                        <div className="flex flex-col text-slate-400 bg-slate-950/50 p-2 rounded border border-slate-800">
                                          <div className="flex items-center gap-2 text-xs font-bold mb-1.5 hover:text-white cursor-pointer"><FileText size={12} className="text-blue-400"/> Linked_Lists_PYQ.pdf</div>
                                          <div className="flex gap-1 flex-wrap">
                                            <span className="text-[8px] bg-slate-800 px-1.5 rounded text-slate-500">COE</span>
                                            <span className="text-[8px] bg-slate-800 px-1.5 rounded text-slate-500">Year 3</span>
                                            <span className="text-[8px] bg-slate-800 px-1.5 rounded text-slate-500">DSA</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                               </div>
                             </div>
                           )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => {
                    if (isGuest) alert("Only verified users can upload to the Acad Vault.");
                    else alert("Link upload form opening..."); 
                  }}
                  disabled={isGuest}
                  className={`w-full mt-6 py-4 border-2 border-dashed rounded-xl flex items-center justify-center gap-2 transition-all font-black uppercase tracking-widest shadow-inner
                  ${isGuest ? 'bg-slate-900 border-slate-800 text-slate-600 opacity-50 cursor-not-allowed' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 hover:border-blue-500/50'}`}
                >
                  <Plus size={20} className={isGuest ? 'text-slate-600' : 'text-blue-500'} /> 
                  {isGuest ? 'Upload Restricted' : 'Add Resource Link'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddComm && isAdmin && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddComm(false)} className="fixed inset-0 bg-black/90 z-[80] flex flex-col items-center justify-center p-4">
              <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="bg-slate-900 border-2 border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                <h3 className="text-2xl font-black mb-4 uppercase tracking-wide text-purple-400 flex items-center gap-2"><Radio size={24}/> Transmit</h3>
                
                <input 
                  type="text" 
                  placeholder="Tag (e.g. ADMIN, ACAD)" 
                  value={newComm.tag}
                  onChange={(e) => setNewComm({...newComm, tag: e.target.value})}
                  className="w-full mb-3 bg-slate-950 border border-slate-700 rounded-md px-3 py-2 font-bold font-sans text-slate-200 focus:outline-none focus:border-purple-500 uppercase" 
                />
                
                <textarea 
                  placeholder="Write your broadcast here..." 
                  value={newComm.text}
                  onChange={(e) => setNewComm({...newComm, text: e.target.value})}
                  className="w-full h-24 mb-3 bg-slate-950 border border-slate-700 rounded-md px-3 py-2 font-sans text-slate-200 focus:outline-none focus:border-purple-500 resize-none"
                ></textarea>

                <div className="mb-4 p-3 bg-slate-950/50 border border-slate-800 rounded-lg">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block flex items-center gap-1"><Target size={12}/> Target Audience</label>
                  <select 
                    value={newComm.targetType} 
                    onChange={(e) => setNewComm({...newComm, targetType: e.target.value, targetValue: ''})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 font-bold font-sans text-slate-200 text-sm focus:outline-none focus:border-purple-500 mb-2"
                  >
                    <option value="ALL">All Students (Global)</option>
                    <option value="BATCH">Specific Batch</option>
                    <option value="HOSTEL">Specific Hostel</option>
                    <option value="STREAM">Specific Stream</option>
                    <option value="YEAR">Specific Year</option>
                  </select>

                  {newComm.targetType !== 'ALL' && (
                    <input 
                      type="text" 
                      placeholder={`Enter ${newComm.targetType.toLowerCase()} (e.g. ${newComm.targetType === 'YEAR' ? '2025' : newComm.targetType === 'HOSTEL' ? 'Hostel J' : '1A84'})`}
                      value={newComm.targetValue}
                      onChange={(e) => setNewComm({...newComm, targetValue: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 font-sans text-slate-200 text-sm focus:outline-none focus:border-purple-500"
                    />
                  )}
                </div>
                
                <label className="flex items-center gap-2 mb-4 text-sm font-bold text-red-400 font-sans cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={newComm.urgent}
                    onChange={(e) => setNewComm({...newComm, urgent: e.target.checked})}
                    className="w-4 h-4 accent-red-500 cursor-pointer"
                  />
                  <AlertTriangle size={16} /> Mark as Urgent
                </label>

                <div className="flex gap-3">
                  <button onClick={() => setShowAddComm(false)} className="flex-1 py-3 font-bold border-2 border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800">Cancel</button>
                  <button onClick={handleBroadcast} className="flex-1 py-3 font-black bg-purple-600 text-white border-2 border-purple-500 rounded-lg hover:bg-purple-500 transition-colors">Broadcast</button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}