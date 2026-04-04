'use client';

import { useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Função Mágica que Descriptografa a Rota do Strava
const decodePolyline = (str: string) => {
  if (!str || typeof str !== 'string') return [];
  
  try {
    let index = 0, lat = 0, lng = 0;
    const coordinates: [number, number][] = [];
    while (index < str.length) {
      let b, shift = 0, result = 0;
      do {
        b = str.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;
      shift = 0;
      result = 0;
      do {
        b = str.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;
      coordinates.push([lat / 1e5, lng / 1e5]);
    }
    return coordinates;
  } catch (error) {
    console.error('Erro silencioso evitado ao decodificar rota:', error);
    return [];
  }
};

// Componente inteligente para forçar o zoom certinho com respiro (Padding)
function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  
  useEffect(() => {
    if (coords.length > 0) {
      const bounds = L.latLngBounds(coords);
      // 👇 Aumentamos o padding aqui para [40, 40] para dar mais folga nas bordas
      map.fitBounds(bounds, { 
        padding: [40, 40], 
        animate: false // Desativa animação para carregar o enquadramento instantaneamente
      });
    }
  }, [map, coords]);
  
  return null;
}

interface RouteMapProps {
  polyline: string;
}

export default function RouteMap({ polyline }: RouteMapProps) {
  const coords = useMemo(() => decodePolyline(polyline), [polyline]);
  
  if (!coords || coords.length === 0) {
    return <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-600 uppercase tracking-widest font-bold">Sem Rota GPS</div>;
  }

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer 
        center={coords[0]} 
        zoom={13} 
        scrollWheelZoom={false} 
        zoomControl={false}     
        dragging={false}        
        doubleClickZoom={false}
        touchZoom={false}
        attributionControl={false}
        className="w-full h-full rounded-xl z-0 bg-[#121212]!" 
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        <Polyline 
          positions={coords} 
          pathOptions={{ 
            color: '#d1ff00', 
            weight: 4,
            opacity: 1,
            lineCap: 'round',
            lineJoin: 'round'
          }} 
        />
        
        <FitBounds coords={coords} />
      </MapContainer>

      <div className="absolute inset-0 z-10 pointer-events-none"></div>
    </div>
  );
}