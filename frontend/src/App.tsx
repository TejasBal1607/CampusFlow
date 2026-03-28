import axios from 'axios';
import Dashboard from './components/Dashboard';
import Vault from './components/Vault';
import Auth from './components/Auth';
import Daily from './components/Daily';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Home, Wallet, BookOpen, ShoppingBag, Settings, RefreshCw, Edit3, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { GoogleOAuthProvider } from '@react-oauth/google';

const API_HOST = (import.meta as any).env.VITE_API_URL || 'http://localhost:8000';

// ==========================================
// UTILS & GENERATORS
// ==========================================
const generateThaparBatches = () => {
  const batches: string[] = [];
  const poolConfigs = [
    { pool: 'A', ranges: [[11, 19], [21, 28], [31, 38], [41, 45], [51, 55], [61, 65], [71, 75], [81, 85], [91, 95]] },
    { pool: 'B', ranges: [[11, 18], [21, 28], [31, 38], [41, 45], [51, 55], [61, 65], [71, 75], [81, 85], [91, 95]] },
    { pool: 'X', ranges: [[11, 14], [21, 24]] },
    { pool: 'G', ranges: [[11, 14]] }, { pool: 'J', ranges: [[11, 11]] }, { pool: 'R', ranges: [[11, 13]] }
  ];
  [1, 2, 3, 4].forEach(year => {
    poolConfigs.forEach(({ pool, ranges }) => {
      ranges.forEach(([start, end]) => {
        for (let i = start; i <= end; i++) batches.push(`${year}${pool}${i}`);
      });
    });
  });
  return batches;
};

const THAPAR_BATCHES = generateThaparBatches();
const THAPAR_STREAMS = ['COE', 'COBS', 'COPC', 'ENC', 'EEC', 'ECE', 'MEE', 'CIE', 'CHE', 'BME', 'BT'];

// --- NEW: SMART EMAIL PARSER ---
const getJoiningYear = (email: string) => {
  const match = email?.match(/_be(\d{2})@thapar\.edu/);
  return match ? parseInt(match[1]) : null;
};

const calculateSemester = (email: string) => {
  const yy = getJoiningYear(email);
  if (!yy) return 1; // Default fallback
  const joinYear = 2000 + yy;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11
  
  // Logic: Jan-Jun is Even Sem (2,4,6,8), Jul-Dec is Odd Sem (1,3,5,7)
  let sems = (currentYear - joinYear) * 2;
  if (currentMonth >= 7) sems += 1; // Autumn
  else sems += 0; // Spring

  return Math.max(1, Math.min(8, sems));
};

const SectionHeader = ({ title, color }: { title: string, color: string }) => (
  <div className="relative inline-block mb-2 mt-4">
    <div className={`absolute inset-0 ${color} -skew-x-12 -rotate-2 transform scale-110`} />
    <h3 className="text-2xl font-black text-slate-200 relative z-10 tracking-widest uppercase">{title}</h3>
  </div>
);

