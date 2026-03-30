import { cn } from "../lib/utils"
import axios from 'axios';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Wallet, BookOpen, ShoppingBag, Settings, Pin } from 'lucide-react';

const API_HOST = (import.meta as any).env.VITE_API_URL || 'http://localhost:8000';

export default function Dashboard({ navigateTo }: { navigateTo: (tab: string) => void }) {  
  const token = localStorage.getItem('cf_token'); 
  
  const [activeNav, setActiveNav] = useState('home');
  const [currentNoticeIndex, setCurrentNoticeIndex] = useState(0);
  
  const [userData, setUserData] = useState<any>({ role: '', batch: '', hostel: '' });
  const [fresherConfig, setFresherConfig] = useState({ batches: [], hostels: [] });

  const [financeData, setFinanceData] = useState({ ideal_month_avg: 0, percentage: 0 });
  const [isLoadingFinance, setIsLoadingFinance] = useState(true);
  
  const [nextClassInfo, setNextClassInfo] = useState({
    name: 'Loading...', time: '', location: '', isFree: false
  });

  const userName = localStorage.getItem('cf_name')?.split(' ')[0] || 'Student';

  useEffect(() => {
    let cachedTimetable: any = null;

    const fetchAllData = async () => {
      if (!token) return;

      try {
        const profileRes = await axios.get(`${API_HOST}/auth/me?token=${token}`);
        setUserData({ role: profileRes.data.role, batch: profileRes.data.batch, hostel: profileRes.data.hostel });
        
        const confRes = await axios.get(`${API_HOST}/auth/config/freshers`);
        setFresherConfig(confRes.data);
      } catch (e) { }

      try {
        const today = new Date();
        const currentUserId = parseInt(JSON.parse(atob(token.split('.')[1])).sub) || 1; 
        const url = `${API_HOST}/finance/summary/${currentUserId}?month=${today.getMonth() + 1}&year=${today.getFullYear()}`;
        const financeRes = await axios.get(url);
        
        setFinanceData({
          ideal_month_avg: financeRes.data.ideal_month_avg,
          percentage: financeRes.data.daily_percentage
        });
      } catch (error) {
        console.error("Finance backend connection failed.");
      } finally {
        setIsLoadingFinance(false);
      }

      try {
        if (!cachedTimetable) {
          const timeRes = await axios.get(`${API_HOST}/daily/timetable?token=${token}`);
          cachedTimetable = timeRes.data;
        }
        calculateNextClass(cachedTimetable);
      } catch (error: any) {
        if (error.response?.status === 404) {
          setNextClassInfo({ name: 'Sync Needed', time: 'Go to Daily Tab', location: 'Acad Vault', isFree: true });
        } else {
          setNextClassInfo({ name: 'Offline', time: '', location: '', isFree: true });
        }
      }
    };

    const calculateNextClass = (schedule: any[]) => {
      if (!schedule || schedule.length === 0) return;
      
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const now = new Date();
      const currentDay = days[now.getDay()];
      const currentMins = now.getHours() * 60 + now.getMinutes();

      const todaySchedule = schedule.find((d: any) => d.day === currentDay);

      if (!todaySchedule || !todaySchedule.classes || todaySchedule.classes.length === 0) {
         setNextClassInfo({ 
           name: currentDay === 'Saturday' || currentDay === 'Sunday' ? 'Weekend Vibe' : 'Free Day!', 
           time: 'No classes today', 
           location: 'Chill Out', 
           isFree: true 
         });
         return;
      }

      const parseTime = (timeStr: string) => {
         const parts = timeStr.trim().split(' ');
         if (parts.length < 2) return 0;
         let [h, m] = parts[0].split(':').map(Number);
         const period = parts[1].toUpperCase();
         if (period === 'PM' && h !== 12) h += 12;
         if (period === 'AM' && h === 12) h = 0;
         return h * 60 + (m || 0);
      };

      for (const cls of todaySchedule.classes) {
         const times = (cls.time || cls.start_time || "").split('-');
         const startMins = parseTime(times[0]);
         const endMins = times.length > 1 ? parseTime(times[1]) : startMins + 50;

         if (endMins > currentMins) {
            const isCurrent = currentMins >= startMins && currentMins <= endMins;
            setNextClassInfo({
               name: cls.name,
               time: isCurrent ? `Ongoing (${times[0].trim()})` : times[0].trim(),
               location: cls.venue,
               isFree: false
            });
            return;
         }
      }

      setNextClassInfo({ name: 'Done for the day!', time: 'Classes over', location: 'Go Rest', isFree: true });
    };

    fetchAllData();
    const interval = setInterval(fetchAllData, 60000);
    return () => clearInterval(interval);
  }, []);

  const notices = [
    {
      id: 1,
      title: 'New Bazaar Feature',
      description: 'Coming Soon!!',
    }  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentNoticeIndex((prev) => (prev + 1) % notices.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [notices.length]);

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, type: 'spring', stiffness: 100 } },
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
  };

  return (
    <div className="max-w-md mx-auto w-full min-h-[100dvh] relative overflow-x-hidden shadow-2xl border-x border-slate-700 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px] bg-slate-900 flex flex-col">
      
      <motion.div className="flex-1 overflow-y-auto px-4 pt-4 pb-28 flex flex-col z-10" variants={containerVariants} initial="hidden" animate="visible">
        
        {/* NEW FADED DASHBOARD GREETING */}
        <div className="flex justify-center pt-2 pb-6">
          <h2 className="text-2xl font-black text-slate-500/80 uppercase tracking-widest drop-shadow-sm text-center">
            Hi, {userName}!
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-10 tour-home-widgets">
          
          <motion.div
            onClick={() => navigateTo('daily')}
            variants={itemVariants}
            className="cursor-pointer outline-none focus:outline-none select-none [-webkit-tap-highlight-color:transparent]"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
          >
            <div 
              className={`${nextClassInfo.isFree ? 'bg-green-200' : 'bg-yellow-200'} text-slate-900 rotate-[-4deg] p-4 shadow-md rounded-tl-md rounded-tr-sm relative h-full flex flex-col justify-center transition-colors duration-500`}
              style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%)' }}
            >
              <h3 className="text-lg font-bold mb-1 opacity-80">{nextClassInfo.isFree ? 'Status' : 'Next Class'}</h3>
              
              <div className="mb-3">
                <p className={`font-black leading-tight ${nextClassInfo.name.length > 15 ? 'text-lg' : 'text-xl'}`}>
                  {nextClassInfo.name}
                </p>
                <p className="text-sm font-bold opacity-80 mt-1">{nextClassInfo.time}</p>
              </div>
              
              <p className="text-lg font-extrabold text-slate-800">{nextClassInfo.location}</p>
              
              <div className={`absolute bottom-0 right-0 w-10 h-10 ${nextClassInfo.isFree ? 'bg-green-400' : 'bg-yellow-400'} transition-colors duration-500`} style={{
                clipPath: 'polygon(100% 0, 0 100%, 100% 100%)',
                boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.15)',
              }} />
            </div>
          </motion.div>

          <motion.div
            onClick={() => navigateTo('vault')}
            variants={itemVariants}
            className="cursor-pointer outline-none focus:outline-none select-none [-webkit-tap-highlight-color:transparent]"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="bg-slate-800/90 p-4 h-full flex flex-col justify-center rounded-sm border border-slate-700">
              <h3 className="text-lg font-bold text-slate-200 mb-3 opacity-90">Survival Rate</h3>
              
              <div className="flex items-center gap-1 mb-3">
                <div className="flex items-center flex-1">
                  <div className="border-[3px] border-slate-400 h-8 flex-1 relative overflow-hidden" style={{
                    borderRadius: '4px 0 0 4px', borderRight: 'none',
                  }}>
                    <div 
                      className="h-full transition-all duration-1000 ease-out"
                      style={{ 
                        width: `${isLoadingFinance ? 0 : Math.max(0, Math.min(100, financeData.percentage))}%`,
                        backgroundImage: `repeating-linear-gradient(45deg, 
                          hsl(${Math.max(0, Math.min(120, financeData.percentage * 1.2))}, 80%, 45%), 
                          hsl(${Math.max(0, Math.min(120, financeData.percentage * 1.2))}, 80%, 45%) 2px, 
                          transparent 2px, transparent 4px)`
                      }}
                    />
                  </div>
                  <div className="w-2 h-6 bg-slate-400 ml-0.5" style={{ borderRadius: '0 3px 4px 0' }} />
                </div>
              </div>

              <div className="flex justify-between items-end">
                <span className="text-2xl font-bold text-slate-100 tracking-wide">
                  {isLoadingFinance ? "₹..." : `₹${Math.floor(financeData.ideal_month_avg)}`}
                  <span className="text-sm opacity-70">/day</span>
                </span>
                <span 
                  className="text-xl font-bold"
                  style={{ color: `hsl(${Math.max(0, Math.min(120, financeData.percentage * 1.2))}, 80%, 55%)` }}
                >
                  {isLoadingFinance ? "...%" : `${Math.round(financeData.percentage)}%`}
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          variants={itemVariants}
          className="cursor-pointer relative flex-grow flex flex-col outline-none focus:outline-none select-none [-webkit-tap-highlight-color:transparent] mb-6"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.99 }}
        >
          <div className="bg-slate-100 text-slate-900 rotate-[2deg] p-8 relative flex-grow flex flex-col border-none ring-0 overflow-hidden shadow-xl min-h-[300px]">
            <div className="absolute inset-0 opacity-[0.15] pointer-events-none" style={{
              backgroundImage: `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" /></filter><rect width="100" height="100" fill="%23000" filter="url(%23noise)" opacity="0.05"/></svg>')`,
              backgroundSize: '200px 200px',
            }} />

            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-50">
              <Pin size={36} className="fill-red-500 text-red-600 drop-shadow-md stroke-1" />
            </div>

            <AnimatePresence mode="wait">
              <motion.div 
                key={currentNoticeIndex}
                className="pt-6 flex-grow flex flex-col relative z-10"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.4 }}
              >
                <p className="text-3xl font-extrabold mb-4 text-slate-900 leading-tight">
                  {notices[currentNoticeIndex].title}
                </p>
                <p className="text-xl text-slate-800 font-medium leading-snug">
                  {notices[currentNoticeIndex].description}
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="absolute bottom-6 left-0 w-full flex justify-center gap-2 z-10">
              {notices.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`w-2.5 h-2.5 rounded-full ${idx === currentNoticeIndex ? 'bg-slate-800' : 'bg-slate-300'}`}
                  style={{ transform: `rotate(${Math.random() * 45}deg)` }} 
                />
              ))}
            </div>

            <svg 
              className="absolute top-full left-0 w-full h-5 -mt-[2px]" 
              viewBox="0 0 400 16" 
              preserveAspectRatio="none"
              style={{ filter: 'drop-shadow(0px 4px 2px rgba(0,0,0,0.3))' }}
            >
              <defs>
                <filter id="roughEdge">
                  <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" result="noise" />
                  <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" />
                </filter>
              </defs>
              <path 
                d="M 0,3 Q 8,0 15,2 T 30,3 Q 38,1 45,4 T 60,2 Q 68,0 75,3 T 90,2 Q 98,1 105,4 T 120,2 Q 128,0 135,3 T 150,2 Q 158,1 165,4 T 180,2 Q 188,0 195,3 T 210,2 Q 218,1 225,4 T 240,2 Q 248,0 255,3 T 270,2 Q 278,1 285,4 T 300,2 Q 308,0 315,3 T 330,2 Q 338,1 345,4 T 360,2 Q 368,0 375,3 T 390,2 Q 396,1 400,3 L 400,16 L 0,16 Z" 
                fill="rgb(241, 245, 250)"
                filter="url(#roughEdge)"
              />
            </svg>
          </div>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {userData.role === 'guest' && (!userData.batch || userData.batch === '') && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4">
            <div className="bg-slate-900 border-2 border-blue-500 rounded-2xl p-6 w-full max-w-sm shadow-[0_0_30px_rgba(59,130,246,0.2)]">
              <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-2">Welcome to CampusFLOW</h2>
              <p className="text-sm text-slate-400 font-sans mb-6">Since you logged in with a personal email, you're in Guest Mode. Tell us where you belong.</p>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Temporary Batch</label>
                  <select 
                    onChange={(e) => setUserData({...userData, batch: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white font-bold mt-1"
                  >
                    <option value="">Select Batch...</option>
                    <option value="Unassigned">Not Allotted Yet</option>
                    {fresherConfig.batches.map((b: string) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Temporary Hostel</label>
                  <select 
                    onChange={(e) => setUserData({...userData, hostel: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white font-bold mt-1"
                  >
                    <option value="">Select Hostel...</option>
                    <option value="Unassigned">Not Allotted Yet</option>
                    {fresherConfig.hostels.map((h: string) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
              
              <button 
                onClick={async () => {
                  if(!userData.batch || !userData.hostel) return alert("Please select an option for both.");
                  try {
                    await axios.put(`${API_HOST}/auth/me?token=${token}`, { batch: userData.batch, hostel: userData.hostel });
                    window.location.reload(); 
                  } catch (e) { alert("Failed to save. Try again."); }
                }}
                className="w-full py-3 bg-blue-600 text-white font-black tracking-widest uppercase rounded-xl hover:bg-blue-500"
              >
                Enter Sandbox
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}