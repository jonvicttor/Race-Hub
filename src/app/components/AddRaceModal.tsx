'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function AddRaceModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [distance, setDistance] = useState(''); 
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState('A Planejar');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from('races').insert([
        {
          name,
          date,
          distance,
          kit_location: location,
          status,
        },
      ]);

      if (error) throw error;

      setIsOpen(false);
      setName('');
      setDate('');
      setDistance('');
      setLocation('');
      setStatus('A Planejar');

      alert('Corrida adicionada com sucesso! Atualize a página.');
    } catch (error) {
      console.error('Erro ao adicionar corrida:', error);
      alert('Erro ao adicionar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-race-volt text-black p-4 rounded-full shadow-lg hover:scale-105 transition-transform z-50 flex items-center justify-center"
      >
        <Plus size={24} strokeWidth={3} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-race-card w-full max-w-md rounded-3xl p-6 border border-white/10 shadow-2xl">
            
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black uppercase italic text-white">Nova Corrida</h2>
              <button onClick={() => setIsOpen(false)} className="text-gray-400">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold uppercase text-gray-500 tracking-widest block mb-1">Nome da Prova</label>
                <input 
                  type="text" required value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-background border border-white/10 rounded-xl p-3 text-white focus:border-race-volt outline-none"
                  placeholder="Ex: Volta da Pampulha"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-gray-500 tracking-widest block mb-1">Data</label>
                  <input 
                    type="date" required value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-background border border-white/10 rounded-xl p-3 text-white scheme-dark outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-gray-500 tracking-widest block mb-1">Distância (Digite)</label>
                  <input 
                    type="text" required value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    className="w-full bg-background border border-white/10 rounded-xl p-3 text-white focus:border-race-volt outline-none"
                    placeholder="Ex: 21KM"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-xs font-bold uppercase text-gray-500 tracking-widest block mb-1">Local/Kit</label>
                    <input 
                      type="text" value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full bg-background border border-white/10 rounded-xl p-3 text-white outline-none"
                      placeholder="Recife - PE"
                    />
                 </div>
                 <div>
                    <label className="text-xs font-bold uppercase text-gray-500 tracking-widest block mb-1">Status</label>
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
              </div>

              <button 
                type="submit" disabled={loading}
                className="w-full bg-race-volt text-black font-black uppercase italic rounded-xl p-4 mt-2 hover:bg-opacity-90 disabled:opacity-50"
              >
                {loading ? 'Salvando...' : 'Adicionar ao Calendário'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}