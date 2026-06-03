import React, { useEffect, useRef, useState } from 'react';
import { Search, X, Star, Clock, Info, Navigation2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import campusMapImage from '/thapar-map.jpg'; 

const API_HOST = (import.meta as any).env.VITE_API_URL || 'http://localhost:8000';

const stickmanIcon = L.divIcon({
  className: '', 
  html: `
    <div style="width: 64px; height: 64px;">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" style="width: 100%; height: 100%; filter: drop-shadow(4px 4px 0px rgba(0,0,0,0.8));">
        <path d="M1 8h6M0 12h5M2 16h4" stroke="#64748b" stroke-width="1.5" stroke-dasharray="2 2" />
        <g stroke="#60a5fa" stroke-width="2.5">
          <circle cx="16" cy="5" r="2.5" />
          <path d="M16 7.5L13 14" />
          <path d="M14 11L11 10L9 12" />
          <path d="M14 11L17 12L19 9" />
          <path d="M13 14L10 17L7 17" />
          <path d="M13 14L16 18L15 22" />
        </g>
      </svg>
    </div>
  `,
  iconSize: [64, 64], 
  iconAnchor: [40, 58], 
  popupAnchor: [-8, -58], 
});

const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

const IMAGE_WIDTH = 1920;  
const IMAGE_HEIGHT = 1080; 

const bounds: L.LatLngBoundsExpression = [[0, 0], [IMAGE_HEIGHT, IMAGE_WIDTH]];
const paddedBounds: L.LatLngBoundsExpression = [[-600, -600], [IMAGE_HEIGHT + 600, IMAGE_WIDTH + 600]];

const MAP_CALIBRATION = {
  topLeft: { lat: 30.3595, lng: 76.3575 },     
  bottomRight: { lat: 30.3510, lng: 76.3685 }, 
};

const convertGPSToPixels = (lat: number, lng: number) => {
  const latPercent = (MAP_CALIBRATION.topLeft.lat - lat) / (MAP_CALIBRATION.topLeft.lat - MAP_CALIBRATION.bottomRight.lat);
  const lngPercent = (lng - MAP_CALIBRATION.topLeft.lng) / (MAP_CALIBRATION.bottomRight.lng - MAP_CALIBRATION.topLeft.lng);
  const y = IMAGE_HEIGHT - (latPercent * IMAGE_HEIGHT);
  const x = lngPercent * IMAGE_WIDTH;
  return [y, x];
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'Hostel': return '#3b82f6';   
    case 'Food': return '#f59e0b';     
    case 'Building': return '#ec4899'; 
    case 'Park': return '#22c55e';     
    case 'Waypoint': return '#94a3b8'; 
    case 'Facility': return '#8b5cf6';  
    case 'Shops': return '#facc15';
    case 'Rooms': return '#ef4444';
    case 'Misc':
    default: return '#a3e635';         
  }
};