// ==========================================
// MAIN APP
// ==========================================
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('Tejas');
  const [userDetails, setUserDetails] = useState({
    email: '', phone: '', batch: '1A84', semester: 1, hostel: 'Day Scholar', rollNumber: '', stream: 'COE'
  });

  const [showSettings, setShowSettings] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notifsEnabled, setNotifsEnabled] = useState(true);
  
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', password: '', rollNumber: '' });

  useEffect(() => {
    const token = localStorage.getItem('cf_token');
    if (token) {
      setIsAuthenticated(true);
      fetchProfile(token);
    }
  }, []);

  const fetchProfile = async (token: string) => {
    try {
      const res = await axios.get(`${API_HOST}/auth/me?token=${token}`);
      const fetchedEmail = res.data.email;
      
      // Auto-calculate exact semester from email
      const autoSem = calculateSemester(fetchedEmail);

      setCurrentUserId(res.data.id);
      setCurrentUserName(res.data.name);
      setUserDetails({
        email: fetchedEmail, 
        phone: res.data.phone || '',
        batch: res.data.batch || '1A84', 
        semester: autoSem, // Locks to calculated sem
        hostel: res.data.hostel || 'Day Scholar',
        rollNumber: res.data.roll_number || '',
        stream: res.data.stream || 'COE'
      });
    } catch (err) { handleLogout(); }
  };

  const updateProfile = async (updates: any) => {
    const token = localStorage.getItem('cf_token');
    try {
      const res = await axios.put(`${API_HOST}/auth/me?token=${token}`, updates);
      setCurrentUserName(res.data.name);
      setUserDetails(prev => ({
        ...prev,
        ...updates
      }));
      return true;
    } catch (err) {
      console.error("Update failed", err);
      return false;
    }
  };

  const handleLoginSuccess = (token: string, userId: number, name: string) => {
    localStorage.setItem('cf_token', token);
    localStorage.setItem('cf_name', name);
    setIsAuthenticated(true);
    fetchProfile(token);
  };

  const handleLogout = () => {
    localStorage.clear();
    setIsAuthenticated(false);
    setCurrentUserId(null);
    setShowSettings(false); 
    setIsEditingProfile(false);
    setActiveTab('home');
  };

  const handleSaveEditForm = async () => {
    if (editForm.phone && editForm.phone.length !== 10) {
      alert("Phone number must be exactly 10 digits.");
      return;
    }
    
    const requiredPrefix = getJoiningYear(userDetails.email) ? `10${getJoiningYear(userDetails.email)}` : '10';
    if (editForm.rollNumber && (editForm.rollNumber.length !== 10 || !editForm.rollNumber.startsWith(requiredPrefix))) {
      alert(`Roll number must be 10 digits and start with ${requiredPrefix}`);
      return;
    }

    const success = await updateProfile({
      name: editForm.name, 
      phone: editForm.phone,
      roll_number: editForm.rollNumber 
    });
    if (success) setIsEditingProfile(false);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, ''); 
    if (val.length <= 10) setEditForm({ ...editForm, phone: val });
  };

  // Force Prefix Logic
  const handleRollNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, ''); 
    const yy = getJoiningYear(userDetails.email);
    const prefix = yy ? `10${yy}` : '10';

    if (!val.startsWith(prefix) && val.length > 0) {
      val = prefix; 
    }
    
    if (val.length <= 10) setEditForm({ ...editForm, rollNumber: val });
  };

  const openEditProfile = () => {
    const yy = getJoiningYear(userDetails.email);
    const defaultRoll = yy ? `10${yy}` : '';
    
    setEditForm({ 
      ...userDetails, 
      name: currentUserName, 
      email: userDetails.email, // BUG FIXED: Email now maps correctly
      password: '',
      rollNumber: userDetails.rollNumber || defaultRoll // Prefill prefix
    });
    setIsEditingProfile(true);
  };

  if (!isAuthenticated) {
    return (
      <GoogleOAuthProvider clientId="372265007546-l79uh0fiofspf15rrtc1q71f0ihr40nt.apps.googleusercontent.com">
        <Auth onLoginSuccess={handleLoginSuccess} />
      </GoogleOAuthProvider>
    );
  }

  return (
    <div className="bg-slate-950 min-h-[100dvh] text-slate-100 font-caveat flex flex-col">       
      <motion.header className="fixed top-0 left-0 right-0 h-16 flex items-center justify-between px-4 sm:px-5 bg-slate-950/90 backdrop-blur-md z-50 border-b-2 border-slate-800 border-dashed">
        <span className="text-3xl font-black text-slate-100 tracking-tight">Campus<span className="text-blue-500">FLOW</span></span>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12">
          <path d="M1 8h6M0 12h5M2 16h4" className="stroke-slate-500" strokeWidth="1.5" strokeDasharray="2 2" />
          <g className="stroke-blue-400" strokeWidth="2.5">
            <circle cx="16" cy="5" r="2.5" />
            <path d="M16 7.5L13 14" />
            <path d="M14 11L11 10L9 12" />
            <path d="M14 11L17 12L19 9" />
            <path d="M13 14L10 17L7 17" />
            <path d="M13 14L16 18L15 22" />
          </g>
        </svg>
        
        <div className="flex items-center gap-4">
          <span className="text-xl sm:text-2xl font-bold text-slate-100 whitespace-nowrap">
            Hi, {currentUserName.split(' ')[0]}!
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => { setIsRefreshing(true); setRefreshKey(k => k+1); setTimeout(() => setIsRefreshing(false), 1000); }} className="p-1 text-slate-300">
              <RefreshCw size={24} className={isRefreshing ? "animate-spin text-blue-400" : ""} />
            </button>
            <Settings size={26} className="text-slate-300 cursor-pointer" onClick={() => { setIsEditingProfile(false); setShowSettings(true); }} />
          </div>
        </div>
      </motion.header>

      <main className="flex-1 w-full max-w-md mx-auto relative pt-20 pb-24">         
        <AnimatePresence mode="wait">
          <motion.div key={`${activeTab}-${refreshKey}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            {activeTab === 'home' && <Dashboard navigateTo={setActiveTab} />}
            {activeTab === 'vault' && <Vault />}
            {activeTab === 'daily' && <Daily />}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-md border-t-2 border-slate-800 border-dashed px-4 py-3 flex justify-around">
        {[{ id: 'home', icon: Home, label: 'HOME' }, { id: 'vault', icon: Wallet, label: 'VAULT' }, { id: 'daily', icon: BookOpen, label: 'DAILY' }, { id: 'bazaar', icon: ShoppingBag, label: 'BAZAAR' }].map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex flex-col items-center gap-1 px-4 ${activeTab === item.id ? 'text-slate-100' : 'text-slate-500'}`}>
            <item.icon size={26} />
            <span className="text-lg font-bold">{item.label}</span>
          </button>
        ))}
      </nav>

      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSettings(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="fixed right-0 top-0 bottom-0 w-[85%] max-w-sm z-[70] p-6 shadow-2xl font-caveat bg-slate-950 border-l-2 border-slate-700 border-dashed bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px] overflow-y-auto overflow-x-hidden">
              <div className="absolute top-0 bottom-0 -left-2 w-4 bg-slate-950 pointer-events-none" />

              <AnimatePresence mode="wait">
                {!isEditingProfile ? (
                  <motion.div key="main" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <div className="flex justify-end mb-4"><button onClick={() => setShowSettings(false)} className="text-red-500 text-3xl font-black">✕</button></div>
                    
                    <div className="relative bg-slate-100 p-2 pb-6 shadow-xl rotate-3 w-40 mx-auto mb-6 border border-slate-300">
                      <button onClick={openEditProfile} className="absolute -right-3 -top-3 bg-blue-500 text-white p-2 rounded-full shadow-lg hover:scale-110 transition-transform z-10"><Edit3 size={18} /></button>
                      <div className="bg-slate-900 w-full h-32 flex items-center justify-center border border-slate-300 shadow-inner"><span className="text-6xl font-sans font-black text-blue-500">{currentUserName.charAt(0)}</span></div>
                      <p className="text-slate-800 text-2xl text-center mt-2 font-black truncate">{currentUserName}</p>
                    </div>

                    <SectionHeader title="Campus Identity" color="bg-yellow-400/30" />
                    
                    <div className="space-y-4">
                      {/* FIXED DROPDOWN ALIGNMENT */}
                      {['Stream', 'Batch', 'Semester', 'Hostel'].map(label => {
                        const key = label.toLowerCase() as keyof typeof userDetails;
                        const isSem = label === 'Semester';
                        const hasEmailYear = getJoiningYear(userDetails.email) !== null;
                        
                        return (
                          <div key={label} className="flex justify-between items-end group border-b border-slate-800 pb-1">
                            <span className="text-xl font-black text-slate-400">{label}:</span>
                            <div className="relative w-36">
                              <select 
                                value={userDetails[key]} 
                                onChange={(e) => updateProfile({ [key]: e.target.value })} 
                                disabled={isSem && hasEmailYear} // Locks Semester
                                className="w-full bg-transparent appearance-none text-blue-500 text-2xl font-black outline-none text-center disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {label === 'Stream' ? THAPAR_STREAMS.map(s => <option key={s} value={s} className="bg-slate-900 text-white font-sans text-base">{s}</option>) :
                                 label === 'Batch' ? THAPAR_BATCHES.map(b => <option key={b} value={b} className="bg-slate-900 text-white font-sans text-base">{b}</option>) : 
                                 label === 'Semester' ? [1,2,3,4,5,6,7,8].map(s => <option key={s} value={s} className="bg-slate-900 text-white font-sans text-base">Sem {s}</option>) :
                                 ['Hostel A', 'Hostel B', 'Hostel C', 'Hostel D', 'Hostel E', 'Hostel F', 'Hostel G', 'Hostel H', 'Hostel I', 'Hostel J', 'Hostel K', 'Hostel L', 'Day Scholar'].map(h => <option key={h} value={h} className="bg-slate-900 text-white font-sans text-base">{h}</option>)}
                              </select>
                            </div>
                            {isSem && hasEmailYear && <Lock size={12} className="text-slate-500 absolute right-6 mb-2" />}
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="mt-8 border-t-2 border-slate-800 border-dashed pt-4">
                      <button onClick={() => setNotifsEnabled(!notifsEnabled)} className="w-full flex justify-between items-end outline-none">
                        <span className="text-xl font-black text-slate-400">Alerts:</span>
                        <span className={`text-2xl font-black ${notifsEnabled ? 'text-blue-500' : 'text-slate-600'}`}>{notifsEnabled ? '[ ✓ ] ON' : '[    ] OFF'}</span>
                      </button>
                    </div>

                    <div className="pt-8 pb-8 flex flex-row items-center justify-between gap-3 w-full">
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => window.open('https://forms.gle/5UguWzkwwNXDbZJ16', '_blank')} 
                        className="flex-1 py-3 text-lg font-black text-blue-500 border-4 border-blue-600/70 rotate-2 uppercase rounded-lg shadow-sm hover:bg-blue-600/10 transition-colors tracking-wider"
                      >
                        FEEDBACK
                      </motion.button>
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleLogout} 
                        className="flex-1 py-3 text-xl font-black text-red-500 border-4 border-red-600/80 -rotate-2 uppercase rounded-lg shadow-sm hover:bg-red-600/10 transition-colors tracking-widest"
                      >
                        SIGN OUT
                      </motion.button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="edit" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex flex-col h-full">
                    <div className="flex items-center gap-4 mb-8 border-b-4 border-slate-700 border-dashed pb-4">
                      <ArrowLeft size={32} className="text-slate-400 cursor-pointer" onClick={() => setIsEditingProfile(false)} />
                      <h2 className="text-3xl font-black uppercase">Update ID</h2>
                    </div>
                    
                    <div className="space-y-6 flex-1">
                      
                      <div>
                        <label className="text-lg font-black text-slate-500 uppercase">Name</label>
                        <input 
                          type="text" 
                          value={editForm.name} 
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} 
                          className="w-full bg-transparent border-b-4 border-slate-700 border-dashed py-2 text-3xl font-black text-blue-400 outline-none" 
                        />
                      </div>

                      {/* BUG FIXED: FONTS */}
                      <div>
                        <label className="text-lg font-black text-slate-500 uppercase">Roll Number</label>
                        <input 
                          type="text" 
                          value={editForm.rollNumber} 
                          onChange={handleRollNumberChange} 
                          placeholder="e.g. 1025..."
                          className="w-full bg-transparent border-b-4 border-slate-700 border-dashed py-2 text-3xl font-black text-blue-400 outline-none" 
                        />
                      </div>

                      {/* BUG FIXED: FONTS */}
                      <div>
                        <label className="text-lg font-black text-slate-500 uppercase">Phone</label>
                        <div className="flex items-end">
                          <span className="text-3xl font-black text-slate-600 mr-2 pb-2">+91</span>
                          <input 
                            type="text" 
                            value={editForm.phone} 
                            onChange={handlePhoneChange} 
                            placeholder="10 digit number"
                            className="w-full bg-transparent border-b-4 border-slate-700 border-dashed py-2 text-3xl font-black text-blue-400 outline-none" 
                          />
                        </div>
                      </div>

                      <div className="opacity-70 bg-slate-900/60 p-3 rounded-lg border-2 border-slate-700/50 mt-4 relative">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Thapar ID</span>
                          <Lock size={16} className="text-slate-500" />
                        </div>
                        <input 
                          type="email" 
                          readOnly 
                          value={editForm.email} 
                          className="w-full bg-transparent text-xl font-bold text-slate-400 cursor-not-allowed outline-none select-none truncate font-sans" 
                          title="Your email is tied to your Google Account and cannot be changed." 
                        />
                      </div>

                    </div>
                    
                    <button onClick={handleSaveEditForm} className="w-full py-4 bg-blue-600/20 border-4 border-blue-500 border-dashed text-blue-400 font-black text-3xl rounded-xl mt-8 flex justify-center gap-3">
                      <CheckCircle2 size={28} /> STAMP IT
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}