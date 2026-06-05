import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Ticket, MessageCircle, MapPin, Heart, Info, Search, Plus, Loader2, X, Image as ImageIcon, Edit2, Trash2, Check, Film, Volume2, VolumeX, PlayCircle, Clock } from 'lucide-react';
import axios from 'axios';

const API_HOST = (import.meta as any).env.VITE_API_URL || 'http://localhost:8000';

const formatTimeAgo = (isoString: string) => {
  if (!isoString) return 'Just now';
  const diffMs = new Date().getTime() - new Date(isoString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHrs / 24);
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${diffDays}d ago`;
};

const isVideo = (url: string) => {
  if (!url) return false;
  if (url.startsWith('data:video/')) return true;
  const cleanUrl = url.split('?')[0]; 
  return cleanUrl.match(/\.(mp4|webm|mov|ogg)$/i) !== null;
};

// 🚀 THE DEDICATED REEL COMPONENT
const ReelItem = ({ event, currentUserId, toggleLike, likedEvents, isAdmin }: any) => {
  const [isMuted, setIsMuted] = useState(true);
  const [isEnded, setIsEnded] = useState(false);
  const [showInfo, setShowInfo] = useState(false); 
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null); // 🚀 NEW: Tracks visibility

  // 🚀 NEW: Intersection Observer (Pauses video when scrolled away)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!videoRef.current) return;

          // If the video is in view (at least 60% visible) and hasn't ended
          if (entry.isIntersecting) {
            if (!isEnded) {
              // .catch() prevents crash if browser blocks autoplay before interaction
              videoRef.current.play().catch(() => {}); 
            }
          } else {
            // Video is out of view -> FORCE PAUSE! (Fixes the audio bleeding bug)
            videoRef.current.pause();
          }
        });
      },
      { threshold: 0.6 } // 60% visibility threshold
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, [isEnded]);

  // React DOM Mute Override
  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    if (videoRef.current) {
      videoRef.current.muted = newMutedState; 
    }
  };

  const handleVideoTap = () => {
    if (!videoRef.current) return;
    if (isEnded) {
      videoRef.current.currentTime = 0; // Rewind to start
      videoRef.current.play();
      setIsEnded(false);
    } else {
      if (videoRef.current.paused) videoRef.current.play();
      else videoRef.current.pause();
    }
  };

  const handleDeleteEvent = async () => {
    if (!confirm("Admin: Are you sure you want to delete this event permanently?")) return;
    try {
      await axios.delete(`${API_HOST}/bazaar/events/${event.id}?user_id=${currentUserId}`);
      window.location.reload(); 
    } catch(e) { alert("Failed to delete."); }
  }

  return (
    <div ref={containerRef} className="relative w-full h-full snap-start bg-black overflow-hidden flex flex-col justify-end font-sans">
      {isVideo(event.poster_url) ? (
        <>
          {/* 🚀 REMOVED autoPlay attribute to let Intersection Observer handle it safely */}
          <video 
            ref={videoRef} 
            src={event.poster_url} 
            playsInline 
            muted={isMuted} 
            onEnded={() => setIsEnded(true)} 
            onClick={handleVideoTap} 
            className="absolute inset-0 w-full h-full object-cover cursor-pointer" 
          />
          <button onClick={toggleMute} className="absolute top-4 right-4 z-50 p-3 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-colors">
            {isMuted ? <VolumeX size={20}/> : <Volume2 size={20}/>}
          </button>
        </>
      ) : (
        <img src={event.poster_url} className="absolute inset-0 w-full h-full object-cover" />
      )}

      {isAdmin && (
        <button onClick={handleDeleteEvent} className="absolute top-4 left-4 z-50 p-3 bg-red-500/40 backdrop-blur-md rounded-full text-white hover:bg-red-600 transition-colors" title="Admin Delete">
          <Trash2 size={20}/>
        </button>
      )}

      <div className={`absolute inset-0 bg-black transition-opacity duration-500 pointer-events-none ${isEnded ? 'opacity-70' : 'opacity-0'}`} />
      <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

      {isEnded && isVideo(event.poster_url) && (
         <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <PlayCircle size={64} className="text-white opacity-80" />
         </div>
      )}

      <div className="relative z-20 p-5 flex items-end justify-between w-full">
        <div className="flex-1 text-white pr-4 pb-2">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full border-2 border-rose-500 overflow-hidden bg-slate-900 flex justify-center items-center font-black text-rose-500 text-xs shadow-lg">
              {(event.organizer || 'C').charAt(0).toUpperCase()}
            </div>
            <p className="font-bold text-rose-400 text-sm shadow-black drop-shadow-md">@{event.organizer}</p>
          </div>
          <h2 className="text-3xl font-black mb-1 leading-tight drop-shadow-md">{event.title}</h2>
        </div>

        <div className="flex flex-col items-center gap-5 pb-2">
          <button onClick={() => toggleLike(event.id)} className="flex flex-col items-center gap-1 group">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              likedEvents.has(event.id) ? 'bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.6)]' : 'bg-slate-900/60 backdrop-blur-md border-2 border-slate-600 active:scale-95'
            }`}>
              <Heart size={22} className={likedEvents.has(event.id) ? 'text-white fill-white' : 'text-white'} />
            </div>
            <span className="text-[10px] font-bold text-slate-200">{event.likes || 0}</span>
          </button>
          <button onClick={() => event.registration_link ? window.open(event.registration_link, '_blank') : alert("No link provided")} className="flex flex-col items-center gap-1 group active:scale-95 transition-transform">
            <div className="w-12 h-12 bg-lime-400 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(163,230,53,0.4)]"><Ticket size={22} className="text-slate-950" /></div>
            <span className="text-[10px] font-bold text-slate-200">Register</span>
          </button>
          <button onClick={() => setShowInfo(true)} className="flex flex-col items-center gap-1 group active:scale-95">
            <div className="w-12 h-12 bg-slate-900/60 backdrop-blur-md rounded-full border-2 border-slate-600 flex items-center justify-center transition-colors"><Info size={22} className="text-white" /></div>
            <span className="text-[10px] font-bold text-slate-200">Info</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showInfo && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setShowInfo(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="absolute bottom-0 left-0 right-0 z-50 bg-slate-900 rounded-t-3xl border-t-2 border-slate-700 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] max-h-[75%] flex flex-col">
              <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto my-3 shrink-0" />
              <div className="p-6 overflow-y-auto no-scrollbar flex-1 pb-10">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-2xl font-black text-white">{event.title}</h3>
                  <button onClick={() => setShowInfo(false)} className="bg-slate-800 p-2 rounded-full text-slate-400 hover:text-white shrink-0"><X size={16} /></button>
                </div>
                <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 mb-6 space-y-3 shadow-inner">
                  <div className="flex items-center gap-3"><MapPin size={18} className="text-rose-500 shrink-0" /><span className="text-sm font-bold text-slate-200">{event.venue || 'TBA'}</span></div>
                  <div className="flex items-center gap-3"><Clock size={18} className="text-lime-400 shrink-0" /><span className="text-sm font-bold text-slate-200">{event.date || 'TBA'}</span></div>
                </div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2"><Info size={14}/> About Event</h4>
                <p className="text-slate-300 text-sm leading-relaxed mb-6 whitespace-pre-wrap">{event.desc || 'No description provided.'}</p>
                {event.info_link && (
                  <button onClick={() => window.open(event.info_link, '_blank')} className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-500 transition-colors shadow-lg active:scale-95">
                    <Info size={18} /> View External Info
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};


export default function Bazaar({ navigateTo }: { navigateTo: (tab: string) => void }) {
  const token = localStorage.getItem('cf_token');
  const currentUserId = token ? parseInt(JSON.parse(atob(token.split('.')[1])).sub) : 1;

  // 🚀 FETCH USER ROLE ON MOUNT
  const [userRole, setUserRole] = useState('student');
  const isAdmin = userRole === 'super_admin';
  const isOrganizer = userRole === 'organizer';

  const [activeTab, setActiveTab] = useState<'market' | 'events'>('market');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [marketItems, setMarketItems] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [likedEvents, setLikedEvents] = useState<Set<number>>(new Set());

  const [showSellModal, setShowSellModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [selectedMarketItem, setSelectedMarketItem] = useState<any | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null); 

  const [sellForm, setSellForm] = useState({ title: '', price: '', desc: '', tags: '', image: '' });
  const [eventForm, setEventForm] = useState({ title: '', venue: '', start: '', end: '', desc: '', regLink: '', infoLink: '', image: '', organizer: '' });
  
  useEffect(() => {
    if (activeTab === 'events') document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'auto';
    return () => { document.body.style.overflow = 'auto'; };
  }, [activeTab]);

  const fetchBazaarData = async () => {
    try {
      if (token) {
        const roleRes = await axios.get(`${API_HOST}/auth/me?token=${token}`);
        setUserRole(roleRes.data.role);
      }
      
      const [marketRes, eventsRes] = await Promise.all([
        axios.get(`${API_HOST}/bazaar/market`),
        axios.get(`${API_HOST}/bazaar/events`)
      ]);
      setMarketItems(marketRes.data || []);
      setEvents(eventsRes.data || []);

      const myLikes = new Set<number>();
      (eventsRes.data || []).forEach((e: any) => {
         if (e.liked_by && e.liked_by.includes(currentUserId)) myLikes.add(e.id);
      });
      setLikedEvents(myLikes);

    } catch(error) {
      console.error("Failed to fetch bazaar data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchBazaarData(); }, []);

  const filteredItems = marketItems.filter(item => {
    if (searchQuery.trim() === '') return true;
    const search = searchQuery.toLowerCase();
    if (search.startsWith('#')) {
      const tagQuery = search.replace('#', '').trim();
      if (!tagQuery) return true;
      const safeTags = Array.isArray(item.tags) ? item.tags : [];
      return safeTags.some((t: string) => (t || "").toLowerCase().includes(tagQuery));
    }
    return (item.title || "").toLowerCase().includes(search) || (item.description || "").toLowerCase().includes(search);
  });

  const handleWhatsApp = (item: any) => {
    const text = encodeURIComponent(`Hey! Is "${item.title || 'this item'}" still available on CampusFLOW?`);
    window.open(`https://wa.me/${item.whatsapp}?text=${text}`, '_blank');
  };

  const toggleLike = async (id: number) => {
    const isLiked = likedEvents.has(id);
    setLikedEvents(prev => {
      const newSet = new Set(prev);
      if (isLiked) newSet.delete(id); else newSet.add(id);
      return newSet;
    });
    setEvents(prev => prev.map(e => e.id === id ? { ...e, likes: Math.max(0, (e.likes || 0) + (isLiked ? -1 : 1)) } : e));
    try { await axios.put(`${API_HOST}/bazaar/events/${id}/like?user_id=${currentUserId}`); } catch (e) { }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'sell' | 'event') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith('video/') && file.size > 15 * 1024 * 1024) {
       alert("Video is too large! Please keep demo videos under 15MB."); return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === 'sell') setSellForm(prev => ({...prev, image: reader.result as string}));
      else setEventForm(prev => ({...prev, image: reader.result as string}));
    };
    reader.readAsDataURL(file);
  };

  const openEditModal = (item: any) => {
    setSelectedItemId(item.id);
    setSellForm({
      title: item.title, price: item.price.toString(), desc: item.description || '',
      tags: item.tags ? item.tags.join(', ') : '', image: item.image_url || ''
    });
    setShowSellModal(true);
  };

  const closeSellModal = () => {
    setShowSellModal(false); setSelectedItemId(null);
    setSellForm({ title: '', price: '', desc: '', tags: '', image: '' });
  };

  const handleDeleteItem = async (id: number) => {
    if (!confirm("Are you sure you want to remove this item?")) return;
    try {
      await axios.delete(`${API_HOST}/bazaar/market/${id}?user_id=${currentUserId}`);
      if (selectedMarketItem?.id === id) setSelectedMarketItem(null);
      fetchBazaarData();
    } catch (e) { alert("Failed to delete item."); }
  };

  const handleMarkSold = async (id: number) => {
    if (!confirm("Mark this item as sold? It will be removed from the active marketplace.")) return;
    try {
      await axios.put(`${API_HOST}/bazaar/market/${id}/sold?user_id=${currentUserId}`);
      if (selectedMarketItem?.id === id) setSelectedMarketItem(null);
      fetchBazaarData();
    } catch (e) { alert("Failed to update item status."); }
  };

  const handlePostSell = async () => {
    if (!sellForm.title || !sellForm.price || (!sellForm.image && !selectedItemId)) return alert("Title, Price, and Image are required!");
    setIsSubmitting(true);
    try {
      const tagArray = sellForm.tags.split(',').map(t => t.trim().replace('#', '')).filter(t => t);
      const payload = {
        user_id: currentUserId, title: sellForm.title, price: parseFloat(sellForm.price),
        description: sellForm.desc, tags: tagArray, image_url: sellForm.image
      };
      if (selectedItemId) {
        await axios.put(`${API_HOST}/bazaar/market/${selectedItemId}`, payload);
        if (selectedMarketItem) setSelectedMarketItem({...selectedMarketItem, ...payload});
      } else {
        await axios.post(`${API_HOST}/bazaar/market`, payload);
        alert("Sent to the Moderation Queue! An admin will review it shortly."); // 🚀 QUEUE NOTIFICATION
      }
      closeSellModal(); fetchBazaarData();
    } catch (e) { alert("Failed to process market item."); } 
    finally { setIsSubmitting(false); }
  };

  const handlePostEvent = async () => {
    if (!eventForm.title || !eventForm.venue || !eventForm.start || !eventForm.end || !eventForm.image) return alert("Please fill all required fields and add media!");
    setIsSubmitting(true);
    try {
      await axios.post(`${API_HOST}/bazaar/events`, {
        user_id: currentUserId, title: eventForm.title, venue: eventForm.venue,
        start_time: new Date(eventForm.start).toISOString(), end_time: new Date(eventForm.end).toISOString(),
        description: eventForm.desc, poster_url: eventForm.image,
        registration_link: eventForm.regLink || null, info_link: eventForm.infoLink || null,
        organizer: eventForm.organizer || "Student" 
      });
      alert("Event sent to the Moderation Queue! It will be live after admin approval."); // 🚀 QUEUE NOTIFICATION
      setShowEventModal(false);
      setEventForm({ title: '', venue: '', start: '', end: '', desc: '', regLink: '', infoLink: '', image: '', organizer: '' });
      fetchBazaarData();
    } catch (e) { alert("Failed to post event."); } 
    finally { setIsSubmitting(false); }
  };

  const [instaLink, setInstaLink] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const handleInstaSync = async () => {
    if (!instaLink) return alert("Paste an Instagram link first!");
    setIsSyncing(true);
    try {
      const res = await axios.post(`${API_HOST}/bazaar/events/sync-instagram`, { url: instaLink });
      setEventForm(prev => ({
        ...prev, title: res.data.title || prev.title, desc: res.data.desc || prev.desc,
        image: res.data.poster_url || prev.image, venue: res.data.venue || prev.venue,
        organizer: res.data.organizer || prev.organizer, infoLink: instaLink
      }));
      setInstaLink('');
    } catch (e) { alert("Failed to sync from Instagram."); } 
    finally { setIsSyncing(false); }
  };

  return (
    <div className="w-full min-h-[100dvh] flex flex-col font-caveat relative bg-slate-950 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px]">
      
      <div className={`z-50 flex items-center w-full transition-all duration-500 ease-in-out ${
        activeTab === 'events' ? 'absolute top-4 left-1/2 -translate-x-1/2 scale-90 origin-top justify-center gap-2' : 'sticky top-20 mb-6 px-4 pt-2 justify-between gap-2' 
      }`}>
        <div className={`flex space-x-1 rounded-full border-2 border-slate-700 shadow-[0px_4px_0px_#000] transition-all duration-300 shrink-0 ${
          activeTab === 'events' ? 'bg-slate-950/80 backdrop-blur-md p-1.5' : 'bg-slate-900 p-1.5'
        }`}>
          {(['market', 'events'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`tour-bazaar-events relative flex items-center justify-center rounded-full font-bold tracking-wide transition-all duration-300 font-sans ${
                activeTab === 'events' ? 'p-3' : 'px-3 sm:px-5 py-2.5 text-xs sm:text-sm'
              } ${activeTab === tab ? 'text-slate-900' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {activeTab === tab && <div className={`absolute inset-0 rounded-full transition-all duration-300 ${tab === 'market' ? 'bg-lime-400' : 'bg-rose-500'}`} />}
              <span className="relative z-10 flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap">
                {tab === 'market' ? <ShoppingBag size={activeTab === 'events' ? 20 : 18} className="shrink-0" /> : <Ticket size={activeTab === 'events' ? 20 : 18} className="shrink-0" />}
                {activeTab === 'market' && <span>{tab === 'market' ? 'Marketplace' : 'Campus Events'}</span>}
              </span>
            </button>
          ))}
        </div>

        <div className="flex gap-2 shrink-0">
          {/* 🚀 HIDDEN UNLESS ORGANIZER OR ADMIN */}
          {activeTab === 'events' && (isAdmin || isOrganizer) && (
            <button onClick={() => setShowEventModal(true)} className="bg-rose-500 text-white rounded-full border-2 border-slate-900 flex items-center justify-center shadow-[4px_4px_0px_#000] w-12 h-12 hover:-translate-y-1 transition-all">
              <Plus size={24} strokeWidth={3} />
            </button>
          )}
          {activeTab === 'market' && (
            <button onClick={() => navigateTo('navigator')} className="bg-lime-400 rounded-full border-2 border-slate-900 flex items-center justify-center text-slate-950 shadow-[4px_4px_0px_#000] w-12 h-12 hover:-translate-y-1 transition-all">
              <MapPin size={24} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center mt-32 text-slate-500">
          <Loader2 className="animate-spin mb-4 text-lime-400" size={48} />
          <p className="font-bold tracking-widest uppercase text-sm font-sans">Loading Bazaar Data...</p>
        </div>
      ) : activeTab === 'market' ? (
        
        <div className="px-4 pb-24">
          <div className="flex gap-3 mb-6 font-sans">
            <div className="relative flex-1">
              <input 
                type="text" 
                placeholder="Search items or use #tags..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border-2 border-slate-800 text-slate-100 rounded-xl pl-11 pr-4 py-3 font-bold focus:outline-none focus:border-lime-400 focus:shadow-[4px_4px_0px_#10b981] transition-all placeholder:text-slate-500" 
              />
              <Search className="absolute left-3.5 top-3.5 text-slate-500" size={20} />
            </div>
            <button onClick={() => setShowSellModal(true)} className="bg-lime-400 shrink-0 flex items-center justify-center text-slate-950 px-4 rounded-xl border-2 border-slate-900 shadow-[4px_4px_0px_#000] hover:-translate-y-1 hover:shadow-[6px_6px_0px_#000] active:scale-95 transition-all font-black gap-2">
              <Plus size={22} strokeWidth={3} />
              <span className="hidden sm:inline">Sell</span>
            </button>
          </div>

          {filteredItems.length > 0 ? (
            <div className="columns-2 gap-4 space-y-4">
              {filteredItems.map((item) => {
                const isEven = item.id % 2 === 0;
                const rotateClass = isEven ? 'rotate-2' : '-rotate-2';

                return (
                  <div 
                    key={item.id} 
                    onClick={() => setSelectedMarketItem(item)}
                    className={`relative break-inside-avoid bg-slate-100 p-2 pb-5 rounded-sm shadow-[6px_6px_0px_rgba(0,0,0,0.5)] hover:rotate-0 transition-transform group cursor-pointer ${rotateClass}`}
                  >
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-5 bg-white/50 backdrop-blur-sm border border-white/20 rotate-3 shadow-sm z-10" />

                    {/* 🚀 ADMIN CAN SEE DELETE ON ALL POSTS */}
                    {(item.seller_id === currentUserId || isAdmin) && (
                      <div className="absolute top-4 right-4 flex gap-1.5 z-10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        {item.seller_id === currentUserId && <button onClick={(e) => { e.stopPropagation(); openEditModal(item); }} className="p-2 bg-slate-900/80 backdrop-blur border border-slate-600 rounded-full text-white hover:text-lime-400"><Edit2 size={14}/></button>}
                        {item.seller_id === currentUserId && <button onClick={(e) => { e.stopPropagation(); handleMarkSold(item.id); }} className="p-2 bg-slate-900/80 backdrop-blur border border-slate-600 rounded-full text-white hover:text-yellow-400" title="Mark as Sold"><Check size={14}/></button>}
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }} className="p-2 bg-slate-900/80 backdrop-blur border border-slate-600 rounded-full text-white hover:text-red-400"><Trash2 size={14}/></button>
                      </div>
                    )}

                    <div className="w-full bg-slate-900 border border-slate-300 rounded-sm overflow-hidden aspect-square flex items-center justify-center mb-3">
                      <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                    </div>
                    
                    <div className="px-1 text-slate-900 flex flex-col h-full">
                      <h3 className="font-black text-2xl leading-none mb-2 truncate">{item.title}</h3>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {(Array.isArray(item.tags) ? item.tags : []).map((t: string) => (
                          <span key={t} className="text-[10px] font-bold text-slate-100 bg-slate-800 px-1.5 py-0.5 rounded-sm uppercase tracking-wider font-sans">#{t}</span>
                        ))}
                      </div>
                      
                      <div className="mt-auto pt-2 flex justify-between items-end">
                        <span className="text-blue-600 font-black text-3xl font-sans tracking-tighter">₹{item.price}</span>
                        <span className="text-xs text-slate-500 font-bold font-sans">{formatTimeAgo(item.time_posted)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 flex flex-col items-center justify-center text-slate-500 font-bold text-center border-2 border-slate-800 border-dashed rounded-2xl font-sans bg-slate-900/50">
              <Search size={48} className="mb-4 opacity-20" />
              <div className="text-center">
                <span className="block">No items found for</span>
                <span className="block text-slate-300 text-lg mt-1 break-words px-4">"{searchQuery}"</span>
              </div>
            </div>
          )}
        </div>

      ) : (

        <div className="px-2 font-sans flex-1 overflow-hidden pb-20">
          <div className="w-full h-[calc(100dvh-10rem)] bg-black rounded-3xl overflow-y-scroll snap-y snap-mandatory no-scrollbar overscroll-none border-4 border-slate-800 shadow-[4px_4px_0px_#000] relative">
            {events.length === 0 ? (
               <div className="absolute inset-0 flex items-center justify-center text-slate-500 font-bold font-sans">No upcoming events scheduled.</div>
            ) : events.map((event) => (
               <ReelItem key={event.id} event={event} currentUserId={currentUserId} toggleLike={toggleLike} likedEvents={likedEvents} isAdmin={isAdmin} />
            ))}
          </div>
        </div>
      )}

      {/* DETAILED VIEW MODAL FOR MARKETPLACE */}
      <AnimatePresence>
        {selectedMarketItem && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[6000] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm font-sans" 
            onClick={() => setSelectedMarketItem(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} 
              onClick={(e) => e.stopPropagation()} 
              className="bg-slate-100 border-2 border-slate-300 w-full max-w-lg rounded-sm overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col"
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-white/50 backdrop-blur-sm border border-white/20 rotate-2 shadow-sm z-50 pointer-events-none" />
              <button onClick={() => setSelectedMarketItem(null)} className="absolute top-4 right-4 w-10 h-10 bg-slate-900/60 rounded-full flex justify-center items-center text-white z-50 hover:bg-rose-500 transition-colors"><X size={20}/></button>
              
              <div ref={imageContainerRef} className="w-full h-64 sm:h-80 bg-slate-900 shrink-0 relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing">
                <motion.img 
                  src={selectedMarketItem.image_url} alt={selectedMarketItem.title} 
                  className="max-w-full max-h-full object-contain origin-center"
                  drag dragConstraints={imageContainerRef} dragElastic={0.2}
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 1.5 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                />
                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm pointer-events-none font-sans font-bold">Tap & Hold to Zoom</div>
              </div>
              
              <div className="p-6 overflow-y-auto hide-scrollbar flex-1 bg-slate-100 text-slate-900">
                <div className="flex justify-between items-start mb-2 font-caveat">
                  <h2 className="text-4xl font-black leading-none">{selectedMarketItem.title}</h2>
                  <span className="text-4xl font-black text-blue-600 ml-4 shrink-0 font-sans tracking-tighter">₹{selectedMarketItem.price}</span>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  {(Array.isArray(selectedMarketItem.tags) ? selectedMarketItem.tags : []).map((t: string) => (
                    <span key={t} className="text-[10px] font-bold text-slate-100 bg-slate-800 px-2 py-1 rounded uppercase tracking-wider">#{t}</span>
                  ))}
                </div>
                
                <div className="bg-slate-200 border border-slate-300 rounded-sm p-4 mb-6 shadow-inner font-caveat">
                  <h3 className="text-xl font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-2"><Info size={16}/> Description</h3>
                  <p className="text-slate-800 text-2xl leading-tight whitespace-pre-wrap">{selectedMarketItem.description || "No description provided."}</p>
                </div>

                <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-6 font-sans">
                  <span>Posted {formatTimeAgo(selectedMarketItem.time_posted)}</span>
                </div>

                {selectedMarketItem.seller_id === currentUserId || isAdmin ? (
                  <div className="flex gap-2 font-sans">
                    {selectedMarketItem.seller_id === currentUserId && <button onClick={() => { setSelectedMarketItem(null); openEditModal(selectedMarketItem); }} className="flex-1 bg-slate-800 text-white font-bold py-3 rounded-md border border-slate-700 hover:bg-slate-700 transition-colors">Edit Post</button>}
                    {selectedMarketItem.seller_id === currentUserId && <button onClick={() => handleMarkSold(selectedMarketItem.id)} className="flex-1 bg-yellow-400 text-slate-900 font-bold py-3 rounded-md shadow-[2px_2px_0px_#000] border-2 border-slate-900 hover:translate-y-px hover:shadow-none transition-all">Mark as Sold</button>}
                    {isAdmin && <button onClick={() => handleDeleteItem(selectedMarketItem.id)} className="flex-1 bg-red-500 text-white font-bold py-3 rounded-md border-2 border-slate-900 hover:bg-red-600 transition-colors">Admin Delete</button>}
                  </div>
                ) : (
                  <button onClick={() => handleWhatsApp(selectedMarketItem)} className="w-full flex items-center justify-center gap-2 bg-lime-400 text-slate-950 font-black text-xl py-4 rounded-sm shadow-[4px_4px_0px_#000] border-2 border-slate-900 hover:-translate-y-1 hover:shadow-[6px_6px_0px_#000] active:scale-95 transition-all font-sans">
                    <MessageCircle size={22} /> CHAT WITH SELLER
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSellModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[7000] bg-black/80 flex items-center justify-center p-4 font-sans">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-slate-900 border-2 border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
              <button onClick={closeSellModal} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={24}/></button>
              <h2 className="text-2xl font-black text-lime-400 uppercase tracking-widest mb-6">{selectedItemId ? 'Edit Item' : 'List an Item'}</h2>
              
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1"><label className="text-xs font-bold text-slate-500 uppercase">Item Name</label><input type="text" value={sellForm.title} onChange={e => setSellForm({...sellForm, title: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-bold focus:border-lime-400 focus:outline-none" placeholder="e.g. Drafter" /></div>
                  <div className="w-[30%]"><label className="text-xs font-bold text-slate-500 uppercase">Price (₹)</label><input type="number" value={sellForm.price} onChange={e => setSellForm({...sellForm, price: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-lime-400 font-black focus:border-lime-400 focus:outline-none" placeholder="350" /></div>
                </div>

                <div><label className="text-xs font-bold text-slate-500 uppercase">Description</label><textarea value={sellForm.desc} onChange={e => setSellForm({...sellForm, desc: e.target.value})} className="w-full h-20 bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-sm focus:border-lime-400 focus:outline-none resize-none" placeholder="Condition, pickup location..."></textarea></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase">Tags (Comma Separated)</label><input type="text" value={sellForm.tags} onChange={e => setSellForm({...sellForm, tags: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-blue-400 font-bold focus:border-lime-400 focus:outline-none" placeholder="Academics, Books, Electronics" /></div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Item Photo</label>
                  <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={(e) => handleImageUpload(e, 'sell')} />
                  <div onClick={() => fileInputRef.current?.click()} className={`w-full h-32 border-2 border-dashed rounded-xl flex items-center justify-center cursor-pointer transition-colors ${sellForm.image ? 'border-lime-500 p-1' : 'border-slate-700 bg-slate-950 hover:bg-slate-800'}`}>
                    {sellForm.image ? <img src={sellForm.image} className="w-full h-full object-cover rounded-lg" /> : <div className="flex flex-col items-center text-slate-500"><ImageIcon size={24} className="mb-2"/> <span className="text-xs font-bold uppercase">Upload Photo</span></div>}
                  </div>
                </div>

                <button onClick={handlePostSell} disabled={isSubmitting} className="w-full mt-4 py-3 bg-lime-400 text-slate-900 font-black text-xl tracking-widest uppercase rounded-lg shadow-[4px_4px_0px_#000] hover:translate-y-px hover:shadow-[2px_2px_0px_#000] transition-all disabled:opacity-50">
                  {isSubmitting ? <Loader2 className="animate-spin mx-auto" /> : (selectedItemId ? 'Update Item' : 'Post to Queue')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEventModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[5000] bg-black/80 flex items-center justify-center p-4 font-sans">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-slate-900 border-2 border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto hide-scrollbar">
              <button onClick={() => setShowEventModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={24}/></button>
              <h2 className="text-2xl font-black text-rose-500 uppercase tracking-widest mb-6">Host an Event</h2>
              
              <div className="mb-6 p-4 bg-gradient-to-br from-fuchsia-600/20 to-orange-600/20 border border-rose-500/30 rounded-xl">
                <div className="flex gap-2">
                  <input type="url" value={instaLink} onChange={e => setInstaLink(e.target.value)} className="w-full bg-slate-900 border border-rose-500/50 rounded-lg p-2 text-white text-sm font-bold focus:border-rose-400 focus:outline-none placeholder:text-rose-500/40" placeholder="Paste Reel/Post Link..." />
                  <button onClick={handleInstaSync} disabled={isSyncing} className="bg-rose-500 text-white px-4 rounded-lg font-black tracking-widest uppercase shadow-[2px_2px_0px_#000] hover:translate-y-px hover:shadow-none transition-all disabled:opacity-50 flex items-center justify-center shrink-0">
                    {isSyncing ? <Loader2 className="animate-spin" size={18} /> : 'Sync'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">Paste an Instagram link to auto-fill the video and description below.</p>
              </div>

              <div className="space-y-4">
                <div><label className="text-xs font-bold text-slate-500 uppercase">Event Title</label><input type="text" value={eventForm.title} onChange={e => setEventForm({...eventForm, title: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-bold focus:border-rose-500 focus:outline-none" /></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase">Organizer (Society Handle)</label><input type="text" value={eventForm.organizer} onChange={e => setEventForm({...eventForm, organizer: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-rose-400 font-bold focus:border-rose-500 focus:outline-none" placeholder="e.g. frosh_thapar" /></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase">Venue</label><input type="text" value={eventForm.venue} onChange={e => setEventForm({...eventForm, venue: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-bold focus:border-rose-500 focus:outline-none" /></div>

                <div className="flex gap-4">
                  <div className="flex-1"><label className="text-xs font-bold text-slate-500 uppercase">Start Time</label><input type="datetime-local" value={eventForm.start} onChange={e => setEventForm({...eventForm, start: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-xs font-bold focus:border-rose-500 focus:outline-none" /></div>
                  <div className="flex-1"><label className="text-xs font-bold text-slate-500 uppercase">End Time</label><input type="datetime-local" value={eventForm.end} onChange={e => setEventForm({...eventForm, end: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-xs font-bold focus:border-rose-500 focus:outline-none" /></div>
                </div>

                <div><label className="text-xs font-bold text-slate-500 uppercase">Description</label><textarea value={eventForm.desc} onChange={e => setEventForm({...eventForm, desc: e.target.value})} className="w-full h-16 bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-sm focus:border-rose-500 focus:outline-none resize-none"></textarea></div>
                
                <div><label className="text-xs font-bold text-slate-500 uppercase">Registration Link (Optional)</label><input type="url" value={eventForm.regLink} onChange={e => setEventForm({...eventForm, regLink: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-blue-400 font-bold focus:border-rose-500 focus:outline-none text-sm" placeholder="https://forms.gle/..." /></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase">More Info Link (Optional)</label><input type="url" value={eventForm.infoLink} onChange={e => setEventForm({...eventForm, infoLink: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-blue-400 font-bold focus:border-rose-500 focus:outline-none text-sm" placeholder="https://instagram.com/..." /></div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Media (Image or Video)</label>
                  <input type="file" accept="image/*,video/*" ref={fileInputRef} className="hidden" onChange={(e) => handleImageUpload(e, 'event')} />
                  <div onClick={() => fileInputRef.current?.click()} className={`w-full h-40 border-2 border-dashed rounded-xl flex items-center justify-center cursor-pointer transition-colors ${eventForm.image ? 'border-rose-500 p-1' : 'border-slate-700 bg-slate-950 hover:bg-slate-800'}`}>
                    {eventForm.image ? (
                      isVideo(eventForm.image) ? (
                        <video src={eventForm.image} className="w-full h-full object-cover rounded-lg" autoPlay loop muted playsInline />
                      ) : (
                        <img src={eventForm.image} className="w-full h-full object-cover rounded-lg" />
                      )
                    ) : (
                      <div className="flex flex-col items-center text-slate-500">
                        <div className="flex gap-2 mb-2"><ImageIcon size={24}/><Film size={24}/></div>
                        <span className="text-xs font-bold uppercase">Upload Media</span>
                      </div>
                    )}
                  </div>
                </div>

                <button onClick={handlePostEvent} disabled={isSubmitting} className="w-full mt-4 py-3 bg-rose-500 text-white font-black text-xl tracking-widest uppercase rounded-lg shadow-[4px_4px_0px_#000] hover:translate-y-px hover:shadow-[2px_2px_0px_#000] transition-all disabled:opacity-50">
                  {isSubmitting ? <Loader2 className="animate-spin mx-auto" /> : 'Post to Queue'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}