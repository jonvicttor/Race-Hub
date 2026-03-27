'use client';

import { useState } from 'react';
import { X, Save, Trash2, Timer, Zap, Calculator } from 'lucide-react'; // Calculator adicionado
import { supabase } from '../lib/supabase';

interface Race {
  id: string;
  name: string;
  date: string;
  distance: string;
  status: string;
  kit_location: string;
  kit_datetime?: string;
  finish_time?: string;
  pace?: string;
}

interface EditRaceModalProps {
  race: Race;
  onClose: () => void;
  onUpdate: () => void;
}

export function EditRaceModal({ race, onClose, onUpdate }: EditRaceModalProps) {
  const [loading, setLoading] = useState(false);
  const [kitLocation, setKitLocation] = useState(race.kit_location || '');
  const [kitDatetime, setKitDatetime] = useState(race.kit_datetime || '');
  const [status, setStatus] = useState(race.status || 'A Planejar');
  
  const [finishTime, setFinishTime] = useState(race.finish_time || '');
  const [pace, setPace] = useState(race.pace || '');

  // FUNÇÃO NOVA: Calcula o Pace com base no tempo e distância
  const handleCalculatePace = () => {
    if (!finishTime || !race.distance) {
      alert("Preencha o Tempo Final primeiro (ex: 00:55:00 ou 55:00)");
      return;
    }

    // Tenta extrair apenas os números da distância (ex: "5km" -> 5)
    const distMatch = race.distance.match(/[\d.]+/);
    if (!distMatch) return;
    const distKm = parseFloat(distMatch[0]);

    // Separa as horas, minutos e segundos
    const parts = finishTime.split(':').map(Number);
    let totalMinutes = 0;

    if (parts.length === 3) { // Formato HH:MM:SS
      totalMinutes = (parts[0] * 60) + parts[1] + (parts[2] / 60);
    } else if (parts.length === 2) { // Formato MM:SS
      totalMinutes = parts[0] + (parts[1] / 60);
    } else {
      alert("Use o formato HH:MM:SS ou MM:SS");
      return;
    }

    // Calcula minutos por km
    const paceDecimal = totalMinutes / distKm;
    const paceMinutes = Math.floor(paceDecimal);
    const paceSeconds = Math.round((paceDecimal - paceMinutes) * 60);

    // Formata bonitinho com zeros à esquerda
    setPace(`${String(paceMinutes).padStart(2, '0')}:${String(paceSeconds).padStart(2, '0')}`);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('races')
        .update({
          kit_location: kitLocation,
          kit_datetime: kitDatetime,
          status: status,
          finish_time: status === 'Concluído' ? finishTime : null,
          pace: status === 'Concluído' ? pace : null,
        })
        .eq('id', race.id);

      if (error) throw error;
      onUpdate();
      onClose();
    } catch (error) {
      console.error(error);
      alert('Erro ao atualizar.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Deseja realmente excluir a corrida "${race.name}"?`)) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('races')
        .delete()
        .eq('id', race.id);

      if (error) throw error;
      onUpdate();
      onClose();
    } catch (error) {
      console.error(error);
      alert('Erro ao excluir.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-race-card w-full max-w-md rounded-3xl p-6 border border-white/10 shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black uppercase italic text-white">Editar Prova</h2>
          <button onClick={onClose} className="text-gray-400"><X size={24} /></button>
        </div>

        <form onSubmit={handleUpdate} className="flex flex-col gap-4">
          <p className="text-race-volt font-bold text-sm uppercase">{race.name} - {race.distance}</p>
          
          <div>
            <label className="text-xs font-bold uppercase text-gray-500 block mb-1">Status da Prova</label>
            <select 
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-background border border-white/10 rounded-xl p-3 text-white outline-none focus:border-race-volt"
            >
              <option value="A Planejar">A Planejar</option>
              <option value="Inscrito">Inscrito</option>
              <option value="Concluído">Concluído</option>
            </select>
          </div>

          {status === 'Concluído' && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-race-volt/5 border border-race-volt/20 rounded-2xl animate-in fade-in slide-in-from-top-2">
              <div>
                <label className="text-[10px] font-bold uppercase text-race-volt mb-1 flex items-center gap-1">
                  <Timer size={12} /> Tempo Final
                </label>
                <input 
                  type="text" 
                  value={finishTime}
                  onChange={(e) => setFinishTime(e.target.value)}
                  className="w-full bg-background border border-white/10 rounded-xl p-3 text-white outline-none focus:border-race-volt"
                  placeholder="00:55:00"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-bold uppercase text-race-volt flex items-center gap-1">
                    <Zap size={12} /> Pace (min/km)
                  </label>
                  {/* Botão Calculadora Automática */}
                  <button 
                    type="button" 
                    onClick={handleCalculatePace}
                    className="text-[9px] bg-race-volt/20 text-race-volt px-2 py-0.5 rounded flex items-center gap-1 hover:bg-race-volt hover:text-black transition-colors"
                  >
                    <Calculator size={10} /> Auto
                  </button>
                </div>
                <input 
                  type="text" 
                  value={pace}
                  onChange={(e) => setPace(e.target.value)}
                  className="w-full bg-background border border-white/10 rounded-xl p-3 text-white outline-none focus:border-race-volt"
                  placeholder="05:30"
                />
              </div>
            </div>
          )}

          <div className="border-t border-white/5 my-2 pt-4 flex flex-col gap-4">
            <div>
              <label className="text-xs font-bold uppercase text-gray-500 block mb-1">Local de Retirada do Kit</label>
              <input 
                type="text" 
                value={kitLocation}
                onChange={(e) => setKitLocation(e.target.value)}
                className="w-full bg-background border border-white/10 rounded-xl p-3 text-white outline-none focus:border-race-volt"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-gray-500 block mb-1">Data e Hora do Kit</label>
              <input 
                type="text" 
                value={kitDatetime}
                onChange={(e) => setKitDatetime(e.target.value)}
                className="w-full bg-background border border-white/10 rounded-xl p-3 text-white outline-none focus:border-race-volt"
                placeholder="Ex: 14/08 às 10h"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button 
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="flex-1 bg-red-500/10 text-red-500 border border-red-500/20 font-bold uppercase text-xs rounded-xl p-4 flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition-all"
            >
              <Trash2 size={18} />
              Excluir
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="flex-2 bg-race-volt text-black font-black uppercase italic rounded-xl p-4 flex items-center justify-center gap-2 shadow-lg shadow-race-volt/10"
            >
              <Save size={20} />
              {loading ? '...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}