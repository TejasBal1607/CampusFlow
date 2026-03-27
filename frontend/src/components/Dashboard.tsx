import { cn } from "../lib/utils"
import axios from 'axios';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Wallet, BookOpen, ShoppingBag, Settings, Pin } from 'lucide-react';

export default function Dashboard({ navigateTo }: { navigateTo: (tab: string) => void }) {  const [activeNav, setActiveNav] = useState('home');
  const [currentNoticeIndex, setCurrentNoticeIndex] = useState(0);
  // --- REAL BACKEND CONNECTION ---
  // Default fallback data while loading
  const [financeData, setFinanceData] = useState({ ideal_month_avg: 0, percentage: 0 });
  const [isLoadingFinance, setIsLoadingFinance] = useState(true);

  useEffect(() => {
    // 1. Define the fetch function
    const fetchFinanceData = async () => {
      try {
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();
        const token = localStorage.getItem('cf_token');
        const currentUserId = token ? parseInt(JSON.parse(atob(token.split('.')[1])).sub) : 1; 
        
        // Using your updated path format: /summary/{currentUserId}
        const url = `http://localhost:8000/finance/summary/${currentUserId}?month=${currentMonth}&year=${currentYear}`;
        
        const response = await axios.get(url);
        
        setFinanceData({
          ideal_month_avg: response.data.ideal_month_avg,
          percentage: response.data.daily_percentage
        });
      } catch (error) {
        console.error("Backend connection failed.", error);
        // Optional: Keep existing data on failure instead of resetting to fallback
      } finally {
        setIsLoadingFinance(false);
      }
    };

    // 2. Initial trigger
    fetchFinanceData();

    // 3. Set the 10-second heartbeat
    const interval = setInterval(fetchFinanceData, 60000);

    // 4. Cleanup on unmount
    return () => clearInterval(interval);
  }, []);

  // Current class data structure
  const currentClass = {
    name: 'Physics',
    time: '1:00 PM',
    location: 'LP-103',
    professor: 'Dr. Sharma',
  };

  // Notices array for slideshow
  const notices = [
    {
      id: 1,
      title: 'Sat Hack 2026 Registration Open!',
      description: 'Join the biggest hackathon of the year. Register now and build something extraordinary with your team!',
    },
    {
      id: 2,
      title: 'Campus Fest Planning Meeting',
      description: 'All student leaders are invited to the planning meeting on Friday at 3 PM in the Auditorium Hall.',
    },
    {
      id: 3,
      title: 'Bhvya ki maths mein back',
      description: 'At this point she has started a collection. Not even a news',
    },
  ];

  // Cycle through notices every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentNoticeIndex((prev) => (prev + 1) % notices.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [notices.length]);

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        type: 'spring',
        stiffness: 100,
      },
    },
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.15,
      },
    },
  };

  return (
    <div 
      className="max-w-md mx-auto w-full h-[100dvh] relative overflow-hidden shadow-2xl border-x border-slate-700 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px] bg-slate-900 flex flex-col"
    >
      
      {/* --- THE MEAT: Scrollable Main Content --- */}
      <motion.div
        className="flex-1 overflow-y-auto px-4 pt-6 pb-28 flex flex-col z-10"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Top Grid: 2 Columns */}
        <div className="grid grid-cols-2 gap-4 mb-10">
          
          {/* Academics - Sticky Note */}
          <motion.div
            variants={itemVariants}
            className="cursor-pointer outline-none focus:outline-none select-none [-webkit-tap-highlight-color:transparent]"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
          >
            <div 
              className="bg-yellow-200 text-slate-900 rotate-[-4deg] p-4 shadow-md rounded-tl-md rounded-tr-sm relative h-full flex flex-col justify-center"
              style={{
                clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%)',
              }}
            >
              <h3 className="text-lg font-bold mb-1 opacity-80">Next Class</h3>
              <p className="text-lg font-bold leading-tight mb-4">
                {currentClass.name} <br/>
                <span className="text-base font-semibold opacity-90">{currentClass.time}</span>
              </p>
              <p className="text-lg font-extrabold text-slate-800">{currentClass.location}</p>
              
              {/* Inward-pointing folded corner */}
              <div className="absolute bottom-0 right-0 w-10 h-10 bg-yellow-400" style={{
                clipPath: 'polygon(100% 0, 0 100%, 100% 100%)',
                boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.15)',
              }} />
            </div>
          </motion.div>

          {/* Finance - Battery */}
          <motion.div
            onClick={() => navigateTo('vault')} // <-- ADD THIS LINE
            variants={itemVariants}
            className="cursor-pointer outline-none focus:outline-none select-none [-webkit-tap-highlight-color:transparent]"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="bg-slate-800/90 p-4 h-full flex flex-col justify-center rounded-sm border border-slate-700">
              <h3 className="text-lg font-bold text-slate-200 mb-3 opacity-90">Survival Rate</h3>
              
              {/* Battery Graphic */}
              <div className="flex items-center gap-1 mb-3">
                <div className="flex items-center flex-1">
                  <div className="border-[3px] border-slate-400 h-8 flex-1 relative overflow-hidden" style={{
                    borderRadius: '4px 0 0 4px',
                    borderRight: 'none',
                  }}>
                    {/* --- DYNAMIC COLOR BAR --- */}
                    <div 
                      className="h-full transition-all duration-1000 ease-out"
                      style={{ 
                        width: `${isLoadingFinance ? 0 : Math.max(0, Math.min(100, financeData.percentage))}%`,
                        // We calculate the color dynamically based on the percentage
                        backgroundImage: `repeating-linear-gradient(45deg, 
                          hsl(${Math.max(0, Math.min(120, financeData.percentage * 1.2))}, 80%, 45%), 
                          hsl(${Math.max(0, Math.min(120, financeData.percentage * 1.2))}, 80%, 45%) 2px, 
                          transparent 2px, transparent 4px)`
                      }}
                    />
                  </div>
                  <div className="w-2 h-6 bg-slate-400 ml-0.5" style={{
                    borderRadius: '0 3px 4px 0',
                  }} />
                </div>
              </div>

              <div className="flex justify-between items-end">
                <span className="text-2xl font-bold text-slate-100 tracking-wide">
                  {isLoadingFinance ? "₹..." : `₹${Math.floor(financeData.ideal_month_avg)}`}
                  <span className="text-sm opacity-70">/day</span>
                </span>
                {/* --- DYNAMIC PERCENTAGE TEXT COLOR --- */}
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

        {/* Announcements - Pinned Paper */}
        <motion.div
          variants={itemVariants}
          className="cursor-pointer relative flex-grow flex flex-col outline-none focus:outline-none select-none [-webkit-tap-highlight-color:transparent] mb-6"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.99 }}
        >
          <div className="bg-slate-100 text-slate-900 rotate-[2deg] p-8 relative flex-grow flex flex-col border-none ring-0 overflow-hidden shadow-xl min-h-[300px]">
            {/* Paper grain texture overlay */}
            <div className="absolute inset-0 opacity-[0.15] pointer-events-none" style={{
              backgroundImage: `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" /></filter><rect width="100" height="100" fill="%23000" filter="url(%23noise)" opacity="0.05"/></svg>')`,
              backgroundSize: '200px 200px',
            }} />

            {/* Pin icon at top center */}
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-50">
              <Pin 
                size={36} 
                className="fill-red-500 text-red-600 drop-shadow-md stroke-1"
              />
            </div>

            <AnimatePresence mode="wait">
              <motion.div 
                key={currentNoticeIndex}
                className="pt-6 flex-grow flex flex-col relative z-10"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4 }}
              >
                <p className="text-3xl font-extrabold mb-4 text-slate-900 leading-tight">
                  {notices[currentNoticeIndex].title}
                </p>
                <p className="text-xl text-slate-800 font-medium leading-snug">
                  {notices[currentNoticeIndex].description}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Indicator Dots */}
            <div className="absolute bottom-6 left-0 w-full flex justify-center gap-2 z-10">
              {notices.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`w-2.5 h-2.5 rounded-full ${idx === currentNoticeIndex ? 'bg-slate-800' : 'bg-slate-300'}`}
                  style={{ transform: `rotate(${Math.random() * 45}deg)` }} // Slight rough hand-drawn rotation
                />
              ))}
            </div>

            {/* High-fidelity torn edge */}
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

      
    </div>
  );
}
