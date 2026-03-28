import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, MapPin, Camera, Radio, FolderOpen, X, Search, Plus, CheckCircle2, XCircle, Slash, ChevronDown, ChevronRight, FileText, User, RotateCcw, Trash2 } from 'lucide-react';

// ==========================================
// 1. THE TYPE CONTRACT (Fixes the TS Error)
// ==========================================
interface ClassSession {
  id: number;
  name: string;
  faculty: string;
  time: string;
  venue: string;
  type: 'Lecture' | 'Lab' | 'Tutorial';
  status: 'past' | 'active' | 'future';
  attendance: 'attended' | 'bunked' | 'cancelled' | null;
  endsIn?: string; // The '?' makes it optional!
}

export default function Daily() {
  const [showArchives, setShowArchives] = useState(false);
  const [showCameraMode, setShowCameraMode] = useState(false);
  const [showAddComm, setShowAddComm] = useState(false);
  
  // Mock Role-Based Access Control (Change to 'cr' or 'faculty' to see the POST button)
  const userRole: 'student' | 'cr' | 'faculty' = 'student'; 
  const userHostel = 'Hostel J';
  const userBatch = '1A84';

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'streams': true,
    'coe': true
  });

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  // ==========================================
  // STATE DATA
  // ==========================================
  const [todayClasses, setTodayClasses] = useState<ClassSession[]>([
    { id: 1, name: 'Data Structures', faculty: 'Dr. Neeraj', time: '08:50 AM - 10:30 AM', venue: 'LP-104', type: 'Lecture', status: 'past', attendance: 'attended' },
    { id: 2, name: 'Comp. Architecture', faculty: 'Dr. Sharma', time: '10:30 AM - 11:20 AM', venue: 'LP-102', type: 'Tutorial', status: 'past', attendance: 'bunked' },
    { id: 3, name: 'Physics Labs', faculty: 'Mr. Verma', time: '01:00 PM - 03:30 PM', venue: 'L-Block', type: 'Lab', status: 'active', endsIn: '14m', attendance: null },
    { id: 4, name: 'Math III', faculty: 'Dr. Kaur', time: '03:30 PM - 04:20 PM', venue: 'LP-105', type: 'Lecture', status: 'future', attendance: null },
  ]);

  // Custom Bunk Meter State
  const [bunkMeter, setBunkMeter] = useState([
    { id: 1, subject: 'Data Structures', attended: 28, total: 32, safe: 4 }, 
    { id: 2, subject: 'Math III', attended: 22, total: 30, safe: 0 }, 
  ]);
  const [showAddSubject, setShowAddSubject] = useState(false);

  const commsRadar = [
    { id: 1, tag: 'ADMIN', text: 'Hostel fee payment portal is currently down for maintenance.', time: '1h ago', urgent: true },
    { id: 2, tag: 'ACAD', text: 'Dr. Sharma cancelled the 4:30 PM extra class for batch 1A84.', time: '3h ago', urgent: false },
    { id: 3, tag: 'HOSTEL J', text: 'Water supply in B-wing will be cut from 2 PM to 4 PM.', time: '5h ago', urgent: false },
  ];

  // ==========================================
  // LOGIC HELPERS
  // ==========================================
  const getTypeColor = (type: string) => {
    if (type === 'Lecture') return 'bg-green-500 text-white border-green-600';
    if (type === 'Lab') return 'bg-yellow-400 text-slate-900 border-yellow-500';
    if (type === 'Tutorial') return 'bg-purple-500 text-white border-purple-600';
    return 'bg-slate-500 text-white border-slate-600';
  };

  const handleMarkAttendance = (id: number, status: 'attended' | 'bunked' | 'cancelled' | null) => {
    setTodayClasses(classes => classes.map(c => c.id === id ? { ...c, attendance: status } : c));
  };

  const removeBunkSubject = (id: number) => {
    setBunkMeter(prev => prev.filter(sub => sub.id !== id));
  };

  const addBunkSubject = (name: string) => {
    setBunkMeter(prev => [...prev, { id: Date.now(), subject: name, attended: 0, total: 0, safe: 0 }]);
    setShowAddSubject(false);
  };

  // ==========================================
  // RENDER HELPERS
  // ==========================================
  const renderClassTracker = () => (
    <div className="mb-6 mt-4">
      {/* COMPRESSED HEADER (Changes #1, #3, #4) */}
      <div className="flex items-center justify-between mb-4 border-b-2 border-slate-800 pb-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-2xl font-black uppercase tracking-wider text-slate-100 whitespace-nowrap">Class Tracker</h2>
          <span className="text-xs font-black text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded-sm border border-slate-700">{userBatch}</span>
        </div>
        <div className="text-right flex items-baseline gap-2">
          <span className="text-xl font-black text-blue-400 font-caveat">{(new Date()).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</span>
          <span className="text-sm font-bold text-slate-400 font-caveat tracking-widest uppercase">{(new Date()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        </div>
      </div>
      
      {/* Horizontal Scroll Container */}
      <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4 -mx-4 px-4 snap-x">
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
                <h3 className={`text-xl font-black mb-1 truncate ${isActive ? 'text-slate-100' : isPast ? 'text-slate-400' : 'text-slate-300'}`}>{cls.name}</h3>
                <div className="flex items-center gap-2 text-sm font-bold text-slate-500 font-sans mb-1">
                  <User size={14} /> <span className="truncate">{cls.faculty}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                   <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 font-sans">
                     <Clock size={12} /> {cls.time.split(' - ')[0]}
                   </div>
                   <div className={`flex items-center gap-1.5 font-black text-sm ${isActive ? 'text-blue-400' : 'text-slate-400'}`}>
                     <MapPin size={14} /> {cls.venue}
                   </div>
                </div>
              </div>

              {/* ACTION BUTTONS & RESET (Change #2) */}
              {(isPast || isActive) && (
                <div className="mt-2 pt-3 border-t border-slate-800 flex gap-2">
                  {cls.attendance ? (
                    <button 
                      onClick={() => handleMarkAttendance(cls.id, null)}
                      className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-sm text-xs font-black uppercase tracking-wider hover:opacity-80 transition-opacity
                      ${cls.attendance === 'attended' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 
                        cls.attendance === 'bunked' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
                        'bg-slate-500/20 text-slate-400 border border-slate-500/30'}`}
                      title="Click to reset status"
                    >
                      {cls.attendance === 'attended' && <CheckCircle2 size={14} />}
                      {cls.attendance === 'bunked' && <XCircle size={14} />}
                      {cls.attendance === 'cancelled' && <Slash size={14} />}
                      {cls.attendance}
                      <RotateCcw size={12} className="ml-1 opacity-50" />
                    </button>
                  ) : (
                    <>
                      <button onClick={() => handleMarkAttendance(cls.id, 'attended')} className="flex-1 text-[10px] font-black tracking-widest py-2 bg-slate-800 text-slate-300 rounded-sm hover:bg-green-500 hover:text-white transition-colors">ATTEND</button>
                      <button onClick={() => handleMarkAttendance(cls.id, 'bunked')} className="flex-1 text-[10px] font-black tracking-widest py-2 bg-slate-800 text-slate-300 rounded-sm hover:bg-red-500 hover:text-white transition-colors">BUNK</button>
                      <button onClick={() => handleMarkAttendance(cls.id, 'cancelled')} className="flex-1 text-[10px] font-black tracking-widest py-2 bg-slate-800 text-slate-300 rounded-sm hover:bg-slate-600 transition-colors">CANCEL</button>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );

  const renderGrid = () => (
    <div className="grid grid-cols-2 gap-4 mb-6">
      {/* Polaroid Mess Menu */}
      <motion.div 
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setShowCameraMode(true)}
        className="bg-slate-100 p-2 pb-6 rounded-sm shadow-xl -rotate-2 relative cursor-pointer flex flex-col min-h-[160px]"
      >
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-3 bg-red-500/50 rotate-3 shadow-sm" /> 
        <div className="flex-1 bg-slate-900 w-full rounded-sm border border-slate-300 flex flex-col items-center justify-center gap-2 overflow-hidden relative">
          <Camera size={28} className="text-slate-600 mb-1" />
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest text-center px-2">Snap<br/>Menu</span>
        </div>
        <p className="text-center font-caveat font-black text-xl text-slate-800 mt-2 leading-none">{userHostel}</p>
      </motion.div>

      {/* Custom Bunk Meter (Change #3) */}
      <div className="bg-slate-900/80 border-2 border-slate-700 border-dashed rounded-xl p-3 flex flex-col relative">
        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-2 mb-3">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Bunk Meter</h3>
          <button onClick={() => setShowAddSubject(!showAddSubject)} className="text-slate-400 hover:text-blue-400"><Plus size={16}/></button>
        </div>

        {/* Add Track Dropdown */}
        {showAddSubject && (
          <div className="absolute top-10 right-2 left-2 bg-slate-800 border border-slate-600 rounded-md shadow-xl z-20 overflow-hidden font-sans">
            {todayClasses.filter(c => !bunkMeter.some(b => b.subject === c.name)).map(c => (
              <div key={c.id} onClick={() => addBunkSubject(c.name)} className="p-2 text-xs font-bold text-slate-300 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 last:border-0">
                + Track {c.name}
              </div>
            ))}
            <div onClick={() => setShowAddSubject(false)} className="p-2 text-xs text-center text-slate-500 cursor-pointer bg-slate-900">Cancel</div>
          </div>
        )}

        <div className="flex-1 flex flex-col justify-start gap-3 overflow-y-auto hide-scrollbar max-h-[120px]">
          {bunkMeter.length === 0 ? (
            <p className="text-xs text-slate-500 font-sans text-center mt-4">Click + to track subjects</p>
          ) : (
            bunkMeter.map((sub) => {
              const isDanger = sub.safe <= 0;
              const pct = sub.total === 0 ? 100 : Math.round((sub.attended / sub.total) * 100);
              return (
                <div key={sub.id} className="w-full group">
                  <div className="flex justify-between items-end mb-1 relative">
                    <span className="text-xs font-bold text-slate-300 truncate max-w-[70px] group-hover:opacity-0 transition-opacity">{sub.subject}</span>
                    <button onClick={() => removeBunkSubject(sub.id)} className="absolute left-0 top-0 opacity-0 group-hover:opacity-100 text-red-500 transition-opacity"><Trash2 size={12}/></button>
                    
                    <span className={`text-[10px] font-black ${isDanger && sub.total > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {sub.total === 0 ? 'No Data' : isDanger ? 'DANGER' : `${sub.safe} safe`}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${isDanger && sub.total > 0 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
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
          {/* Subtitle for Filtering (Change #4) */}
          <p className="text-[10px] font-bold text-slate-500 font-sans mt-0.5 uppercase tracking-wide">Secured to {userBatch} & {userHostel}</p>
        </div>
        
        {/* Role Based Access Control UI (Change #6) */}
        {userRole !== 'student' ? (
          <button onClick={() => setShowAddComm(true)} className="flex items-center gap-1 text-xs font-black text-slate-400 hover:text-purple-400 bg-slate-900 px-2 py-1 rounded-sm border border-slate-800 transition-colors">
            <Plus size={14} /> POST
          </button>
        ) : (
          <span className="text-[10px] font-bold text-slate-600 bg-slate-900 px-2 py-1 rounded-sm border border-slate-800" title="Only Faculty/CRs can post">READ-ONLY</span>
        )}
      </div>
      
      {/* Scrollable Comms Container */}
      <div className="bg-slate-900/60 border border-slate-700 rounded-xl overflow-hidden shadow-inner flex flex-col max-h-[220px]">
        <div className="overflow-y-auto hide-scrollbar flex-1">
          {commsRadar.map((msg, idx) => (
            <div key={msg.id} className={`p-4 ${idx !== commsRadar.length - 1 ? 'border-b border-slate-800/50' : ''}`}>
              <div className="flex justify-between items-center mb-1.5">
                <span className={`text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-sm ${msg.urgent ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 text-slate-400'}`}>
                  #{msg.tag}
                </span>
                <span className="text-xs font-bold text-slate-500 font-sans">{msg.time}</span>
              </div>
              <p className="text-sm text-slate-300 font-sans leading-relaxed">{msg.text}</p>
            </div>
          ))}
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

      {/* 1. ACAD VAULT MODAL */}
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

                {/* HIERARCHICAL FILE EXPLORER (Changes #5, #7) */}
                <div className="bg-slate-900 border-2 border-slate-800 rounded-xl p-3 font-sans space-y-1">
                  
                  {/* Streams Folder */}
                  <div>
                    <div onClick={() => toggleFolder('streams')} className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer py-2 px-2 hover:bg-slate-800/50 rounded-md transition-colors">
                      {expandedFolders['streams'] ? <ChevronDown size={18} className="text-purple-400" /> : <ChevronRight size={18} className="text-slate-500" />}
                      <FolderOpen size={18} className="text-purple-400" />
                      <span className="font-bold">Streams</span>
                    </div>
                    
                    {expandedFolders['streams'] && (
                      <div className="pl-6 border-l border-slate-700 ml-4 py-1 space-y-1">
                        
                        {/* COE Subfolder */}
                        <div>
                           <div onClick={() => toggleFolder('coe')} className="flex items-center gap-2 text-slate-400 hover:text-white cursor-pointer py-1.5 px-2 hover:bg-slate-800/50 rounded-md text-sm mt-1">
                            {expandedFolders['coe'] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <FolderOpen size={16} className="text-slate-500" /> Computer Engineering (COE)
                           </div>
                           {expandedFolders['coe'] && (
                             <div className="pl-6 border-l border-slate-700/50 ml-3 py-1 space-y-2">
                               {/* Scheme moved inside COE */}
                               <div className="flex items-center gap-2 text-slate-400 hover:text-white cursor-pointer py-1 px-2 hover:bg-slate-800/50 rounded-md text-sm">
                                 <FileText size={14} className="text-red-400"/> COE_Stream_Scheme.pdf
                               </div>
                               <div className="flex items-center gap-2 text-slate-500 hover:text-slate-300 cursor-pointer text-sm py-1"><FolderOpen size={14}/> Year 2</div>
                               
                               {/* Year 3 -> DSA (Demoing Path-derived Tags) */}
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
                                          {/* Mocking Path-derived Tags */}
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

                        {/* ENC Subfolder */}
                        <div className="flex items-center gap-2 text-slate-400 hover:text-white cursor-pointer py-1.5 px-2 hover:bg-slate-800/50 rounded-md text-sm">
                          <ChevronRight size={14} />
                          <FolderOpen size={16} className="text-slate-500" /> Electronics (ENC)
                        </div>

                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 2. Dummy Camera Upload Modal */}
      <AnimatePresence>
        {showCameraMode && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCameraMode(false)} className="fixed inset-0 bg-black/90 z-[80] flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={(e) => e.stopPropagation()} className="bg-slate-900 border-2 border-slate-700 rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl">
                <Camera size={48} className="mx-auto text-blue-500 mb-4" />
                <h3 className="text-2xl font-black mb-2 uppercase tracking-wide">Update Mess Menu</h3>
                <p className="text-slate-400 font-sans text-sm mb-6 font-bold leading-relaxed">Take a picture of the whiteboard. Your upload will be visible to everyone in {userHostel} until midnight.</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowCameraMode(false)} className="flex-1 py-3 font-bold border-2 border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800">Cancel</button>
                  <button onClick={() => setShowCameraMode(false)} className="flex-1 py-3 font-black bg-blue-600 text-white border-2 border-blue-500 rounded-lg flex items-center justify-center gap-2">Snap It</button>
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