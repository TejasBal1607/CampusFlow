import axios from 'axios';
import Dashboard from './components/Dashboard';
import Vault from './components/Vault';
import Auth from './components/Auth';
import Daily from './components/Daily';
import AdminDashboard from './components/Admin';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Home, Wallet, BookOpen, ShoppingBag, Settings, RefreshCw, Edit3, ArrowLeft, CheckCircle2, ChevronRight, ChevronLeft, ShieldAlert, FileText, Camera } from 'lucide-react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

const API_HOST = (import.meta as any).env.VITE_API_URL || 'http://localhost:8000';

// ==========================================
// THAPAR CUSTOM BATCH ENGINE
// ==========================================
const BATCH_CONFIG: any = {
  1: { A: ['11-19','21-28','31-38','41-45','51-55','61-65','71-75','81-85','91-95'], B: ['11-18','21-28','31-38','41-45','51-55','61-65','71-75','81-85','91-95'], X: ['11-14','21-24'], G: ['11-14'], J: ['11'], R: ['11-13'] },
  2: { E: ['11-12'], D: ['11-13'], S: ['11-15'], H: ['11-13','21-23'], W: ['11-14'], I: ['11-13'], A: ['11-12'], G: ['11-14'], J: ['11-12'], U: ['11'], B: ['11-13'], R: ['11-13'], F: ['11-14','21-23','31-33'], V: ['11-13'], O: ['11-14','21-24','31-34'], X: ['11-15'], Q: ['11-15','21-25','31-35','41'], C: ['11-18','21-25','31-35','41-45','51-55','61-65','71-75','81-82'] },
  3: { E: ['11-13'], D: ['11-14'], S: ['11-15'], H: ['11-13','21-23'], W: ['11-13'], I: ['11-13'], A: ['11-12'], G: ['11-15'], J: ['11'], U: ['11'], B: ['11-13'], P: ['11-14'], F: ['11-14','21-24'], V: ['11-13'], O: ['11-14','21-24','31-33'], Q: ['11-16','21-26'], C: ['11-18','21-25','31-35','41-45','51-55','61-65','71-75'] },
  4: { A: ['11'], J: ['11'], G: ['11'], E: ['11-12'], D: ['11-12'], H: ['11-12'], I: ['11-12'], S: ['11-13'], R: ['11-13'], O: ['11-14','21-24','31-33'], F: ['11-15','21-24'], C: ['11-19','21-29','31-39','41-49'], Q: ['11-17','21-27'] }
};

const getThaparBatches = (targetYear: number | null) => {
  const batches: string[] = [];
  const processYear = (y: number) => {
    if (!BATCH_CONFIG[y]) return;
    Object.entries(BATCH_CONFIG[y]).forEach(([pool, ranges]) => {
      (ranges as string[]).forEach(range => {
        if (range.includes('-')) {
          const [start, end] = range.split('-').map(Number);
          for (let i = start; i <= end; i++) batches.push(`${y}${pool}${i}`);
        } else {
          batches.push(`${y}${pool}${range}`);
        }
      });
    });
  };
  if (targetYear) processYear(targetYear);
  else [1, 2, 3, 4].forEach(processYear);
  return batches;
};

const THAPAR_STREAMS = ['COE', 'COBS', 'COPC', 'ENC', 'EEC', 'ECE', 'MEE', 'CIE', 'CHE', 'BME', 'BT'];

const getJoiningYear = (email: string) => {
  const match = email?.match(/_be(\d{2})@thapar\.edu/);
  return match ? parseInt(match[1]) : null;
};

