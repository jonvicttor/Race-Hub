'use client';

import { useState, useCallback, useRef } from 'react';
import { Map, X, Zap } from 'lucide-react';

interface MapCroppingViewProps {
  stravaImageUrl: string;
  onCancel: () => void;
  onConfirmCroppedBlob: (blob: Blob) => void;
}

export function MapCroppingView({ stravaImageUrl, onCancel, onConfirmCroppedBlob }: MapCroppingViewProps) {
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleGenerateCroppedMapBlob = useCallback(async () => {
    setLoading(true);

    const img = new Image();
    img.src = stravaImageUrl;
    img.crossOrigin = "Anonymous";

    img.onload = async () => {
      const sx = img.naturalWidth * 0.1; 
      const sy = img.naturalHeight * 0.35; 
      const sWidth = img.naturalWidth * 0.8; 
      const sHeight = img.naturalHeight * 0.45; 

      const canvasCrop = document.createElement('canvas');
      canvasCrop.width = sWidth;
      canvasCrop.height = sHeight;
      const ctxCrop = canvasCrop.getContext('2d');
      if (!ctxCrop) return;

      ctxCrop.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);

      const canvasFinal = canvasRef.current;
      if (!canvasFinal) return;
      canvasFinal.width = 400; 
      canvasFinal.height = 400;
      const ctxFinal = canvasFinal.getContext('2d');
      if (!ctxFinal) return;

      // MAGIA DO PADDING AQUI 👇
      const paddingRatio = 0.75; // Ocupa 75% do canvas final
      const dstWidth = canvasFinal.width * paddingRatio;
      const dstHeight = canvasFinal.height * paddingRatio;
      const dstX = (canvasFinal.width - dstWidth) / 2;
      const dstY = (canvasFinal.height - dstHeight) / 2;

      ctxFinal.drawImage(canvasCrop, 0, 0, sWidth, sHeight, dstX, dstY, dstWidth, dstHeight);

      const imageData = ctxFinal.getImageData(0, 0, canvasFinal.width, canvasFinal.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        if (r > 200 && g < 100 && b < 100 && r > g * 2) {
          data[i] = 209;     
          data[i + 1] = 255; 
          data[i + 2] = 0;   
        } else {
          data[i + 3] = 0; 
        }
      }
      ctxFinal.putImageData(imageData, 0, 0);

      canvasFinal.toBlob((blob) => {
        if (blob) {
          onConfirmCroppedBlob(blob);
        }
        setLoading(false);
      }, 'image/png');
    };
  }, [stravaImageUrl, onConfirmCroppedBlob]);

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-lg z-50 flex items-center justify-center p-4">
      <div className="bg-race-card w-full max-w-lg rounded-3xl p-6 border border-white/10 shadow-2xl relative">
        
        <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
          <h2 className="text-xl font-black uppercase italic text-white flex items-center gap-2">
            <Map size={20} className="text-race-volt" /> Recortar Mapa do Strava
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
        </div>

        <div className="w-full aspect-square bg-[#0a0a0a] rounded-2xl border border-white/5 flex items-center justify-center relative overflow-hidden mb-6">
            <canvas ref={canvasRef} className="w-full h-full object-cover opacity-90 drop-shadow-[0_0_15px_rgba(209,255,0,0.4)] transition-opacity" />
            <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
            <div className="absolute w-3/4 h-1 bg-race-volt rounded-full blur-[1px] rotate-[-15deg]"></div>
        </div>

        <div className="p-3 bg-black rounded-lg border border-white/5 mb-6 text-gray-400">
            <p className="text-[10px] font-bold uppercase mb-2">Print do Strava</p>
            {/* eslint-disable-next-line @next/next/no-img-element */ }
            <img 
                src={stravaImageUrl}
                alt="Print Original do Strava"
                className="w-full max-h-40 object-contain rounded-md border border-white/10"
            />
        </div>

        <div className="flex flex-col gap-3 pt-6 border-t border-dashed border-white/5">
          <button type="button" onClick={handleGenerateCroppedMapBlob} disabled={loading} className="w-full bg-race-volt text-black font-black uppercase italic rounded-xl p-4 hover:bg-opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-1.5">
            <Zap size={14} className={loading ? 'animate-pulse' : 'fill-black'} />
            {loading ? 'Processando Recorte...' : 'Confirmar e Salvar Recorte'}
          </button>
          <button type="button" onClick={onCancel} className="w-full p-3 bg-black border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:scale-105 transition-transform">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}