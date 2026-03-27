'use client';

import { useState } from 'react';
import { X, Save, Trash2, Timer, Zap, Calculator, Link2 } from 'lucide-react';
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
  registration_link?: string; 
  event_location?: string;
  price?: string | number | null; 
}

interface EditRaceModalProps {
  race: Race;
  onClose: () => void;
  onUpdate: () => void;
}

export function EditRaceModal({ race, onClose, onUpdate }: EditRaceModalProps) {
  const [loading, setLoading] = useState(false);
  
  // Transforma a data do banco (AAAA-MM-DD) para DD/MM/AAAA no input
  const initialDateParts = race.date ? race.date.split('-') : [];
  const initialDate = initialDateParts.length === 3 ? `${initialDateParts[2]}/${initialDateParts[1]}/${initialDateParts[0]}` : '';

  const [name, setName] = useState(race.name || '');
  const [date, setDate] = useState(initialDate);
  const [distance, setDistance] = useState(race.distance || '');

  const [kitLocation, setKitLocation] = useState(race.kit_location || '');
  const [kitDatetime, setKitDatetime] = useState(race.kit_datetime || '');
  const [status, setStatus] = useState(race.status || 'A Planejar');
  
  const [finishTime, setFinishTime] = useState(race.finish_time || '');
  const [pace, setPace] = useState(race.pace || '');
  const [registrationLink, setRegistrationLink] = useState(race.registration_link || '');
  const [eventLocation, setEventLocation] = useState(race.event_location || '');
  
  const initialPrice = race.price ? String(race.price).replace('.', ',') : '';
  const [price, setPrice] = useState(initialPrice);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); 
    if (value.length > 2) value = value.substring(0, 2) + '/' + value.substring(2);
    if (value.length > 5) value = value.substring(0, 5) + '/' + value.substring(5, 9);
    setDate(value);
  };

  const handleCalculatePace = () => {
    if (!finishTime || !distance) {
      alert("Preencha o Tempo Final e a Distância primeiro (ex: 00:55:00 ou 55:00)");
      return;
    }

    const distMatch = distance.match(/[\d.]+/);
    if (!distMatch) return;
    const distKm = parseFloat(distMatch[0]);

    const parts = finishTime.split(':').map(Number);
    let totalMinutes = 0;

    if (parts.length === 3) { 
      totalMinutes = (parts[0] * 60) + parts[1] + (parts[2] / 60);
    } else if (parts.length === 2) { 
      totalMinutes = parts[0] + (parts[1] / 60);
    } else {
      alert("Use o formato HH:MM:SS ou MM:SS");
      return;
    }

    const paceDecimal = totalMinutes / distKm;
    const paceMinutes = Math.floor(paceDecimal);
    const paceSeconds = Math.round((paceDecimal - paceMinutes) * 60);

    setPace(`${String(paceMinutes).padStart(2, '0')}:${String(paceSeconds).padStart(2, '0')}`);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (date.length !== 10) {
      alert('Por favor, preencha a data completa no formato DD/MM/AAAA.');
      setLoading(false);
      return;
    }

    const [day, month, year] = date.split('/');
    const formattedDateForDB = `${year}-${month}-${day}`;
    const numericPrice = price.trim() === '' ? null : parseFloat(price.replace(',', '.'));

    try {
      const { error } = await supabase
        .from('races')
        .update({
          name: name,
          date: formattedDateForDB,
          distance: distance,
          kit_location: kitLocation,
          kit_datetime: kitDatetime,
          status: status,
          finish_time: status === 'Concluído' ? finishTime : null,
          pace: status === 'Concluído' ? pace : null,
          registration_link: registrationLink,
          event_location: eventLocation,
          price: numericPrice,
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
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
        </div>

        <form onSubmit={handleUpdate} className="flex flex-col gap-4">
          
          {/* CAMPOS LIBERADOS PARA EDIÇÃO 👇 */}
          <div>
            <label className="text-xs font-bold uppercase text-gray-500 tracking-widest block mb-1">Nome da Prova</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-background border border-white/10 rounded-xl p-3 text-white focus:border-race-volt outline-none transition-colors" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase text-gray-500 tracking-widest block mb-1">Data</label>
              <input 
                type="text" 
                required 
                maxLength={10}
                value={date} 
                onChange={handleDateChange} 
                className="w-full bg-background border border-white/10 rounded-xl p-3 text-white focus:border-race-volt outline-none transition-colors placeholder:text-gray-600" 
                placeholder="DD/MM/AAAA"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-gray-500 tracking-widest block mb-1">Distância</label>
              <input type="text" required value={distance} onChange={(e) => setDistance(e.target.value)} className="w-full bg-background border border-white/10 rounded-xl p-3 text-white focus:border-race-volt outline-none transition-colors" placeholder="Ex: 21KM" />
            </div>
          </div>
          {/* 👆 FIM DOS CAMPOS LIBERADOS */}
          
          <div>
            <label className="text-xs font-bold uppercase text-gray-500 block mb-1">Status da Prova</label>
            <select 
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-background border border-white/10 rounded-xl p-3 text-white outline-none focus:border-race-volt transition-colors"
            >
              <option value="A Planejar">A Planejar</option>
              <option value="Inscrito">Inscrito</option>
              <option value="Concluído">Concluído</option>
            </select>
          </div>

          {status !== 'Concluído' && (
             <div className="flex flex-col gap-4">
               <div>
                 <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest mb-1 flex items-center gap-1">
                   <Link2 size={12} /> Link de Inscrição
                 </label>
                 <input 
                   type="url" value={registrationLink}
                   onChange={(e) => setRegistrationLink(e.target.value)}
                   className="w-full bg-background border border-white/10 rounded-xl p-3 text-white focus:border-race-volt outline-none transition-colors text-sm"
                   placeholder="https://..."
                 />
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-xs font-bold uppercase text-gray-500 tracking-widest block mb-1">Local do Evento</label>
                    <input 
                      type="text" value={eventLocation}
                      onChange={(e) => setEventLocation(e.target.value)}
                      className="w-full bg-background border border-white/10 rounded-xl p-3 text-white outline-none transition-colors"
                      placeholder="Ex: Olinda - PE"
                    />
                 </div>
                 <div>
                    <label className="text-xs font-bold uppercase text-gray-500 tracking-widest block mb-1">Valor</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">R$</span>
                      <input 
                        type="text" value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full bg-background border border-white/10 rounded-xl p-3 pl-10 text-white outline-none transition-colors focus:border-race-volt"
                        placeholder="0,00"
                      />
                    </div>
                 </div>
              </div>
             </div>
          )}

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
                  className="w-full bg-background border border-white/10 rounded-xl p-3 text-white outline-none focus:border-race-volt transition-colors"
                  placeholder="00:55:00"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-bold uppercase text-race-volt flex items-center gap-1">
                    <Zap size={12} /> Pace (min/km)
                  </label>
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
                  className="w-full bg-background border border-white/10 rounded-xl p-3 text-white outline-none focus:border-race-volt transition-colors"
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
                className="w-full bg-background border border-white/10 rounded-xl p-3 text-white outline-none focus:border-race-volt transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-gray-500 block mb-1">Data e Hora do Kit</label>
              <input 
                type="text" 
                value={kitDatetime}
                onChange={(e) => setKitDatetime(e.target.value)}
                className="w-full bg-background border border-white/10 rounded-xl p-3 text-white outline-none focus:border-race-volt transition-colors"
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
              className="flex-2 bg-race-volt text-black font-black uppercase italic rounded-xl p-4 flex items-center justify-center gap-2 shadow-lg shadow-race-volt/10 hover:bg-opacity-90 transition-opacity"
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