const calculateSemester = (email: string) => {
  const yy = getJoiningYear(email);
  if (!yy) return 1; 
  const joinYear = 2000 + yy;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); 
  
  let sems = (currentYear - joinYear) * 2;
  if (currentMonth >= 7) sems += 1; 
  else sems += 0; 

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
  const [currentUserName, setCurrentUserName] = useState<string>('Loading...'); 
  
  const [userDetails, setUserDetails] = useState({
    email: '', phone: '', batch: '', semester: 1, hostel: '', rollNumber: '', stream: '', role: ''
  });

  const [showSettings, setShowSettings] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  
  // --- CAROUSEL TOUR STATE ---
  const [showTour, setShowTour] = useState(false); 
  const [tourStep, setTourStep] = useState(0);

  const navigateTo = (tabName: string) => setActiveTab(tabName);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notifsEnabled, setNotifsEnabled] = useState(true);
  
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', password: '', rollNumber: '', stream: '', batch: '', hostel: '' });

  const isAdmin = userDetails.role === 'super_admin' || userDetails.email === 'tejas1607.best@gmail.com';

  // --- PWA HARDWARE BACK BUTTON ---
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
      if (showTour) {
        if (tourStep > 0) setTourStep(s => s - 1);
        else setShowTour(false);
      }
      else if (isEditingProfile) setIsEditingProfile(false);
      else if (showSettings) setShowSettings(false);
      else if (activeTab !== 'home' && !isAdmin) setActiveTab('home');
      else if (activeTab !== 'daily' && isAdmin) setActiveTab('daily');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab, showSettings, isEditingProfile, isAdmin, showTour, tourStep]);

  useEffect(() => {
    if (isAdmin && (activeTab === 'home' || activeTab === 'vault')) setActiveTab('daily');
  }, [isAdmin, activeTab]);

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
      const autoSem = calculateSemester(fetchedEmail);

      setCurrentUserId(res.data.id);
      setCurrentUserName(res.data.name);
      
      setUserDetails({
        email: fetchedEmail, 
        phone: res.data.phone || '',
        batch: res.data.batch || '', 
        semester: res.data.role === 'guest' ? 1 : autoSem,
        hostel: res.data.hostel || '',
        rollNumber: res.data.roll_number || '',
        stream: res.data.stream || '',
        role: res.data.role
      });

      setEditForm(prev => ({
         ...prev,
         name: res.data.name,
         phone: res.data.phone || '',
         rollNumber: res.data.roll_number || '',
         stream: res.data.stream || '',
         batch: res.data.batch || '',
         hostel: res.data.hostel || ''
      }));

      if (!localStorage.getItem('cf_tour_done') && res.data.role !== 'super_admin') {
        setTimeout(() => setShowTour(true), 1500);
      }
    } catch (err) { handleLogout(); }
  };

  const updateProfile = async (updates: any) => {
    const token = localStorage.getItem('cf_token');
    try {
      const res = await axios.put(`${API_HOST}/auth/me?token=${token}`, updates);
      setCurrentUserName(res.data.name);
      setUserDetails(prev => ({
        ...prev, name: res.data.name, phone: res.data.phone || '', batch: res.data.batch || '', hostel: res.data.hostel || '', rollNumber: res.data.roll_number || '', stream: res.data.stream || '', semester: res.data.semester || prev.semester
      }));
      return true;
    } catch (err) { return false; }
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
    setEditForm({ name: '', email: '', phone: '', password: '', rollNumber: '', stream: '', batch: '', hostel: '' });
    setUserDetails({ email: '', phone: '', batch: '', semester: 1, hostel: '', rollNumber: '', stream: '', role: '' });
  };

  const handleSaveEditForm = async () => {
    if (!isAdmin) {
      if (!editForm.stream || !editForm.batch || !editForm.hostel || !editForm.rollNumber || !editForm.phone) {
        alert("All fields are required to enter the grid."); return;
      }
      if (editForm.phone && editForm.phone.length !== 10) {
        alert("Phone number must be exactly 10 digits."); return;
      }
      if (editForm.rollNumber !== 'N/A') {
        const requiredPrefix = getJoiningYear(userDetails.email) ? `10${getJoiningYear(userDetails.email)}` : '10';
        if (editForm.rollNumber.length !== 10 || !editForm.rollNumber.startsWith(requiredPrefix)) {
          alert(`Roll number must be 10 digits and start with ${requiredPrefix} (or select Not Allotted)`); return;
        }
      }
    }

    const updates: any = { name: editForm.name, phone: editForm.phone, batch: editForm.batch, hostel: editForm.hostel };
    if (!isAdmin) {
      updates.roll_number = editForm.rollNumber; updates.stream = editForm.stream;
      if (userDetails.role === 'guest') updates.semester = 1;
    }

    const success = await updateProfile(updates);
    if (success) setIsEditingProfile(false); 
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, ''); 
    if (val.length <= 10) setEditForm({ ...editForm, phone: val });
  };

  const handleRollNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase();
    if (val === 'N/A') { setEditForm({ ...editForm, rollNumber: val }); return; }
    val = val.replace(/\D/g, ''); 
    const yy = getJoiningYear(userDetails.email);
    const prefix = yy ? `10${yy}` : '10';
    if (!val.startsWith(prefix) && val.length > 0) val = prefix; 
    if (val.length <= 10) setEditForm({ ...editForm, rollNumber: val });
  };

  const openEditProfile = () => {
    const yy = getJoiningYear(userDetails.email);
    const defaultRoll = yy ? `10${yy}` : '';
    setEditForm({ ...userDetails, name: currentUserName, email: userDetails.email, password: '', rollNumber: userDetails.rollNumber || defaultRoll });
    setIsEditingProfile(true);
  };

  const handleMigrateSuccess = async (credentialResponse: any) => {
    try {
      const token = localStorage.getItem('cf_token');
      await axios.post(`${API_HOST}/auth/migrate?token=${token}`, { token: credentialResponse.credential });
      alert("Successfully linked! Reloading...");
      window.location.reload();
    } catch (e: any) { alert(e.response?.data?.detail || "Migration failed."); }
  };

  const joinYear = getJoiningYear(userDetails.email);
  const currentYear = new Date().getFullYear();
  let studentYear = joinYear ? (currentYear - (2000 + joinYear)) : 1;
  if (new Date().getMonth() >= 6) studentYear += 1;
  studentYear = Math.max(1, Math.min(4, studentYear));
  const availableBatches = isAdmin ? getThaparBatches(null) : getThaparBatches(studentYear);

  if (!isAuthenticated) {
    return (
      <GoogleOAuthProvider clientId="372265007546-l79uh0fiofspf15rrtc1q71f0ihr40nt.apps.googleusercontent.com">
        <Auth onLoginSuccess={handleLoginSuccess} />
      </GoogleOAuthProvider>
    );
  }

  const needsSetup = !isAdmin && (!userDetails.phone || !userDetails.rollNumber || !userDetails.batch || !userDetails.stream || !userDetails.hostel);

  if (needsSetup) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-caveat">
        <div className="bg-slate-900 border-2 border-blue-500 rounded-2xl p-6 w-full max-w-sm">
          <h2 className="text-3xl font-black text-white uppercase tracking-widest mb-1">Complete Profile</h2>
          <p className="text-lg text-slate-400 mb-6">You must fill this out to enter the grid.</p>
          <div className="space-y-4 mb-6">
            <input type="text" placeholder="Full Name" value={editForm.name || currentUserName} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white text-xl font-bold font-caveat" />
            <div className="relative w-full">
              <input type="text" placeholder="Roll Number (e.g. 1025...)" value={editForm.rollNumber} onChange={handleRollNumberChange} className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white text-xl font-bold font-caveat pr-24" />
              <button onClick={() => setEditForm({...editForm, rollNumber: 'N/A'})} className="absolute right-3 top-3.5 text-sm font-bold text-blue-400 bg-slate-900 px-2 rounded-md border border-blue-500/30">Not Allotted</button>
            </div>
            <input type="text" placeholder="Phone Number" value={editForm.phone} onChange={handlePhoneChange} className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white text-xl font-bold font-caveat" />
            <select value={editForm.stream || userDetails.stream} onChange={e => setEditForm({...editForm, stream: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white text-xl font-bold font-caveat">
              <option value="">Select Stream...</option>
              {THAPAR_STREAMS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={editForm.batch || userDetails.batch} onChange={e => setEditForm({...editForm, batch: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white text-xl font-bold font-caveat">
              <option value="">Select Batch...</option>
              <option value="Unassigned">Not Allotted Yet</option>
              {availableBatches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={editForm.hostel || userDetails.hostel} onChange={e => setEditForm({...editForm, hostel: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white text-xl font-bold font-caveat">
              <option value="">Select Hostel...</option>
              <option value="Unassigned">Not Allotted Yet</option>
              {['Hostel A', 'Hostel B', 'Hostel C', 'Hostel D', 'Hostel E', 'Hostel F', 'Hostel G', 'Hostel H', 'Hostel I', 'Hostel J', 'Hostel K', 'Hostel L', 'Day Scholar'].map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <button onClick={handleSaveEditForm} className="w-full py-3 bg-blue-600 text-white text-2xl font-black tracking-widest uppercase rounded-xl hover:bg-blue-500">
            Finalize & Enter
          </button>
        </div>
      </div>
    );
  }

  const navItems = isAdmin 
    ? [ { id: 'daily', icon: BookOpen, label: 'DAILY' }, { id: 'bazaar', icon: ShoppingBag, label: 'BAZAAR' } ]
    : [ { id: 'home', icon: Home, label: 'HOME' }, { id: 'vault', icon: Wallet, label: 'VAULT' }, { id: 'daily', icon: BookOpen, label: 'DAILY' }, { id: 'bazaar', icon: ShoppingBag, label: 'BAZAAR' } ];

  const settingsFieldsToDisplay = isAdmin ? ['Batch', 'Hostel'] : ['Stream', 'Batch', 'Semester', 'Hostel'];

  return (
    <div className="bg-slate-950 min-h-[100dvh] text-slate-100 font-caveat flex flex-col relative">       
      
      {/* NATIVE SURVIVAL GUIDE CAROUSEL */}
      <AnimatePresence>
        {showTour && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-slate-900 border-2 border-blue-500 rounded-2xl p-6 max-w-sm w-full shadow-[0_0_40px_rgba(59,130,246,0.2)] flex flex-col h-[550px]">
              
              <div className="flex justify-between items-center mb-6">
                <span className="text-xs font-black text-blue-400 tracking-widest uppercase">Survival Guide {tourStep + 1}/4</span>
                <button onClick={() => { setShowTour(false); localStorage.setItem('cf_tour_done', 'true'); }} className="text-slate-500 hover:text-white text-xs font-bold uppercase">Skip</button>
              </div>

              <div className="flex-1 overflow-y-auto hide-scrollbar">
                <AnimatePresence mode="wait">
                  {tourStep === 0 && (
                    <motion.div key="0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="text-center">
                      <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-widest font-caveat">Welcome to<br/><span className="text-blue-500">CampusFLOW</span></h2>
                      <p className="text-sm text-slate-400 mb-8">Your ultimate Thapar OS. The app is divided into 3 main pillars:</p>
                      <div className="space-y-3 text-left">
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex gap-4 items-center">
                          <BookOpen className="text-blue-400 shrink-0" size={28}/><div><h4 className="font-black text-white">Daily</h4><p className="text-xs text-slate-400">Classes, Menus, Comms & Acad Vault</p></div>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex gap-4 items-center">
                          <Wallet className="text-purple-400 shrink-0" size={28}/><div><h4 className="font-black text-white">Vault</h4><p className="text-xs text-slate-400">Finance, Budgets, OCR & Bill Splits</p></div>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex gap-4 items-center opacity-50">
                          <ShoppingBag className="text-green-400 shrink-0" size={28}/><div><h4 className="font-black text-white">Bazaar</h4><p className="text-xs text-slate-400">2nd Hand Store & Events (Coming Soon)</p></div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {tourStep === 1 && (
                    <motion.div key="1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <h2 className="text-2xl font-black text-blue-400 mb-4 uppercase tracking-widest font-caveat flex items-center gap-2"><BookOpen/> The Daily Hub</h2>
                      <div className="space-y-4">
                        <div className="border-l-2 border-slate-700 pl-3">
                          <h4 className="font-bold text-white text-sm">Class Tracker & Weekly Grid</h4>
                          <p className="text-xs text-slate-400 leading-relaxed">View today's schedule. <strong className="text-blue-400">Click the top-right Date icon</strong> to view your entire weekly timetable and sync the AI.</p>
                        </div>
                        <div className="border-l-2 border-slate-700 pl-3">
                          <h4 className="font-bold text-white text-sm">Bunk Meter</h4>
                          <p className="text-xs text-slate-400 leading-relaxed">Track attendance securely. It tells you exactly how many classes you need to hit 75%, or how many you can safely bunk.</p>
                        </div>
                        <div className="border-l-2 border-slate-700 pl-3">
                          <h4 className="font-bold text-white text-sm">Acad Vault</h4>
                          <p className="text-xs text-slate-400 leading-relaxed">Click the floating folder icon at the bottom right to access structured PYQs and notes specific to your Year and Stream.</p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {tourStep === 2 && (
                    <motion.div key="2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <h2 className="text-2xl font-black text-purple-400 mb-4 uppercase tracking-widest font-caveat flex items-center gap-2"><Wallet/> The Vault</h2>
                      <div className="space-y-4">
                        <div className="border-l-2 border-slate-700 pl-3">
                          <h4 className="font-bold text-white text-sm">AI Receipt Scanning</h4>
                          <p className="text-xs text-slate-400 leading-relaxed">Click the <Camera size={12} className="inline"/> icon when adding an expense. Our AI will automatically read the amount, vendor, and category from your receipt.</p>
                        </div>
                        <div className="border-l-2 border-slate-700 pl-3">
                          <h4 className="font-bold text-white text-sm">Split Bills Seamlessly</h4>
                          <p className="text-xs text-slate-400 leading-relaxed">Search for a friend when logging an expense. The app calculates the split and automatically adds it to your mutual <strong className="text-purple-400">Debt Ledger</strong>.</p>
                        </div>
                        <div className="border-l-2 border-slate-700 pl-3">
                          <h4 className="font-bold text-white text-sm">Burn Rate Averages</h4>
                          <p className="text-xs text-slate-400 leading-relaxed">Set a monthly limit. The Vault calculates your "Needed Burn Rate" so you know exactly how much you can spend per day without going broke.</p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {tourStep === 3 && (
                    <motion.div key="3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="text-center pt-8">
                      <ShieldAlert size={48} className="text-yellow-500 mx-auto mb-4" />
                      <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-widest font-caveat">Community Rules</h2>
                      <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                        CampusFLOW relies on crowdsourcing. If you upload fake Mess Menus or inappropriate resources, the community will flag it. <strong className="text-red-400">3 strikes and you lose upload privileges for a week.</strong>
                      </p>
                      <p className="text-sm font-bold text-blue-400">Click the gear icon anytime to update your Profile.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="pt-4 mt-auto border-t border-slate-800 flex justify-between gap-3">
                {tourStep > 0 ? (
                  <button onClick={() => setTourStep(s => s - 1)} className="px-4 py-3 bg-slate-800 text-white rounded-xl font-bold uppercase tracking-wider text-xs flex items-center hover:bg-slate-700"><ChevronLeft size={16}/> Back</button>
                ) : <div/>}
                
                {tourStep < 3 ? (
                  <button onClick={() => setTourStep(s => s + 1)} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-wider text-sm flex items-center gap-1 hover:bg-blue-500 shadow-[0_4px_15px_rgba(37,99,235,0.4)]">Next <ChevronRight size={18}/></button>
                ) : (
                  <button onClick={() => { setShowTour(false); localStorage.setItem('cf_tour_done', 'true'); }} className="flex-1 py-3 bg-green-500 text-white rounded-xl font-black uppercase tracking-wider text-sm hover:bg-green-400 shadow-[0_4px_15px_rgba(34,197,94,0.4)]">Enter the Grid</button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
            {activeTab === 'home' && !isAdmin && <Dashboard navigateTo={setActiveTab} />}
            {activeTab === 'vault' && !isAdmin && <Vault />}
            {activeTab === 'daily' && <Daily />}
            {activeTab === 'admin' && isAdmin && <AdminDashboard navigateTo={navigateTo} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-md border-t-2 border-slate-800 border-dashed px-4 py-3 flex justify-around">
        {navItems.map(item => (
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
                      {settingsFieldsToDisplay.map(label => {
                        const key = label.toLowerCase() as keyof typeof userDetails;
                        const isSem = label === 'Semester';
                        const isGuest = userDetails.role === 'guest';
                        const hasEmailYear = getJoiningYear(userDetails.email) !== null;
                        
                        return (
                          <div key={label} className="flex justify-between items-end group border-b border-slate-800 pb-1">
                            <span className="text-xl font-black text-slate-400">{label}:</span>
                            <div className="relative w-36">
                              <select 
                                value={userDetails[key]} 
                                onChange={(e) => updateProfile({ [key]: e.target.value })} 
                                disabled={(isSem && hasEmailYear) || (isSem && isGuest)} 
                                className="w-full bg-transparent appearance-none text-blue-500 text-2xl font-black outline-none text-center disabled:opacity-50 disabled:cursor-not-allowed font-caveat"
                              >
                                {label === 'Stream' ? THAPAR_STREAMS.map(s => <option key={s} value={s} className="bg-slate-900 text-white font-caveat text-xl">{s}</option>) :
                                 label === 'Batch' ? (
                                   <>
                                     <option value="Unassigned" className="bg-slate-900 text-white font-caveat text-xl">Not Allotted</option>
                                     {availableBatches.map(b => <option key={b} value={b} className="bg-slate-900 text-white font-caveat text-xl">{b}</option>)}
                                   </>
                                 ) : 
                                 label === 'Semester' ? [1,2,3,4,5,6,7,8].map(s => <option key={s} value={s} className="bg-slate-900 text-white font-caveat text-xl">Sem {s}</option>) :
                                 (
                                   <>
                                     <option value="Unassigned" className="bg-slate-900 text-white font-caveat text-xl">Not Allotted</option>
                                     {['Hostel A', 'Hostel B', 'Hostel C', 'Hostel D', 'Hostel E', 'Hostel F', 'Hostel G', 'Hostel H', 'Hostel I', 'Hostel J', 'Hostel K', 'Hostel L', 'Day Scholar'].map(h => <option key={h} value={h} className="bg-slate-900 text-white font-caveat text-xl">{h}</option>)}
                                   </>
                                 )}
                              </select>
                            </div>
                            {((isSem && hasEmailYear) || (isSem && isGuest)) && <Lock size={12} className="text-slate-500 absolute right-6 mb-2" />}
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

                    {userDetails.role === 'guest' && (
                      <div className="mt-6 p-4 bg-blue-900/20 border-2 border-blue-500/50 rounded-xl font-sans">
                        <h3 className="text-lg font-black text-blue-400 uppercase tracking-widest mb-2">Upgrade Account</h3>
                        <p className="text-xs text-slate-400 mb-4">Link your official Thapar ID to unlock AI uploads and verified features. Your data will migrate automatically.</p>
                        <div className="flex justify-center bg-white rounded-full overflow-hidden">
                          <GoogleOAuthProvider clientId="372265007546-l79uh0fiofspf15rrtc1q71f0ihr40nt.apps.googleusercontent.com">
                            <GoogleLogin onSuccess={handleMigrateSuccess} useOneTap={false} text="continue_with" width="100%" />
                          </GoogleOAuthProvider>
                        </div>
                      </div>
                    )}

                    {isAdmin && (
                      <button 
                        onClick={() => { setShowSettings(false); navigateTo('admin'); }}
                        className="w-full py-3 mt-6 mb-4 text-2xl font-black text-slate-900 bg-yellow-400 border-4 border-yellow-500 uppercase rounded-lg shadow-sm hover:bg-yellow-300 transition-colors tracking-widest flex justify-center items-center gap-2"
                      >
                         Access God Mode
                      </button>
                    )}

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
                  <motion.div key="edit" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex flex-col h-full font-caveat">
                    <div className="flex items-center gap-4 mb-8 border-b-4 border-slate-700 border-dashed pb-4 font-caveat">
                      <ArrowLeft size={32} className="text-slate-400 cursor-pointer" onClick={() => setIsEditingProfile(false)} />
                      <h2 className="text-3xl font-black uppercase">Update ID</h2>
                    </div>
                    
                    <div className="space-y-6 flex-1">
                      <div>
                        <label className="text-xl font-black text-slate-500 uppercase tracking-widest">Name</label>
                        <input 
                          type="text" 
                          value={editForm.name} 
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} 
                          className="w-full bg-transparent border-b-2 border-slate-700 border-dashed py-2 text-2xl font-bold text-blue-400 outline-none font-caveat" 
                        />
                      </div>

                      {!isAdmin && (
                        <div>
                          <label className="text-xl font-black text-slate-500 uppercase tracking-widest">Roll Number</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              value={editForm.rollNumber} 
                              onChange={handleRollNumberChange} 
                              placeholder="e.g. 1025..."
                              className="w-full bg-transparent border-b-2 border-slate-700 border-dashed py-2 text-2xl font-bold text-blue-400 outline-none font-caveat pr-24" 
                            />
                            <button onClick={() => setEditForm({...editForm, rollNumber: 'N/A'})} className="absolute right-0 top-3 text-sm font-bold text-blue-400 bg-slate-900 px-2 rounded-md border border-blue-500/30">Not Allotted</button>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="text-xl font-black text-slate-500 uppercase tracking-widest">Phone</label>
                        <div className="flex items-end">
                          <span className="text-2xl font-bold text-slate-600 mr-2 pb-2">+91</span>
                          <input 
                            type="text" 
                            value={editForm.phone} 
                            onChange={handlePhoneChange} 
                            placeholder="10 digit number"
                            className="w-full bg-transparent border-b-2 border-slate-700 border-dashed py-2 text-2xl font-bold text-blue-400 outline-none font-caveat" 
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
                          className="w-full bg-transparent text-xl font-bold text-slate-400 cursor-not-allowed outline-none select-none truncate font-caveat" 
                          title="Your email is tied to your Google Account and cannot be changed." 
                        />
                      </div>
                    </div>
                    
                    <button onClick={handleSaveEditForm} className="w-full py-4 font-caveat bg-blue-600/20 border-4 border-blue-500 border-dashed text-blue-400 font-black text-3xl rounded-xl mt-8 flex justify-center gap-3">
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