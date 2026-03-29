import axios from 'axios';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';

// --- ADDED THIS LINE ---
const API_HOST = (import.meta as any).env.VITE_API_URL || 'http://localhost:8000';

export default function Auth({ onLoginSuccess }: { onLoginSuccess: (token: string, userId: number, name: string) => void }) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setIsLoading(true);
    setErrorMsg('');
    
    try {
      // --- UPDATED TO USE API_HOST ---
      const res = await axios.post(`${API_HOST}/auth/google`, {
        token: credentialResponse.credential
      });
      
      
      onLoginSuccess(res.data.access_token, res.data.user_id, res.data.name);
    } catch (error: any) {
      setErrorMsg(error.response?.data?.detail || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = () => {
    setErrorMsg('Google Sign-In failed. Please try again.');
  };

  // Custom SVG: Sketched stickman with notebook battling wind
  const StickmanWithNotebook = () => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" className="w-16 h-16 mb-4">
        {/* Wind lines */}
        <path d="M1 8h6M0 12h5M2 16h4" className="stroke-slate-500" strokeWidth="1.5" strokeDasharray="2 2" />
        {/* Stickman */}
        <g className="stroke-blue-400" strokeWidth="2.5">
          <circle cx="16" cy="5" r="2.5" />
          <path d="M16 7.5L13 14" />
          <path d="M14 11L11 10L9 12" />
          <path d="M14 11L17 12L19 9" />
          <path d="M13 14L10 17L7 17" />
          <path d="M13 14L16 18L15 22" />
        </g>
      </svg>
  );

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 relative text-slate-100 font-caveat bg-slate-950 overflow-hidden">
      
      {/* ========================================== */}
      {/* CLUTTERED DESK BACKGROUND DIORAMA          */}
      {/* ========================================== */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-100">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.05)_1px,transparent_1px)] bg-[size:30px_30px]" />
        <div className="absolute -top-12 -left-12 w-64 h-64 rounded-full border-[12px] border-[#1f120f] blur-[1px] transform scale-y-90 rotate-12 opacity-100" />
        <div className="absolute top-4 -left-8 w-40 h-40 rounded-full border-[6px] border-[#2e1a15] blur-[0.5px] transform scale-y-90 rotate-[25deg] opacity-100" />
        <div className="absolute -bottom-16 -right-16 w-56 h-56 rounded-full border-[10px] border-[#1f120f] blur-[1px] transform scale-y-[0.85] -rotate-12 opacity-100" />

        <svg className="absolute -bottom-5 -right-10 w-64 h-64 text-slate-700/80 -rotate-12 opacity-100" viewBox="0 0 100 100" stroke="currentColor" fill="none" strokeWidth="1.5">
          <rect x="20" y="20" width="60" height="60" rx="4" />
          <line x1="20" y1="40" x2="10" y2="40" />
          <line x1="20" y1="60" x2="10" y2="60" />
          <line x1="80" y1="50" x2="90" y2="50" />
          <circle cx="50" cy="50" r="15" />
          <circle cx="50" cy="50" r="10" />
          <text x="35" y="15" fontSize="8" className="fill-slate-700/80 font-sans font-bold">ARM_CTRL_v2</text>
        </svg>

        <svg className="absolute bottom-5 -left-8 w-28 h-28 text-slate-800 drop-shadow-2xl opacity-100 rotate-45" viewBox="0 0 100 100" fill="currentColor">
          <path d="M 20 50 Q 10 20 40 10 Q 70 0 80 30 Q 95 60 70 80 Q 40 100 20 80 Z" />
          <path d="M 30 40 Q 50 20 60 50" stroke="#020617" strokeWidth="3" fill="none"/>
        </svg>

        <div className="absolute inset-0 z-0 flex justify-center pointer-events-none">
          <svg className="w-full h-full" preserveAspectRatio="xMidYMin slice">
            <path d="M -50 -50 C 200 100, -100 300, calc(50% - 5px) 210" fill="none" stroke="#020617" strokeWidth="18" strokeLinecap="round" className="drop-shadow-2xl opacity-80" />
            <path d="M -50 -50 C 200 100, -100 300, calc(50% - 5px) 210" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeDasharray="6 4" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      <div style={{ perspective: 2000 }} className="relative z-20 w-full max-w-[320px] mx-auto mt-16 mb-10">
        
        {/* Metal Connector */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-5 h-8 bg-slate-400 rounded-sm shadow-xl z-30 flex items-center justify-center border-2 border-slate-800">
          <div className="w-2 h-4 border-2 border-slate-900 rounded-full opacity-50" />
        </div>

        <motion.div
          className="w-full relative min-h-[460px] bg-slate-900/60 backdrop-blur-md border border-slate-600/50 p-6 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col"
          initial={{ y: -50, opacity: 0, rotateX: 10 }}
          animate={{ y: 0, opacity: 1, rotateX: 0 }}
          transition={{ duration: 0.8, type: 'spring' }}
        >
          {/* ID Card Hole Punch */}
          <div className="w-12 h-2.5 bg-slate-950/80 rounded-full border border-slate-700/50 mx-auto mb-6 shadow-inner" />
          <div className="absolute inset-0 bg-[linear-gradient(transparent_27px,rgba(255,255,255,0.05)_28px)] bg-[size:100%_28px] pointer-events-none rounded-xl" />

          {/* Header */}
          <div className="flex flex-col items-center text-center mb-10 relative z-10">
            <StickmanWithNotebook />
            <h1 className="text-4xl font-black tracking-tight text-slate-100 mt-2">
              Campus<span className="text-blue-500">FLOW</span>
            </h1>
            <p className="text-xs text-slate-400 font-sans font-bold tracking-widest uppercase mt-2 border-b border-slate-700/50 pb-2 w-full">
              Your College Survival Companion
            </p>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center relative z-10 space-y-6 w-full">
            
            {isLoading ? (
               <div className="flex flex-col items-center gap-3">
                 <Loader2 className="animate-spin text-blue-500" size={40} />
                 <p className="text-lg font-bold text-slate-400 tracking-wider uppercase">Authenticating...</p>
               </div>
            ) : (
              <>
                <div className="w-full px-2 flex justify-center">
                  {/* The official Google Login Button */}
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    useOneTap
                    theme="filled_black"
                    shape="pill"
                    text="continue_with"
                  />
                </div>
                <p className="text-center font-sans font-bold text-slate-500 text-xs px-4">
                  Please use your official <span className="text-blue-400">@thapar.edu</span> ID to access the campus grid.
                </p>
              </>
            )}

            {errorMsg && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="w-full mt-4 bg-red-950/50 border border-red-500/50 rounded-md p-3 flex gap-2 items-start"
              >
                <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />
                <p className="text-sm font-sans font-bold text-red-200">{errorMsg}</p>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}