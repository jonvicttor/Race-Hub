import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get('name') || 'Treino Concluído';
    const distance = searchParams.get('distance') || '0 KM';
    const time = searchParams.get('time') || '--:--:--';
    const pace = searchParams.get('pace') || '--/km';
    const polyline = searchParams.get('polyline');

    let points = '';
    
    if (polyline) {
      const coords = decodePolyline(polyline);
      if (coords.length > 0) {
        const lats = coords.map(c => c[0]);
        const lngs = coords.map(c => c[1]);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);

        const latRange = maxLat - minLat || 0.01;
        const lngRange = maxLng - minLng || 0.01;
        
        const width = 800; 
        const height = 500; 

        points = coords.map(([lat, lng]) => {
          const x = ((lng - minLng) / lngRange) * width;
          const y = height - ((lat - minLat) / latRange) * height; 
          return `${x},${y}`;
        }).join(' ');
      }
    }

    return new ImageResponse(
      (
        <div style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          width: '100%', height: '100%', 
          backgroundColor: 'transparent', // 👈 Fundo Transparente!
          color: '#ffffff',
          padding: '80px', fontFamily: 'sans-serif'
        }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff', letterSpacing: '4px', textTransform: 'uppercase', textShadow: '0px 4px 20px rgba(0,0,0,0.9)' }}>
                  COMPARTILHAMENTO
                </span>
                <h1 style={{ fontSize: '64px', fontWeight: '900', fontStyle: 'italic', margin: 0, textTransform: 'uppercase', letterSpacing: '-2px', textShadow: '0px 4px 30px rgba(0,0,0,0.9)' }}>
                  RACE <span style={{ color: '#d1ff00' }}>HUB</span>
                </h1>
              </div>
           </div>

           <div style={{ display: 'flex', fontSize: '72px', fontWeight: '900', fontStyle: 'italic', textTransform: 'uppercase', marginTop: '20px', lineHeight: '1.1', textShadow: '0px 4px 30px rgba(0,0,0,0.9)' }}>
              {name}
           </div>

           <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%', margin: '40px 0' }}>
              {polyline && points ? (
                <svg viewBox="-20 -20 840 540" width="100%" height="100%" style={{ display: 'flex', filter: 'drop-shadow(0 0 25px rgba(0,0,0,0.8)) drop-shadow(0 0 10px rgba(209,255,0,0.8))' }}>
                  <polyline points={points} fill="none" stroke="#d1ff00" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <div style={{ display: 'flex', color: '#fff', fontSize: '40px', fontStyle: 'italic', fontWeight: 'bold', textShadow: '0px 4px 20px rgba(0,0,0,0.9)' }}>
                  Rota Indisponível
                </div>
              )}
           </div>

           <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '50px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '28px', color: '#fff', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 'bold', marginBottom: '10px', textShadow: '0px 4px 20px rgba(0,0,0,0.9)' }}>Distância</span>
                <span style={{ fontSize: '72px', fontWeight: '900', color: '#d1ff00', fontStyle: 'italic', lineHeight: '1', textShadow: '0px 4px 30px rgba(0,0,0,0.9)' }}>{distance}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '28px', color: '#fff', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 'bold', marginBottom: '10px', textShadow: '0px 4px 20px rgba(0,0,0,0.9)' }}>Tempo</span>
                <span style={{ fontSize: '72px', fontWeight: '900', color: '#fff', fontStyle: 'italic', lineHeight: '1', textShadow: '0px 4px 30px rgba(0,0,0,0.9)' }}>{time}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '28px', color: '#fff', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 'bold', marginBottom: '10px', textShadow: '0px 4px 20px rgba(0,0,0,0.9)' }}>Pace</span>
                <span style={{ fontSize: '72px', fontWeight: '900', color: '#fff', fontStyle: 'italic', lineHeight: '1', textShadow: '0px 4px 30px rgba(0,0,0,0.9)' }}>{pace}</span>
              </div>
           </div>
        </div>
      ),
      {
        width: 1080,
        height: 1080,
      }
    );
  } catch (error) {
    console.error(error);
    return new Response('Failed to generate image', { status: 500 });
  }
}