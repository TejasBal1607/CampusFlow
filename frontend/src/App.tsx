import axios from 'axios';
import Dashboard from './components/Dashboard';
import Vault from './components/Vault';
import Auth from './components/Auth';
import Daily from './components/Daily';
import AdminDashboard from './components/Admin';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Home, Wallet, BookOpen, ShoppingBag, Settings, RefreshCw, Edit3, ArrowLeft, CheckCircle2, HelpCircle } from 'lucide-react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const API_HOST = (import.meta as any).env.VITE_API_URL || 'http://localhost:8000';

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

const createStep = (selector: string, title: string, description: string, side: string = "top"): any => ({
  element: selector,
  popover: { title, description, side, align: 'center' },
  onHighlightStarted: () => {
    const el = document.querySelector(selector);
    if (el) {
      el.scrollIntoView({ behavior: 'instant', block: 'center' });
    }
  }
});

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // FIX 1: New loading state for the full-screen spinner
  const [isProfileLoading, setIsProfileLoading] = useState(true); 
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('Loading...'); 
  
  const [userDetails, setUserDetails] = useState({
    email: '', phone: '', batch: '', semester: 1, hostel: '', rollNumber: '', stream: '', role: ''
  });

  const [showSettings, setShowSettings] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [pendingTour, setPendingTour] = useState(false);
  const tourLocked = useRef(false);
  
  const navigateTo = (tabName: string) => setActiveTab(tabName);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notifsEnabled, setNotifsEnabled] = useState(true);
  
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', password: '', rollNumber: '', stream: '', batch: '', hostel: '' });

  const isAdmin = userDetails.role === 'super_admin' || userDetails.email === 'tejas1607.best@gmail.com';
  
  const needsSetup = !isAdmin && (!userDetails.phone || !userDetails.rollNumber || !userDetails.batch || !userDetails.stream || !userDetails.hostel);

  const startTour = () => {
    setActiveTab('home'); 
    window.dispatchEvent(new CustomEvent('tour-vault-view', { detail: 'overview' }));
    window.dispatchEvent(new CustomEvent('tour-vault-modal', { detail: 'none' }));

    setTimeout(() => {
      const driverObj = driver({
        showProgress: true,
        animate: true,
        allowClose: false,
        popoverClass: 'driverjs-theme',
        onNextClick: (element, step) => {
          const title = step.popover?.title;

          if (title === 'Your Identity') {
            setActiveTab('vault');
            window.dispatchEvent(new CustomEvent('tour-vault-view', { detail: 'overview' }));
            setTimeout(() => driverObj.moveNext(), 600);
          } else if (title === 'Export Data') {
            window.dispatchEvent(new CustomEvent('tour-vault-view', { detail: 'expenses' }));
            setTimeout(() => driverObj.moveNext(), 600);
          } else if (title === 'Add Expense') {
            window.dispatchEvent(new CustomEvent('tour-vault-modal', { detail: 'expense' }));
            setTimeout(() => driverObj.moveNext(), 600);
          } else if (title === 'Recurring Subscriptions') {
            window.dispatchEvent(new CustomEvent('tour-vault-modal', { detail: 'none' }));
            window.dispatchEvent(new CustomEvent('tour-vault-view', { detail: 'overview' }));
            setActiveTab('daily');
            setTimeout(() => driverObj.moveNext(), 600);
          } else if (title === 'Acad Vault') {
            setActiveTab('bazaar');
            setTimeout(() => driverObj.moveNext(), 600);
          } else if (title === 'Coming Soon') {
            setActiveTab('home');
            setTimeout(() => driverObj.moveNext(), 600);
          } else {
            driverObj.moveNext();
          }
        },
        steps: [
          { popover: { title: 'Welcome to CampusFLOW', description: 'Your campus OS is ready. Let us take a quick tour of your new grid.', align: 'center' } },
          createStep('.tour-home-widgets', 'At a Glance', 'Your quick overview. See your immediate balances and recent grid activity right here.', 'bottom'),
          createStep('.tour-settings', 'Your Identity', 'Click the gear to update your batch, hostel, stream, and more.', 'left'),
          
          createStep('.tour-vault-nav', 'The Vault', 'Your financial ledger.', 'top'),
          createStep('.tour-vault-budget', 'Set Monthly Budget', 'You can easily start by clicking the Edit icon to set your monthly budget.', 'top'),
          createStep('.tour-vault-exp', 'Expenses', 'Track what you have spent this month.', 'bottom'),
          createStep('.tour-vault-net', 'Net Cash In', 'Your total budget and incomes combined.', 'bottom'),
          createStep('.tour-vault-sav', 'Savings', 'Money locked away in your Vault Cache.', 'bottom'),
          createStep('.tour-vault-avail', 'Available Cash', 'What you can safely spend right now.', 'bottom'),
          createStep('.tour-vault-ledger', 'Debt Ledger', 'Keep track of who owes you, and who you owe. No more lost money!.', 'top'),
          createStep('.tour-vault-avg', 'The Averages', 'We calculate your ideal burn rate and also show your current and needed burn rate according to your spendings.', 'top'),
          createStep('.tour-vault-alloc', 'Resource Allocation', 'A visual breakdown of where your money is actually going.', 'top'),
          createStep('.tour-vault-export', 'Export Data', 'Generate a clean PDF report of your entire month\'s activity.', 'top'),

          createStep('.tour-vault-log', 'Logs', 'Lets dive deeper and see the logs. For example in this expense tab where you can view, create, edit and delete your expenses', 'top'),
          createStep('.tour-vault-add', 'Add Expense', 'Click the + button to log a new expense.', 'left'),
          createStep('.tour-vault-modal', 'Expense Editor', 'Fill in the details manually, or use our smart tools.', 'top'),
          createStep('.tour-vault-ocr', 'AI Receipt Scanner', 'Click the Camera icon to scan a upi payment screenshot. Our AI instantly extracts the required data which you can edit before saving.', 'bottom'),
          createStep('.tour-vault-split', 'Split Bills', 'Ate with friends? Click Split, search their name or number, and we will automatically add it to your mutual Debt Ledgers.', 'top'),
          createStep('.tour-vault-repeat', 'Recurring Subscriptions', 'Click Monthly for Spotify, Netflix, or Gym fees, and we will log it automatically every month.', 'top'),

          createStep('.tour-daily-nav', 'The Daily Hub', 'Everything you need for academic or hostel life today.', 'top'),
          createStep('.tour-class-tracker', 'Live Class Tracker', 'Watch the minutes tick down for your active class, and mark attendance instantly.', 'bottom'),
          createStep('.tour-weekly-tt', 'Weekly Timetable', 'Click the Date to view your full weekly schedule. You can be the hero and upload the timetable if it is missing!', 'bottom'),
          createStep('.tour-mess-menu', 'Mess Menu', 'Today\'s menu for your hostel. If it is empty, snap a picture to upload it for everyone.', 'bottom'),
          createStep('.tour-bunk-meter', 'The Bunk Meter', 'Track your subjects. We calculate exactly how many classes you need to hit 75%, or how many you can safely bunk.', 'top'),
          createStep('.tour-comms', 'Comms Radar', 'Targeted broadcasts. You will only see alerts meant for your specific batch, stream, or hostel.', 'top'),
          createStep('.tour-acad-vault', 'Acad Vault', 'Access PYQs, notes, and study material organised neatly into various folders.', 'left'),

          createStep('.tour-bazaar-nav', 'The Bazaar', 'Your campus marketplace and event hub.', 'top'),
          createStep('.tour-bazaar-content', 'Coming Soon', 'Buy/Sell 2nd hand items safely, use the Thapar Navigator, and discover campus events here soon!', 'top'),

          // FIX 3: HTML INJECTION FOR WARNING SHIELD
          { 
            popover: { 
              title: '', 
              description: `
                <div style="display: flex; flex-direction: column; align-items: center; text-align: center; margin-top: 10px;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 12px;">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  <p style="color: #ef4444; font-weight: 900; font-size: 1.2rem; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; font-family: ui-sans-serif, system-ui;">Report and Ban Policy Active</p>
                  <p style="color: #94a3b8; font-size: 1rem; font-family: ui-sans-serif, system-ui; line-height: 1.5; font-weight: bold;">CampusFLOW relies on crowdsourcing. Uploading fake menus or inappropriate resources will result in an immediate ban.<br/><br/>Play nice, and enjoy the grid!</p>
                </div>
              `, 
              align: 'center' 
            } 
          },
        ],
        onDestroyed: () => {
          window.dispatchEvent(new CustomEvent('tour-vault-modal', { detail: 'none' }));
          window.dispatchEvent(new CustomEvent('tour-vault-view', { detail: 'overview' }));
        }
      });
      driverObj.drive();
    }, 400); 
  };

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const isTourDone = localStorage.getItem('cf_tour_done') === 'true';

    if (pendingTour && !needsSetup && isAuthenticated && !tourLocked.current && !isTourDone) {
      tourLocked.current = true;
      localStorage.setItem('cf_tour_done', 'true'); 
      
      timer = setTimeout(() => {
        startTour();
        setPendingTour(false);
      }, 800);
    }

    return () => clearTimeout(timer);
  }, [pendingTour, needsSetup, isAuthenticated]);

  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
      if (isEditingProfile) setIsEditingProfile(false);
      else if (showSettings) setShowSettings(false);
      else if (activeTab !== 'home' && !isAdmin) setActiveTab('home');
      else if (activeTab !== 'daily' && isAdmin) setActiveTab('daily');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab, showSettings, isEditingProfile, isAdmin]);

  useEffect(() => {
    if (isAdmin && (activeTab === 'home' || activeTab === 'vault')) setActiveTab('daily');
  }, [isAdmin, activeTab]);

  useEffect(() => {
    const token = localStorage.getItem('cf_token');
    if (token) {
      setIsAuthenticated(true);
      fetchProfile(token);
    } else {
      setIsProfileLoading(false); // Stop loading if no token is found
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
         ...prev, name: res.data.name, phone: res.data.phone || '', rollNumber: res.data.roll_number || '', stream: res.data.stream || '', batch: res.data.batch || '', hostel: res.data.hostel || ''
      }));

      if (localStorage.getItem('cf_tour_done') !== 'true' && res.data.role !== 'super_admin') {
        setPendingTour(true); 
      }
    } catch (err: any) { 
      if (err.response?.status === 403) alert(err.response.data.detail);
      handleLogout(); 
    } finally {
      setIsProfileLoading(false); // Stop loading regardless of success or failure
    }
  };

  const updateProfile = async (updates: any) => {
    const token = localStorage.getItem('cf_token');
    try {
      const res = await axios.put(`${API_HOST}/auth/me?token=${token}`, updates);
      setCurrentUserName(res.data.name);
      const autoSem = calculateSemester(res.data.email);
      setUserDetails(prev => ({
        ...prev, name: res.data.name, phone: res.data.phone || '', batch: res.data.batch || '', hostel: res.data.hostel || '', rollNumber: res.data.roll_number || '', stream: res.data.stream || '', semester: res.data.role === 'guest' ? 1 : autoSem
      }));
      return true;
    } catch (err) { return false; }
  };

  const handleLoginSuccess = (token: string, userId: number, name: string) => {
    localStorage.setItem('cf_token', token);
    localStorage.setItem('cf_name', name);
    setIsAuthenticated(true);
    setIsProfileLoading(true); // Restart loader for the new login
    fetchProfile(token);
  };

  const handleLogout = () => {
    localStorage.removeItem('cf_token');
    localStorage.removeItem('cf_name');
    
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

  // --- NEW FULL SCREEN LOADING STATE ---
  if (isProfileLoading) {
    return (
      <div className="min-h-[100dvh] bg-slate-950 flex flex-col items-center justify-center p-4 font-caveat text-center">
        <RefreshCw size={48} className="animate-spin text-blue-500 mb-6" />
        <h2 className="text-4xl font-black text-white uppercase tracking-widest mb-2 drop-shadow-lg">Entering the Grid</h2>
        <p className="text-xl text-slate-400 font-sans font-bold">Your ultimate campus experience is loading. Please wait...</p>
      </div>
    );
  }

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
      
      {/* FIX 2 & 3: UPGRADED DRIVER.JS CSS */}
      <style dangerouslySetInnerHTML={{__html: `
        .driverjs-theme {
          background-color: #0f172a !important;
          color: #f8fafc !important;
          border: 2px solid #3b82f6 !important;
          border-radius: 16px !important;
          font-family: 'Caveat', cursive, sans-serif !important;
          box-shadow: 0 10px 25px rgba(59, 130, 246, 0.2) !important;
        }
        .driver-popover-title { 
          color: #3b82f6 !important; 
          font-weight: 900 !important; 
          font-size: 28px !important;
          text-transform: uppercase !important; 
          letter-spacing: 1px !important; 
          margin-bottom: 8px !important;
          font-family: 'Caveat', cursive !important;
        }
        .driver-popover-description { 
          color: #94a3b8 !important; 
          font-size: 22px !important; 
          line-height: 1.2 !important;
          font-family: 'Caveat', cursive !important;
          font-weight: 700 !important;
        }
        .driver-popover-footer {
          margin-top: 12px !important;
        }
        .driver-popover-next-btn, .driver-popover-prev-btn { 
          background-color: #3b82f6 !important; 
          color: white !important; 
          border: 2px solid #2563eb !important; 
          font-weight: 900 !important; 
          border-radius: 8px !important; 
          text-shadow: none !important;
          text-transform: uppercase !important;
          padding: 4px 12px !important;
          font-family: 'Caveat', cursive !important;
          font-size: 18px !important;
        }
        .driver-popover-next-btn:hover, .driver-popover-prev-btn:hover {
          background-color: #2563eb !important;
        }
        .driver-popover-close-btn { color: #ef4444 !important; }
      `}} />

      <motion.header className="fixed top-0 left-0 right-0 h-16 flex items-center justify-between px-4 sm:px-5 bg-slate-950/90 backdrop-blur-md z-50 border-b-2 border-slate-800 border-dashed">
        
        <div className="flex items-center gap-2"> 
          <span className="text-3xl font-black text-slate-100 tracking-tight">Campus<span className="text-blue-500">FLOW</span></span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 mb-1">
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
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <button onClick={startTour} className="p-1 text-slate-400 hover:text-blue-400 transition-colors" title="Replay Tour">
              <HelpCircle size={22} />
            </button>
            <button onClick={() => { setIsRefreshing(true); setRefreshKey(k => k+1); setTimeout(() => setIsRefreshing(false), 1000); }} className="p-1 text-slate-300">
              <RefreshCw size={22} className={isRefreshing ? "animate-spin text-blue-400" : ""} />
            </button>
            <Settings size={26} className="text-slate-300 cursor-pointer tour-settings" onClick={() => { setIsEditingProfile(false); setShowSettings(true); }} />
          </div>
        </div>
      </motion.header>

      <main className="flex-1 w-full max-w-md mx-auto relative pt-20 pb-24">         
        <AnimatePresence mode="wait">
          <motion.div key={`${activeTab}-${refreshKey}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            
            {activeTab === 'home' && !isAdmin && (
              <div className="tour-home-widgets w-full">
                <Dashboard navigateTo={setActiveTab} />
              </div>
            )}
            
            {activeTab === 'vault' && !isAdmin && <Vault />}
            {activeTab === 'daily' && <Daily />}
            {activeTab === 'admin' && isAdmin && <AdminDashboard navigateTo={navigateTo} />}
            
            {activeTab === 'bazaar' && (
              <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4 tour-bazaar-content">
                <ShoppingBag size={64} className="text-slate-700 mb-4" />
                <h2 className="text-3xl font-black text-slate-400 uppercase tracking-widest mb-2">The Bazaar</h2>
                <p className="text-slate-500 font-sans font-bold leading-relaxed">2nd Hand Store • Thapar Navigator • Events<br/>Coming Soon.</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-md border-t-2 border-slate-800 border-dashed px-4 py-3 flex justify-around">
        {navItems.map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} className={`tour-${item.id}-nav flex flex-col items-center gap-1 px-4 ${activeTab === item.id ? 'text-slate-100' : 'text-slate-500'}`}>
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
                        const key = label.toLowerCase() === 'semester' ? 'semester' : label.toLowerCase() as keyof typeof userDetails;
                        const isDisabled = label === 'Semester';
                        
                        return (
                          <div key={label} className="flex justify-between items-end group border-b border-slate-800 pb-1">
                            <span className="text-xl font-black text-slate-400">{label}:</span>
                            <div className="relative w-36">
                              <select 
                                value={userDetails[key]} 
                                onChange={(e) => updateProfile({ [label.toLowerCase() === 'semester' ? 'semester' : label.toLowerCase()]: e.target.value })} 
                                disabled={isDisabled} 
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
                                     {['Hostel A', 'Hostel B', 'Hostel C', 'Hostel D', 'Hostel E', 'Hostel F', 'Hostel G', 'Hostel H', 'Hostel I', 'Hostel J', 'Hostel K', 'Hostel L', 'Hostel M', 'Hostel N', 'Hostel O', 'Hostel Q', 'Day Scholar'].map(h => <option key={h} value={h} className="bg-slate-900 text-white font-caveat text-xl">{h}</option>)}
                                   </>
                                 )}
                              </select>
                            </div>
                            {isDisabled && <Lock size={12} className="text-slate-500 absolute right-6 mb-2" />}
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