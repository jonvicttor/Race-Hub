'use client';

import { useMemo } from 'react';

// Função Mágica que Descriptografa a Rota do Strava
const decodePolyline = (str: string) => {
  let index = 0, lat = 0, lng = 0;
  const coordinates = [];
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
};

interface RouteMapProps {
  polyline: string;
}

export default function RouteMap({ polyline }: RouteMapProps) {
  const coords = useMemo(() => decodePolyline(polyline), [polyline]);
  
  if (!coords || coords.length === 0) return null;

  const lats = coords.map(c => c[0]);
  const lngs = coords.map(c => c[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latRange = maxLat - minLat || 0.01;
  const lngRange = maxLng - minLng || 0.01;
  
  const width = 100;
  const height = (latRange / lngRange) * 100;

  const points = coords.map(([lat, lng]) => {
    const x = ((lng - minLng) / lngRange) * width;
    const y = height - ((lat - minLat) / latRange) * height; 
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`-5 -5 ${width + 10} ${height + 10}`} className="w-full h-full drop-shadow-[0_0_5px_rgba(209,255,0,0.8)] overflow-visible">
      <polyline 
        points={points} 
        fill="none" 
        stroke="#d1ff00" 
        strokeWidth="4" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        vectorEffect="non-scaling-stroke" 
      />
    </svg>
  );
}