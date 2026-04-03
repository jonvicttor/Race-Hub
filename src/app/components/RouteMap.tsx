'use client';

import { useMemo } from 'react';
import { MapContainer, TileLayer, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const decodePolyline = (str: string) => {
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
    
    // 👇 Corrigido: Variáveis separadas para o ESLint ficar feliz
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
};

export default function RouteMap({ polyline }: { polyline: string }) {
  const coords = useMemo(() => decodePolyline(polyline), [polyline]);

  if (!coords || coords.length === 0) return null;

  const lats = coords.map(c => c[0]);
  const lngs = coords.map(c => c[1]);
  const bounds: [number, number][] = [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)]
  ];

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer 
        bounds={bounds} 
        boundsOptions={{ padding: [20, 14] }} 
        zoomControl={false} 
        scrollWheelZoom={false}
        dragging={false}
        attributionControl={false} // 👇 Comando que desliga a marca d'água
        className="w-full h-full rounded-xl bg-[#121212]"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
        />
        <Polyline 
          positions={coords} 
          pathOptions={{ color: '#d1ff00', weight: 4, opacity: 0.8, lineCap: 'round' }} 
        />
      </MapContainer>
    </div>
  );
}