export default function Navigator() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markerLayer = useRef<L.LayerGroup | null>(null);
  const routingLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const prevSearchRef = useRef("");
  
  // 🚀 NEW: Load locations from DB!
  const [dbLocations, setDbLocations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<any | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  
  const [currentZoom, setCurrentZoom] = useState(-2);
  const [zoomThreshold, setZoomThreshold] = useState(-1);
  const coverZoomRef = useRef(-2);

  // 1️⃣ FETCH DATA
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await axios.get(`${API_HOST}/locations/`);
        setDbLocations(res.data);
      } catch (error) {
        console.error("Failed to load map data from DB", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLocations();
  }, []);

  // 2️⃣ INITIALIZE MAP
  useEffect(() => {
    if (isLoading || !mapRef.current || leafletMap.current) return;

    const mapContainer = mapRef.current;
    const { clientWidth, clientHeight } = mapContainer;
    
    const scaleX = clientWidth / IMAGE_WIDTH;
    const scaleY = clientHeight / IMAGE_HEIGHT;
    const coverScale = Math.max(scaleX, scaleY);
    
    const calculatedCoverZoom = Math.log2(coverScale);
    coverZoomRef.current = calculatedCoverZoom;
    
    const calculatedThreshold = calculatedCoverZoom + 0.8;
    setZoomThreshold(calculatedThreshold);
    setCurrentZoom(calculatedCoverZoom);

    leafletMap.current = L.map(mapContainer, {
      crs: L.CRS.Simple, 
      minZoom: calculatedCoverZoom - 0.3, 
      maxZoom: calculatedCoverZoom + 5.0, 
      zoomControl: false,
      maxBounds: paddedBounds, 
      maxBoundsViscosity: 0.8 
    });

    L.imageOverlay(campusMapImage, bounds).addTo(leafletMap.current);
    leafletMap.current.setView([IMAGE_HEIGHT / 2, IMAGE_WIDTH / 2], calculatedCoverZoom);

    markerLayer.current = L.layerGroup().addTo(leafletMap.current);
    routingLayerRef.current = L.layerGroup().addTo(leafletMap.current); 

    leafletMap.current.on('zoomend', () => {
      setCurrentZoom(leafletMap.current!.getZoom());
    });

    // 🚀 NEW: Click-to-Tag now instantly saves to the DB!
    leafletMap.current.on('click', async (e) => {
      const y = Math.round(e.latlng.lat);
      const x = Math.round(e.latlng.lng);
      
      const locName = prompt(`You clicked [${y}, ${x}]. \nWhat is the name of this location?`);
      if (locName) {
        try {
          await axios.post(`${API_HOST}/locations/`, {
            name: locName,
            category: "Misc",
            desc: "Added by user...",
            coords: [y, x],
            image_url: "https://via.placeholder.com/400",
            open_time: "24/7"
          });
          
          L.marker([y, x], { icon: customIcon }).addTo(markerLayer.current!)
            .bindPopup(`<b>${locName}</b><br/>Saved to DB!`).openPopup();
            
          // Silently refresh the pins in the background
          const res = await axios.get(`${API_HOST}/locations/`);
          setDbLocations(res.data);
          
        } catch (err) {
          alert("Failed to save location to the database.");
        }
      }
    });

    return () => { 
      leafletMap.current?.remove(); 
      leafletMap.current = null; 
      userMarkerRef.current = null; 
      routingLayerRef.current = null;
    };
  }, [isLoading]);

  const startNavigation = (loc: any) => {
    leafletMap.current?.closePopup();
    setSelectedLocation(null); 
    
    if (!userMarkerRef.current) {
      alert("Please tap the 'Find Me' GPS button first so we know where you are starting from!");
      return;
    }

    if (routingLayerRef.current) {
       routingLayerRef.current.clearLayers();
       // 🚀 No more math scaling needed! The DB coordinates are already perfect.
       const finalY = loc.coords[0];
       const finalX = loc.coords[1];
       
       const userPos = userMarkerRef.current.getLatLng();
       const targetPos = L.latLng(finalY, finalX);
       
       const line = L.polyline([userPos, targetPos], { 
          color: '#3b82f6', 
          dashArray: '12, 12', 
          weight: 5,
          lineCap: 'round',
          opacity: 0.8
       });
       routingLayerRef.current.addLayer(line);
       
       const centerPos = L.latLngBounds(userPos, targetPos).getCenter();
       leafletMap.current?.flyTo(centerPos, leafletMap.current.getZoom(), { animate: true, duration: 1.0 });
    }
  };

  // 3️⃣ DYNAMIC PINS
  useEffect(() => {
    if (isLoading || !markerLayer.current || !leafletMap.current) return;
    markerLayer.current.clearLayers();

    const isSearchEmpty = searchQuery.trim() === "";
    const isZoomedIn = currentZoom >= zoomThreshold;
    
    const filtered = dbLocations.filter(loc => 
      isSearchEmpty || 
      loc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      loc.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const boundsArr: L.LatLngTuple[] = [];

    filtered.forEach(loc => {
      // 🚀 The DB returns the final coords directly!
      const finalCoords: L.LatLngTuple = [loc.coords[0], loc.coords[1]];
      
      if (isSearchEmpty && !isZoomedIn) return;

      boundsArr.push(finalCoords);

      let marker;
      if (isSearchEmpty) {
        marker = L.circleMarker(finalCoords, {
          radius: 5,
          color: '#0f172a',
          weight: 2,
          fillColor: getCategoryColor(loc.category),
          fillOpacity: 1
        });
      } else {
        marker = L.marker(finalCoords, { icon: customIcon });
      }

      const showRating = loc.category !== "Waypoint";
      const showDetailsBtn = loc.category !== "Waypoint" && loc.category !== "Misc";

      const popup = document.createElement('div');
      popup.style.cssText = "font-family: ui-sans-serif, system-ui, sans-serif; min-width: 150px; padding: 2px;";
      popup.innerHTML = `
        <h3 style="font-weight: 900; font-size: 15px; margin: 0 0 2px 0; color: #0f172a;">${loc.name}</h3>
        ${showRating ? `<p style="font-size: 12px; color: #475569; margin: 0 0 8px 0;">⭐ ${loc.rating}</p>` : `<div style="height: 8px;"></div>`}
        <div style="display: flex; gap: 6px;">
          ${showDetailsBtn ? `<button id="btn-details-${loc.id}" style="flex: 1; background: #0f172a; color: #a3e635; border: none; padding: 6px; border-radius: 6px; font-weight: bold; cursor: pointer;">Details</button>` : ''}
          <button id="btn-nav-${loc.id}" style="flex: 1; background: #3b82f6; color: white; border: none; padding: 6px; border-radius: 6px; font-weight: bold; cursor: pointer;">Navigate</button>
        </div>
      `;
      
      marker.bindPopup(popup, { autoPan: false }); 
      markerLayer.current?.addLayer(marker);
      
      marker.on('popupopen', () => {
        if (showDetailsBtn) {
          document.getElementById(`btn-details-${loc.id}`)?.addEventListener('click', () => {
            setSelectedLocation(loc);
            leafletMap.current?.closePopup();
          });
        }
        document.getElementById(`btn-nav-${loc.id}`)?.addEventListener('click', () => {
          startNavigation(loc);
        });
      });
    });

    if (!isSearchEmpty && boundsArr.length > 0) {
      const targetCenter = L.latLngBounds(boundsArr).getCenter();
      leafletMap.current.flyTo(targetCenter, leafletMap.current.getZoom(), { duration: 0.5 });
    } else if (isSearchEmpty && prevSearchRef.current !== "") {
      routingLayerRef.current?.clearLayers();
      leafletMap.current.flyTo([IMAGE_HEIGHT / 2, IMAGE_WIDTH / 2], coverZoomRef.current, { duration: 0.5 });
    }

    prevSearchRef.current = searchQuery;

  }, [searchQuery, currentZoom, zoomThreshold, dbLocations, isLoading]);

  const handleFindMe = () => {
    setIsLocating(true);

    const fallbackToMainGate = () => {
      // We still use scaling here because the Main Gate fallback is a hardcoded GPS default
      const fallbackY = 76 * (IMAGE_HEIGHT / 3000);
      const fallbackX = 3893 * (IMAGE_WIDTH / 4000);
      
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([fallbackY, fallbackX]);
      } else {
        userMarkerRef.current = L.marker([fallbackY, fallbackX], { icon: stickmanIcon })
          .addTo(leafletMap.current!)
          .bindPopup("<div style='font-family: ui-sans-serif, system-ui; text-align: center;'><b style='color: #0f172a; font-size: 15px;'>📍 You are here!</b><br/><span style='font-size: 11px; color: #64748b; font-weight: bold;'>(Defaulted to Main Gate)</span></div>", { autoPan: false });
      }

      leafletMap.current?.flyTo([fallbackY, fallbackX], leafletMap.current.getZoom(), { animate: true, duration: 1.5 });
      setTimeout(() => { userMarkerRef.current?.openPopup(); setIsLocating(false); }, 1500); 
    };

    if (!navigator.geolocation) {
      fallbackToMainGate();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const buffer = 0.005; 
        const isOffCampus = 
          latitude > MAP_CALIBRATION.topLeft.lat + buffer || 
          latitude < MAP_CALIBRATION.bottomRight.lat - buffer || 
          longitude < MAP_CALIBRATION.topLeft.lng - buffer || 
          longitude > MAP_CALIBRATION.bottomRight.lng + buffer;

        if (isOffCampus) {
          alert("You appear to be off-campus! Defaulting to Main Gate.");
          fallbackToMainGate();
          return;
        }

        const [pixelY, pixelX] = convertGPSToPixels(latitude, longitude);

        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng([pixelY, pixelX]);
        } else {
          userMarkerRef.current = L.marker([pixelY, pixelX], { icon: stickmanIcon })
            .addTo(leafletMap.current!)
            .bindPopup("<div style='font-family: ui-sans-serif, system-ui; text-align: center;'><b style='color: #0f172a; font-size: 15px;'>📍 You are here!</b></div>", { autoPan: false });
        }

        leafletMap.current?.flyTo([pixelY, pixelX], leafletMap.current.getZoom(), { animate: true, duration: 1.5 });
        setTimeout(() => { userMarkerRef.current?.openPopup(); setIsLocating(false); }, 1500);
      },
      (error) => {
        fallbackToMainGate();
      },
      { enableHighAccuracy: true, timeout: 5000 } 
    );
  };

  return (
    <div className="relative w-full h-[calc(100vh-11rem)] bg-[#020617] rounded-3xl overflow-hidden shadow-[6px_6px_0px_#000] border-2 border-slate-800 flex flex-col z-10">
      
      {isLoading && (
        <div className="absolute inset-0 bg-[#020617] z-[500] flex flex-col items-center justify-center text-white">
          <Loader2 className="animate-spin text-lime-400 mb-4" size={48} />
          <p className="font-bold tracking-widest uppercase">Loading Map Data...</p>
        </div>
      )}

      <div className="p-3 bg-slate-950 border-b-2 border-slate-800 flex gap-2 shrink-0 z-20">
        <div className="relative flex-1 shadow-[4px_4px_0px_#000] rounded-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" placeholder="Search Campus..." 
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border-2 border-slate-700 text-white rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-lime-400 font-bold"
          />
        </div>
        
        <button 
          onClick={handleFindMe}
          className={`w-12 h-12 rounded-xl border-2 shadow-[4px_4px_0px_#000] flex items-center justify-center transition-all ${
            isLocating ? 'bg-slate-700 border-slate-600 text-slate-400 animate-pulse' : 'bg-rose-500 border-slate-900 text-white hover:bg-rose-400 hover:-translate-y-1 hover:shadow-[6px_6px_0px_#000] active:scale-95'
          }`}
        >
          <Navigation2 size={22} className={isLocating ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex-1 relative w-full bg-[#020617] z-10">
        <div ref={mapRef} className="w-full h-full absolute inset-0 outline-none" style={{ backgroundColor: '#020617' }} />
      </div>

      <AnimatePresence>
        {selectedLocation && (
          <motion.div 
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute inset-x-0 bottom-0 z-[2000] bg-slate-900 rounded-t-3xl border-t-2 border-slate-700 shadow-[0px_-10px_40px_rgba(0,0,0,0.8)] h-[85%] overflow-y-auto flex flex-col"
          >
            <div className="relative w-full h-56 shrink-0 border-b-2 border-slate-800">
              <img src={selectedLocation.image_url} className="w-full h-full object-cover" />
              <button onClick={() => setSelectedLocation(null)} className="absolute top-4 right-4 w-10 h-10 bg-slate-950/60 rounded-full flex justify-center items-center text-white"><X size={20}/></button>
            </div>
            
            <div className="p-6 pb-12">
              <h2 className="text-3xl font-black text-white">{selectedLocation.name}</h2>
              
              {selectedLocation.category !== "Waypoint" && (
                <div className="flex items-center gap-1 mt-2 text-lime-400 font-bold">
                  <Star size={16} fill="currentColor" />
                  <span>{selectedLocation.rating} / 5.0</span>
                </div>
              )}
              
              <div className="flex items-center gap-2 mt-4 text-slate-400 font-medium">
                <Clock size={16} />
                <span>{selectedLocation.open_time}</span>
              </div>
              
              <div className="mt-6 border-t-2 border-slate-800 pt-6">
                <h3 className="text-lg font-bold text-slate-300 mb-2 flex items-center gap-2">
                  <Info size={18} className="text-lime-400" /> Description
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  {selectedLocation.desc}
                </p>
              </div>

              <button 
                onClick={() => startNavigation(selectedLocation)}
                className="w-full mt-8 bg-blue-500 text-white font-black text-xl py-4 rounded-xl shadow-[4px_4px_0px_#000] border-2 border-slate-900 hover:-translate-y-1 hover:shadow-[6px_6px_0px_#000] active:scale-95 transition-all flex justify-center items-center gap-2"
              >
                <Navigation2 size={24} /> TAKE ME THERE
              </button>
              
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}