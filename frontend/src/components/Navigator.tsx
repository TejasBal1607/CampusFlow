import React, { useEffect, useRef, useState } from 'react';
import { Search, X, Star, Clock, Info, Navigation2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import campusMapImage from '/thapar-map.jpg'; 

// 🛠️ CUSTOM ICONS

// 🏃‍♂️ The Official CampusFLOW Running Stickman
const stickmanIcon = L.divIcon({
  className: '', // Explicitly empty to prevent Leaflet's default white square
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
  // Math: foot is at x=15, y=22 on a 24x24 grid. Scaled to 64x64, that is [40, 58].
  iconAnchor: [40, 58], 
  popupAnchor: [-8, -58], // Centers the popup above his head
});


const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

const userLiveIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

// 🟢 1. YOUR STITCHED IMAGE DIMENSIONS (16:9)
const IMAGE_WIDTH = 1920;  
const IMAGE_HEIGHT = 1080; 

// 🟢 2. THE SCALING ENGINE (4000x3000 to 1920x1080)
const OLD_WIDTH = 4000;
const OLD_HEIGHT = 3000;
const SCALE_X = IMAGE_WIDTH / OLD_WIDTH;   
const SCALE_Y = IMAGE_HEIGHT / OLD_HEIGHT; 

const bounds: L.LatLngBoundsExpression = [[0, 0], [IMAGE_HEIGHT, IMAGE_WIDTH]];

// 🟢 3. GPS CALIBRATION
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

// 🎨 CATEGORY COLOR MAP
const getCategoryColor = (category: string) => {
  switch (category) {
    case 'Hostel': return '#3b82f6';   // Blue 500
    case 'Food': return '#f59e0b';     // Amber 500
    case 'Building': return '#ec4899'; // Pink 500
    case 'Waypoint': return '#94a3b8'; // Slate 400
    case 'Misc':
    default: return '#a3e635';         // Lime 400
  }
};

// --- DATA (UPDATED WITH ACCURATE CATEGORIES) ---
const LOCATIONS = [
  { id: 1, name: "J Hostel (Tejas Hall)", category: "Hostel", short_desc: "Add description...", long_desc: "Add long description...", coords: [892, 1317], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 2, name: "H Hostel (Vyan Hall)", category: "Hostel", short_desc: "Add description...", long_desc: "Add long description...", coords: [891, 1605], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 3, name: "C Hostel (Prithvi Hall)", category: "Hostel", short_desc: "Add description...", long_desc: "Add long description...", coords: [167, 520], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 4, name: "D Hostel (Neeram Hall)", category: "Hostel", short_desc: "Add description...", long_desc: "Add long description...", coords: [176, 211], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 5, name: "O Hostel (Vyom Hall)", category: "Hostel", short_desc: "Add description...", long_desc: "Add long description...", coords: [210, 840], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 6, name: "B Hostel (Amritam Hall)", category: "Hostel", short_desc: "Add description...", long_desc: "Add long description...", coords: [172, 1064], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 7, name: "A Hostel (Agira Hall)", category: "Hostel", short_desc: "Add description...", long_desc: "Add long description...", coords: [186, 1442], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 8, name: "Nirvana Central Park", category: "Misc", short_desc: "Add description...", long_desc: "Add long description...", coords: [752, 2136], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 9, name: "Athletic Track", category: "Misc", short_desc: "Add description...", long_desc: "Add long description...", coords: [1451, 820], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 10, name: "COS", category: "Misc", short_desc: "Add description...", long_desc: "Add long description...", coords: [1353, 1078], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 11, name: "OAT", category: "Misc", short_desc: "Add description...", long_desc: "Add long description...", coords: [1711, 1049], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 12, name: "M Hostel (Anantam Hall)", category: "Hostel", short_desc: "Add description...", long_desc: "Add long description...", coords: [1156, 546], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 13, name: "Kravings Food Court", category: "Food", short_desc: "Add description...", long_desc: "Add long description...", coords: [1084, 2206], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 14, name: "Swimming Pool", category: "Misc", short_desc: "Add description...", long_desc: "Add long description...", coords: [1410, 1993], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 15, name: "N Hostel (Ananta Hall)", category: "Hostel", short_desc: "Add description...", long_desc: "Add long description...", coords: [1421, 2344], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 16, name: "I Hostel (Ira Hall)", category: "Hostel", short_desc: "Add description...", long_desc: "Add long description...", coords: [1667, 2352], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 17, name: "Girls Hostel Block Main Gate", category: "Waypoint", short_desc: "Add description...", long_desc: "Add long description...", coords: [1181, 2332], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 18, name: "H Chowk", category: "Waypoint", short_desc: "Add description...", long_desc: "Add long description...", coords: [1165, 1689], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 19, name: "E Hostel (Vasudha Hall)", category: "Hostel", short_desc: "Add description...", long_desc: "Add long description...", coords: [1402, 2265], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 20, name: "G Hostel (Vasudha Hall)", category: "Hostel", short_desc: "Add description...", long_desc: "Add long description...", coords: [1728, 2267], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 21, name: "Girls Hostel Back Gate", category: "Waypoint", short_desc: "Add description...", long_desc: "Add long description...", coords: [1869, 2338], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 22, name: "LP Lawns", category: "Misc", short_desc: "Add description...", long_desc: "Add long description...", coords: [1630, 2705], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 23, name: "Waterbody Cafe", category: "Food", short_desc: "Add description...", long_desc: "Add long description...", coords: [1397, 3071], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 24, name: "Nava Nalanda Central Library", category: "Building", short_desc: "Add description...", long_desc: "Add long description...", coords: [1284, 3030], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 25, name: "LT Block", category: "Building", short_desc: "Add description...", long_desc: "Add long description...", coords: [1468, 2855], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 26, name: "CSED", category: "Building", short_desc: "Add description...", long_desc: "Add long description...", coords: [1624, 3036], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 27, name: "Library Skywalk Stairs", category: "Waypoint", short_desc: "Add description...", long_desc: "Add long description...", coords: [1510, 3034], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 28, name: "Skywalk", category: "Waypoint", short_desc: "Add description...", long_desc: "Add long description...", coords: [1499, 3110], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 29, name: "DOSA/DOAA Office", category: "Building", short_desc: "Add description...", long_desc: "Add long description...", coords: [1567, 3315], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 30, name: "TSLAS", category: "Building", short_desc: "Add description...", long_desc: "Add long description...", coords: [1894, 3738], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 31, name: "Venture Labs", category: "Building", short_desc: "Add description...", long_desc: "Add long description...", coords: [1807, 3561], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 32, name: "R&D Gate", category: "Waypoint", short_desc: "Add description...", long_desc: "Add long description...", coords: [1779, 3905], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 33, name: "ELC", category: "Building", short_desc: "Add description...", long_desc: "Add long description...", coords: [1210, 3728], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 34, name: "Mechanical Workshop", category: "Building", short_desc: "Add description...", long_desc: "Add long description...", coords: [1240, 3448], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 35, name: "Library Chowk", category: "Waypoint", short_desc: "Add description...", long_desc: "Add long description...", coords: [1162, 3068], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 36, name: "TAN Building", category: "Building", short_desc: "Add description...", long_desc: "Add long description...", coords: [1089, 2636], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 37, name: "G Block", category: "Building", short_desc: "Add description...", long_desc: "Add long description...", coords: [922, 2883], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 38, name: "B Block", category: "Building", short_desc: "Add description...", long_desc: "Add long description...", coords: [620, 3140], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 39, name: "C Block", category: "Building", short_desc: "Add description...", long_desc: "Add long description...", coords: [821, 3124], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 40, name: "D Block", category: "Building", short_desc: "Add description...", long_desc: "Add long description...", coords: [1040, 3120], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 41, name: "F Block", category: "Building", short_desc: "Add description...", long_desc: "Add long description...", coords: [962, 3575], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 42, name: "E Block", category: "Building", short_desc: "Add description...", long_desc: "Add long description...", coords: [718, 3601], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 43, name: "H Block", category: "Building", short_desc: "Add description...", long_desc: "Add long description...", coords: [598, 3769], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 44, name: "Aahaar", category: "Food", short_desc: "Add description...", long_desc: "Add long description...", coords: [609, 3649], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 45, name: "Kulcha Zone", category: "Food", short_desc: "Add description...", long_desc: "Add long description...", coords: [559, 3683], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 46, name: "ADM Block", category: "Building", short_desc: "Add description...", long_desc: "Add long description...", coords: [353, 3445], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 47, name: "Main Gate", category: "Waypoint", short_desc: "Add description...", long_desc: "Add long description...", coords: [76, 3893], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 48, name: "Back Gate", category: "Waypoint", short_desc: "Add description...", long_desc: "Add long description...", coords: [1201, 87], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 49, name: "Gurudwara", category: "Misc", short_desc: "Add description...", long_desc: "Add long description...", coords: [654, 973], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 50, name: "Shiv Mandir", category: "Misc", short_desc: "Add description...", long_desc: "Add long description...", coords: [761, 971], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" },
  { id: 51, name: "Cricket Ground", category: "Misc", short_desc: "Add description...", long_desc: "Add long description...", coords: [2255, 1412], rating: 5.0, reviews: 0, image_url: "https://via.placeholder.com/400", open_time: "24/7" }
];

export default function Navigator() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markerLayer = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const prevSearchRef = useRef("");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<typeof LOCATIONS[0] | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  
  // Dynamic Zoom Trackers
  const [currentZoom, setCurrentZoom] = useState(-2);
  const [zoomThreshold, setZoomThreshold] = useState(-1);
  const coverZoomRef = useRef(-2);

  // 1️⃣ INITIALIZE MAP & DYNAMIC MATH
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    // MATH LOGIC: Object-Fit Cover Calculation!
    const mapContainer = mapRef.current;
    const { clientWidth, clientHeight } = mapContainer;
    
    // How much do we need to scale the image to fill the container?
    const scaleX = clientWidth / IMAGE_WIDTH;
    const scaleY = clientHeight / IMAGE_HEIGHT;
    const coverScale = Math.max(scaleX, scaleY);
    
    // Leaflet Zoom Formula: scale = 2 ^ zoom
    const calculatedCoverZoom = Math.log2(coverScale);
    coverZoomRef.current = calculatedCoverZoom;
    
    // The point at which dots become visible
    const calculatedThreshold = calculatedCoverZoom + 0.8;
    setZoomThreshold(calculatedThreshold);
    setCurrentZoom(calculatedCoverZoom);

    leafletMap.current = L.map(mapContainer, {
      crs: L.CRS.Simple, 
      minZoom: calculatedCoverZoom - 0.3, // Allow a slight zoom out, but lock it from going too small
      maxZoom: calculatedCoverZoom + 3.5, 
      zoomControl: false,
      maxBounds: bounds, 
      maxBoundsViscosity: 0.8 // Rubber band effect when dragging at edges
    });

    L.imageOverlay(campusMapImage, bounds).addTo(leafletMap.current);
    
    // Set initial view to perfectly cover the container
    leafletMap.current.setView([IMAGE_HEIGHT / 2, IMAGE_WIDTH / 2], calculatedCoverZoom);

    markerLayer.current = L.layerGroup().addTo(leafletMap.current);

    // Track user zooming to trigger dots
    leafletMap.current.on('zoomend', () => {
      setCurrentZoom(leafletMap.current!.getZoom());
    });

    // 🚀 THE ULTIMATE TAGGING ENGINE
    leafletMap.current.on('click', (e) => {
      const y = Math.round(e.latlng.lat);
      const x = Math.round(e.latlng.lng);
      
      const locName = prompt(`You clicked [${y}, ${x}]. \nWhat is the name of this location?`);
      if (locName) {
        L.marker([y, x], { icon: customIcon }).addTo(markerLayer.current!)
          .bindPopup(`<b>${locName}</b><br/>Saved to console!`).openPopup();
        
        const jsonString = `{ 
  id: Math.floor(Math.random() * 10000), 
  name: "${locName}", 
  category: "Misc", 
  short_desc: "Add description...", 
  long_desc: "Add long description...", 
  coords: [${y}, ${x}], 
  rating: 5.0, 
  reviews: 0, 
  image_url: "https://via.placeholder.com/400", 
  open_time: "24/7" 
},`;
        console.log(`\n✅ COPY THIS FOR ${locName.toUpperCase()}:\n`);
        console.log(jsonString);
      }
    });

    return () => { 
      leafletMap.current?.remove(); 
      leafletMap.current = null; 
      userMarkerRef.current = null; // 🚀 Kills the ghost marker so it respawns correctly
    };
  }, []);

  // 2️⃣ DYNAMIC PINS, LOD DOTS & AUTO-ZOOM
  useEffect(() => {
    if (!markerLayer.current || !leafletMap.current) return;
    
    markerLayer.current.clearLayers();

    const isSearchEmpty = searchQuery.trim() === "";
    
    // Level Of Detail (LOD) check: Are we zoomed in enough to see dots?
    const isZoomedIn = currentZoom >= zoomThreshold;
    
    const filtered = LOCATIONS.filter(loc => 
      isSearchEmpty || 
      loc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      loc.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const boundsArr: L.LatLngTuple[] = [];

    filtered.forEach(loc => {
      // Scale coordinates from old 4000x3000 to new 1920x1080
      const scaledY = loc.coords[0] * SCALE_Y;
      const scaledX = loc.coords[1] * SCALE_X;
      const finalCoords: L.LatLngTuple = [scaledY, scaledX];
      
      // If we are idle (no search) and zoomed out, don't render anything!
      if (isSearchEmpty && !isZoomedIn) return;

      boundsArr.push(finalCoords);

      let marker;
      if (isSearchEmpty) {
        // RENDER: Tiny Dots (Color-Coded!)
        marker = L.circleMarker(finalCoords, {
          radius: 5,
          color: '#0f172a', // Heavy dark border
          weight: 2,
          fillColor: getCategoryColor(loc.category),
          fillOpacity: 1
        });
      } else {
        // RENDER: Big Pins when searching
        marker = L.marker(finalCoords, { icon: customIcon });
      }

      const showRating = loc.category !== "Waypoint";

      const popup = document.createElement('div');
      popup.style.cssText = "font-family: ui-sans-serif, system-ui, sans-serif; min-width: 150px; padding: 2px;";
      popup.innerHTML = `
        <h3 style="font-weight: 900; font-size: 15px; margin: 0 0 2px 0; color: #0f172a;">${loc.name}</h3>
        ${showRating ? `<p style="font-size: 12px; color: #475569; margin: 0 0 8px 0;">⭐ ${loc.rating}</p>` : `<div style="height: 8px;"></div>`}
        <button id="btn-details-${loc.id}" style="width: 100%; background: #0f172a; color: #a3e635; border: none; padding: 6px; border-radius: 6px; font-weight: bold; cursor: pointer;">View Details</button>
      `;
      
      marker.bindPopup(popup);
      markerLayer.current?.addLayer(marker);
      
      marker.on('popupopen', () => {
        document.getElementById(`btn-details-${loc.id}`)?.addEventListener('click', () => {
          setSelectedLocation(loc);
          leafletMap.current?.closePopup();
        });
      });
    });

    // CAMERA LOGIC: Panning & Resetting
    if (!isSearchEmpty && boundsArr.length > 0) {
      // User is searching: Fly to results
      leafletMap.current.flyToBounds(L.latLngBounds(boundsArr), { 
        padding: [50, 50], 
        maxZoom: zoomThreshold + 0.8, // Don't zoom in uncomfortably close
        duration: 0.5 
      });
    } else if (isSearchEmpty && prevSearchRef.current !== "") {
      // User just cleared the search: Fly back to standard overview
      leafletMap.current.flyTo([IMAGE_HEIGHT / 2, IMAGE_WIDTH / 2], coverZoomRef.current, { duration: 0.5 });
    }

    prevSearchRef.current = searchQuery;

  }, [searchQuery, currentZoom, zoomThreshold]);

  // 3️⃣ START LIVE GPS
  // 3️⃣ START LIVE GPS WITH MAIN GATE FALLBACK & GEOFENCING
  const handleFindMe = () => {
    setIsLocating(true);

    const fallbackToMainGate = () => {
      // Translate Main Gate (ID: 47) from 4000x3000 to 1920x1080
      const fallbackY = 76 * SCALE_Y;
      const fallbackX = 3893 * SCALE_X;
      
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([fallbackY, fallbackX]);
      } else {
        userMarkerRef.current = L.marker([fallbackY, fallbackX], { icon: stickmanIcon })
          .addTo(leafletMap.current!)
          .bindPopup("<div style='font-family: ui-sans-serif, system-ui; text-align: center;'><b style='color: #0f172a; font-size: 15px;'>📍 You are here!</b><br/><span style='font-size: 11px; color: #64748b; font-weight: bold;'>(Defaulted to Main Gate)</span></div>");
      }

      leafletMap.current?.flyTo([fallbackY, fallbackX], zoomThreshold + 1.5, { animate: true, duration: 1.5 });
      
      setTimeout(() => {
        userMarkerRef.current?.openPopup();
        setIsLocating(false);
      }, 1500); 
    };

    if (!navigator.geolocation) {
      fallbackToMainGate();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        // 🚨 THE GEOFENCE FIX: Check if user is way off-campus 🚨
        const buffer = 0.005; // Roughly a 500-meter buffer around the map
        const isOffCampus = 
          latitude > MAP_CALIBRATION.topLeft.lat + buffer || 
          latitude < MAP_CALIBRATION.bottomRight.lat - buffer || 
          longitude < MAP_CALIBRATION.topLeft.lng - buffer || 
          longitude > MAP_CALIBRATION.bottomRight.lng + buffer;

        if (isOffCampus) {
          console.warn("User is off-campus. Triggering fallback.");
          alert("You appear to be off-campus! Defaulting to Main Gate.");
          fallbackToMainGate();
          return;
        }

        // If physically on campus, proceed normally:
        const [pixelY, pixelX] = convertGPSToPixels(latitude, longitude);

        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng([pixelY, pixelX]);
        } else {
          userMarkerRef.current = L.marker([pixelY, pixelX], { icon: stickmanIcon })
            .addTo(leafletMap.current!)
            .bindPopup("<div style='font-family: ui-sans-serif, system-ui; text-align: center;'><b style='color: #0f172a; font-size: 15px;'>📍 You are here!</b></div>");
        }

        leafletMap.current?.flyTo([pixelY, pixelX], zoomThreshold + 1.5, { animate: true, duration: 1.5 });
        
        setTimeout(() => {
          userMarkerRef.current?.openPopup();
          setIsLocating(false);
        }, 1500);
      },
      (error) => {
        console.warn(`GPS Error: ${error.message}. Defaulting to Main Gate.`);
        fallbackToMainGate();
      },
      { enableHighAccuracy: true, timeout: 5000 } 
    );
  };

  return (
    <div className="relative w-full h-[calc(100vh-11rem)] bg-[#020617] rounded-3xl overflow-hidden shadow-[6px_6px_0px_#000] border-2 border-slate-800 flex flex-col z-10">
      
      {/* 🚀 STACKED HEADER UI (Search no longer overlaps the map!) */}
      <div className="p-3 bg-slate-950 border-b-2 border-slate-800 flex gap-2 shrink-0 z-20">
        <div className="relative flex-1 shadow-[4px_4px_0px_#000] rounded-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" placeholder="Search Campus..." 
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border-2 border-slate-700 text-white rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-lime-400 font-bold"
          />
        </div>
        
        {/* FIND ME BUTTON */}
        <button 
          onClick={handleFindMe}
          className={`w-12 h-12 rounded-xl border-2 shadow-[4px_4px_0px_#000] flex items-center justify-center transition-all ${
            isLocating ? 'bg-slate-700 border-slate-600 text-slate-400 animate-pulse' : 'bg-rose-500 border-slate-900 text-white hover:bg-rose-400 hover:-translate-y-1 hover:shadow-[6px_6px_0px_#000] active:scale-95'
          }`}
        >
          <Navigation2 size={22} className={isLocating ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 🗺️ MAP CONTAINER */}
      <div className="flex-1 relative w-full bg-[#020617] z-10">
        <div ref={mapRef} className="w-full h-full absolute inset-0 outline-none" />
      </div>

      {/* 📄 DETAILS MODAL */}
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
              
              {/* RATING CONDITION: Hidden if category is Waypoint */}
              {selectedLocation.category !== "Waypoint" && (
                <div className="flex items-center gap-1 mt-2 text-lime-400 font-bold">
                  <Star size={16} fill="currentColor" />
                  <span>{selectedLocation.rating} ({selectedLocation.reviews} reviews)</span>
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
                  {selectedLocation.long_desc}
                </p>
              </div>
              
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}