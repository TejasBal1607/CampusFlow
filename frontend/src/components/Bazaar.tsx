import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, Ticket, MessageCircle, MapPin, Heart, Info, Search, Plus } from 'lucide-react';

// --- DUMMY DATA ---
const MOCK_ITEMS = [
  { id: 1, title: "Omega Drafter (Almost New)", price: 350, category: "Academics", image_url: "https://images.unsplash.com/photo-1603484477859-abe6a73f9366?auto=format&fit=crop&w=400&q=80", time_posted: "2h ago", whatsapp: "919999999999" },
  { id: 2, title: "Symphony 12L Cooler", price: 2500, category: "Electronics", image_url: "https://images.unsplash.com/photo-1585338107529-13afc5f02586?auto=format&fit=crop&w=400&q=80", time_posted: "5h ago", whatsapp: "919999999999" },
  { id: 3, title: "Calculus James Stewart 8th Ed", price: 400, category: "Books", image_url: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=400&q=80", time_posted: "1d ago", whatsapp: "919999999999" },
  { id: 4, title: "Hero Sprint Cycle", price: 3000, category: "Cycles", image_url: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=400&q=80", time_posted: "2d ago", whatsapp: "919999999999" },
];

const MOCK_EVENTS = [
  { id: 1, organizer: "CCS", title: "Intra-CCS Hackathon", venue: "TAN Auditorium", date: "Tonight, 9:00 PM", desc: "The ultimate 24-hour coding showdown. Build the future of campus tech.", poster_url: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80" },
  { id: 2, organizer: "Mudra", title: "Freshers Dance Showcase", venue: "Main Aud", date: "Tomorrow, 6:00 PM", desc: "Watch the newest batch light up the stage with breathtaking choreography.", poster_url: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80" },
  { id: 3, organizer: "Frosh", title: "Campus Tour Setup", venue: "C-Block", date: "Friday, 4:00 PM", desc: "Volunteers needed to help set up the interactive booths.", poster_url: "https://images.unsplash.com/photo-1523580494112-071d45740871?auto=format&fit=crop&w=800&q=80" },
];

const FILTERS = ['All', 'Academics', 'Electronics', 'Books', 'Cycles', 'Misc'];

export default function Bazaar({ navigateTo }: { navigateTo: (tab: string) => void }) {
  const [activeTab, setActiveTab] = useState<'market' | 'events'>('market');
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Track liked reels
  const [likedEvents, setLikedEvents] = useState<Set<number>>(new Set());

  // Search & Filter combined logic
  const filteredItems = MOCK_ITEMS.filter(item => 
    (activeFilter === 'All' || item.category === activeFilter) &&
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleWhatsApp = (item: any) => {
    const text = encodeURIComponent(`Hey! Is "${item.title}" still available on CampusFLOW?`);
    window.open(`https://wa.me/${item.whatsapp}?text=${text}`, '_blank');
  };

  const toggleLike = (id: number) => {
    setLikedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  return (
    <div className="w-full flex flex-col font-sans relative">
      
      {/* 🚀 THE DYNAMIC HEADER NAV */}
      <div 
        className={`z-50 flex items-center w-full transition-all duration-500 ease-in-out ${
          activeTab === 'events'
            ? 'absolute top-4 left-1/2 -translate-x-1/2 scale-90 origin-top justify-center' // Centers and shrinks the pill
            : 'sticky top-20 mb-6 px-4 pt-2 justify-between gap-2' // Pill left, Map right, no overflow
        }`}
      >
        {/* The Pill */}
        <div className={`flex space-x-1 rounded-full border-2 border-slate-700 shadow-[0px_4px_0px_#000] transition-all duration-300 shrink-0 ${
          activeTab === 'events' ? 'bg-slate-950/80 backdrop-blur-md p-1.5' : 'bg-slate-900 p-1.5'
        }`}>
          {(['market', 'events'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative flex items-center justify-center rounded-full font-bold tracking-wide transition-all duration-300 ${
                activeTab === 'events' ? 'p-3' : 'px-3 sm:px-5 py-2.5 text-xs sm:text-sm'
              } ${
                activeTab === tab ? 'text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {activeTab === tab && (
                <div
                  className={`absolute inset-0 rounded-full transition-all duration-300 ${
                    tab === 'market' ? 'bg-lime-400' : 'bg-rose-500'
                  }`}
                />
              )}
              
              <span className="relative z-10 flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap">
                {tab === 'market' 
                  ? <ShoppingBag size={activeTab === 'events' ? 20 : 18} className="shrink-0" /> 
                  : <Ticket size={activeTab === 'events' ? 20 : 18} className="shrink-0" />
                }
                {activeTab === 'market' && (
                  <span>{tab === 'market' ? 'Marketplace' : 'Campus Events'}</span>
                )}
              </span>
            </button>
          ))}
        </div>

        {/* Map Button (No longer wrapped in a flex-1 spacer!) */}
        {activeTab === 'market' && (
          <button 
            onClick={() => navigateTo('navigator')} 
            className="shrink-0 bg-lime-400 rounded-full border-2 border-slate-900 flex items-center justify-center text-slate-950 hover:bg-lime-300 transition-all shadow-[4px_4px_0px_#000] w-12 h-12 hover:-translate-y-1"
          >
            <MapPin size={24} strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* 🚀 MAIN CONTENT RENDERING */}
      {/* Dev Note: Standard divs used here instead of motion.div to prevent Unmount Deadlock */}
      {activeTab === 'market' ? (
        
        // --- MARKETPLACE UI ---
        <div className="px-4 pb-24">
          
          {/* SEARCH & ADD ACTION ROW */}
          <div className="flex gap-3 mb-5">
            <div className="relative flex-1">
              <input 
                type="text" 
                placeholder="Search the bazaar..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border-2 border-slate-800 text-slate-100 rounded-xl pl-11 pr-4 py-3 font-bold focus:outline-none focus:border-lime-400 focus:shadow-[4px_4px_0px_#10b981] transition-all placeholder:text-slate-500" 
              />
              <Search className="absolute left-3.5 top-3.5 text-slate-500" size={20} />
            </div>
            <button className="bg-lime-400 shrink-0 flex items-center justify-center text-slate-950 px-4 rounded-xl border-2 border-slate-900 shadow-[4px_4px_0px_#000] hover:-translate-y-1 hover:shadow-[6px_6px_0px_#000] active:scale-95 transition-all font-black gap-2">
              <Plus size={22} strokeWidth={3} />
              <span className="hidden sm:inline">Sell</span>
            </button>
          </div>

          <div className="flex overflow-x-auto no-scrollbar gap-3 mb-6 pb-2">
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`whitespace-nowrap px-4 py-2 rounded-xl border-2 font-bold transition-all ${
                  activeFilter === f 
                  ? 'bg-slate-100 text-slate-950 border-slate-100 shadow-[2px_2px_0px_#10b981]' 
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-500'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="columns-2 gap-4 space-y-4">
            {filteredItems.map((item) => (
              <div key={item.id} className="break-inside-avoid border-2 border-slate-800 bg-slate-900 rounded-2xl overflow-hidden shadow-[4px_4px_0px_#000] hover:border-slate-600 transition-colors">
                <img src={item.image_url} alt={item.title} className="w-full h-auto object-cover border-b-2 border-slate-800" />
                <div className="p-3">
                  <h3 className="font-bold text-sm leading-tight text-slate-100 mb-2">{item.title}</h3>
                  <div className="flex justify-between items-end mt-4">
                    <span className="text-lime-400 font-black text-lg">₹{item.price}</span>
                    <span className="text-xs text-slate-500 font-medium">{item.time_posted}</span>
                  </div>
                  <button 
                    onClick={() => handleWhatsApp(item)}
                    className="mt-3 w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-900 font-bold py-2 rounded-xl hover:bg-lime-400 transition-colors"
                  >
                    <MessageCircle size={16} /> Chat
                  </button>
                </div>
              </div>
            ))}
            {filteredItems.length === 0 && (
              <div className="col-span-2 py-10 text-center text-slate-500 font-bold">
                No items found for "{searchQuery}"
              </div>
            )}
          </div>
        </div>

      ) : (

        // --- REELS FULL SCREEN UI ---
        <div className="px-2">
          <div className="w-full h-[calc(100dvh-11rem)] bg-black rounded-3xl overflow-y-scroll snap-y snap-mandatory no-scrollbar border-4 border-slate-800 shadow-[4px_4px_0px_#000] relative">
            
            {MOCK_EVENTS.map((event) => (
              <div key={event.id} className="relative w-full h-full snap-start bg-slate-900 overflow-hidden">
                
                {/* Background Poster Image */}
                <img src={event.poster_url} className="absolute inset-0 w-full h-full object-cover opacity-80" />
                
                {/* Top Gradient */}
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/80 to-transparent pointer-events-none" />
                
                {/* Bottom Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent pointer-events-none" />

                {/* Reel Content Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-5 flex items-end justify-between">
                  
                  {/* Left Side: Event Info */}
                  <div className="flex-1 text-white pr-4 pb-2">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full border-2 border-rose-500 overflow-hidden">
                        <img src={event.poster_url} className="w-full h-full object-cover" />
                      </div>
                      <p className="font-bold text-rose-400 text-sm shadow-black drop-shadow-md">@{event.organizer}</p>
                    </div>
                    <h2 className="text-3xl font-black mb-1 leading-tight drop-shadow-md">{event.title}</h2>
                    <p className="text-sm font-bold text-lime-400 mb-2 drop-shadow-md">{event.venue} • {event.date}</p>
                    <p className="text-xs text-slate-200 line-clamp-3 leading-relaxed drop-shadow-md">{event.desc}</p>
                  </div>

                  {/* Right Side: Action Buttons */}
                  <div className="flex flex-col items-center gap-5 pb-4">
                    
                    {/* LIKE Button */}
                    <button onClick={() => toggleLike(event.id)} className="flex flex-col items-center gap-1 group">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                        likedEvents.has(event.id) 
                          ? 'bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.6)]' 
                          : 'bg-slate-900/60 backdrop-blur-md border-2 border-slate-600 active:scale-95'
                      }`}>
                        <Heart size={22} className={likedEvents.has(event.id) ? 'text-white fill-white' : 'text-white'} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-200">Like</span>
                    </button>

                    {/* REGISTER Button */}
                    <button className="flex flex-col items-center gap-1 group active:scale-95 transition-transform">
                      <div className="w-12 h-12 bg-lime-400 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(163,230,53,0.4)]">
                        <Ticket size={22} className="text-slate-950" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-200">Register</span>
                    </button>

                    {/* INFO Button */}
                    <button className="flex flex-col items-center gap-1 group active:scale-95">
                      <div className="w-12 h-12 bg-slate-900/60 backdrop-blur-md rounded-full border-2 border-slate-600 flex items-center justify-center transition-colors">
                        <Info size={22} className="text-white" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-200">Info</span>
                    </button>

                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}