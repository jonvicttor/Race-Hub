'use client';

import { useState } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Race {
  id: string;
  name: string;
  date: string;
  distance: string;
  status: string;
  kit_location: string;
  kit_datetime?: string;
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

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('races')
        .update({
          kit_location: kitLocation,
          kit_datetime: kitDatetime,
          status: status
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
      <div className="bg-race-card w-full max-w-md rounded-3xl p-6 border border-white/10 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black uppercase italic text-white">Editar Prova</h2>
          <button onClick={onClose} className="text-gray-400"><X size={24} /></button>
        </div>

        <form onSubmit={handleUpdate} className="flex flex-col gap-4">
          <p className="text-race-volt font-bold text-sm uppercase">{race.name}</p>
          
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

          <div>
            <label className="text-xs font-bold uppercase text-gray-500 block mb-1">Status</label>
            <select 
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-background border border-white/10 rounded-xl p-3 text-white outline-none"
            >
              <option value="A Planejar">A Planejar</option>
              <option value="Inscrito">Inscrito</option>
              <option value="Concluído">Concluído</option>
            </select>
          </div>

          <div className="flex gap-3 mt-2">
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
              className="flex-2 bg-race-volt text-black font-black uppercase italic rounded-xl p-4 flex items-center justify-center gap-2"
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