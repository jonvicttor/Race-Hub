'use client';

import { useState, ChangeEvent } from 'react';
import { X, Save, Trash2, Timer, Zap, Calculator, Link2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Race {
  id: string;
  name: string;
  date: string;
  distance: string;
  status: string;
  finish_time?: string;
  pace?: string;
  registration_link?: string; 
  event_location?: string;
  price?: string | number | null; 
  activity_type?: string;
}

interface EditRaceModalProps {
  race: Race;
  onClose: () => void;
  onUpdate: () => void;
}

export function EditRaceModal({ race, onClose, onUpdate }: EditRaceModalProps) {
  const [loading, setLoading] = useState(false);
  
  const initialDateParts = race.date ? race.date.split('-') : [];
  const initialDate = initialDateParts.length === 3 ? `${initialDateParts[2]}/${initialDateParts[1]}/${initialDateParts[0]}` : '';

  const [name, setName] = useState(race.name || '');
  const [date, setDate] = useState(initialDate);
  const [distance, setDistance] = useState(race.distance ? race.distance.replace(/[^\d.,]/g, '') : '');
  const [status, setStatus] = useState(race.status || 'A Planejar');
  const [finishTime, setFinishTime] = useState(race.finish_time || '');
  const [pace, setPace] = useState(race.pace || '');
  const [registrationLink, setRegistrationLink] = useState(race.registration_link || '');
  const [eventLocation, setEventLocation] = useState(race.event_location || '');
  const [price, setPrice] = useState(race.price ? String(race.price).replace('.', ',') : '');

  const handleDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); 
    if (value.length > 2) value = value.substring(0, 2) + '/' + value.substring(2);
    if (value.length > 5) value = value.substring(0, 5) + '/' + value.substring(5, 9);
    setDate(value);
  };

  const handleTimeChange = (e: ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 6) v = v.substring(0, 6);
    if (v.length >= 5) v = `${v.substring(0, 2)}:${v.substring(2, 4)}:${v.substring(4)}`;
    else if (v.length >= 3) v = `${v.substring(0, 2)}:${v.substring(2)}`;
    setFinishTime(v);
  };

  const handlePaceChange = (e: ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 4) v = v.substring(0, 4);
    if (v.length >= 3) v = `${v.substring(0, 2)}:${v.substring(2)}`;
    setPace(v);
  };

  const handleCalculatePace = () => {
    if (!finishTime || !distance) {
      alert("Preencha o Tempo Final e a Distância primeiro.");
      return;
    }
    const distKm = parseFloat(distance.replace(',', '.'));
    if (isNaN(distKm)) return;

    const parts = finishTime.split(':').map(Number);
    let totalMinutes = 0;

    if (parts.length === 3) totalMinutes = (parts[0] * 60) + parts[1] + (parts[2] / 60);
    else if (parts.length === 2) totalMinutes = parts[0] + (parts[1] / 60);
    else return;

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
      setLoading(false); return;
    }

    const [day, month, year] = date.split('/');
    const formattedDateForDB = `${year}-${month}-${day}`;
    const numericPrice = price.trim() === '' ? null : parseFloat(price.replace(',', '.'));
    
    const numericDist = parseFloat(distance.replace(',', '.'));
    const finalDistance = isNaN(numericDist) ? distance : `${numericDist.toFixed(2)} KM`;
    
    try {
      const { error } = await supabase
        .from('races')
        .update({
          name: name,
          date: formattedDateForDB,
          distance: finalDistance,
          status: status,
          finish_time: status === 'Concluído' ? finishTime : null,
          pace: status === 'Concluído' ? pace : null,
          registration_link: registrationLink,
          event_location: eventLocation,
          price: numericPrice
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
    if (!confirm(`Deseja realmente excluir a atividade "${race.name}"?`)) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('races').delete().eq('id', race.id);
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-10 sm:pt-24">
      <div className="bg-race-card w-full max-w-md rounded-3xl p-6 border border-white/10 shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black uppercase italic text-white">Editar Atividade</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
        </div>

        <form onSubmit={handleUpdate} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold uppercase text-gray-500 tracking-widest block mb-1">Nome</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-background border border-white/10 rounded-xl p-3 text-white focus:border-race-volt outline-none transition-colors" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase text-gray-500 tracking-widest block mb-1">Data</label>
              <input type="text" required maxLength={10} value={date} onChange={handleDateChange} className="w-full bg-background border border-white/10 rounded-xl p-3 text-white focus:border-race-volt outline-none transition-colors placeholder:text-gray-600" placeholder="DD/MM/AAAA" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-gray-500 tracking-widest block mb-1">Distância</label>
              <div className="relative">
                <input type="text" required value={distance} onChange={(e) => setDistance(e.target.value.replace(/[^\d.,]/g, ''))} className="w-full bg-background border border-white/10 rounded-xl p-3 pr-10 text-white focus:border-race-volt outline-none transition-colors" placeholder="Ex: 21" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs uppercase tracking-widest">KM</span>
              </div>
            </div>
          </div>

          {(status === 'Concluído' || race.activity_type === 'treino') && (
            <div className="flex flex-col gap-4 p-4 bg-black/30 border border-white/5 rounded-2xl animate-in fade-in slide-in-from-top-2">
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 flex items-center gap-1"><Timer size={12} /> Tempo</label>
                  <input type="text" value={finishTime} onChange={handleTimeChange} className="w-full bg-background border border-white/10 rounded-xl p-3 text-white outline-none focus:border-race-volt" placeholder="00:55:00" />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500 flex items-center gap-1"><Zap size={12} /> Pace</label>
                    <button type="button" onClick={handleCalculatePace} className="text-[9px] bg-race-volt/20 text-race-volt px-2 py-0.5 rounded flex items-center gap-1 hover:bg-race-volt hover:text-black transition-colors"><Calculator size={10} /> Auto</button>
                  </div>
                  <input type="text" value={pace} onChange={handlePaceChange} className="w-full bg-background border border-white/10 rounded-xl p-3 text-white outline-none focus:border-race-volt" placeholder="05:30" />
                </div>
              </div>
            </div>
          )}

          {race.activity_type === 'prova' && (
             <div className="flex flex-col gap-4">
               <div>
                 <label className="text-xs font-bold uppercase text-gray-500 block mb-1">Status da Prova</label>
                 <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full bg-background border border-white/10 rounded-xl p-3 text-white outline-none focus:border-race-volt transition-colors">
                   <option value="A Planejar">A Planejar</option>
                   <option value="Inscrito">Inscrito</option>
                   <option value="Concluído">Concluído</option>
                 </select>
               </div>
               {status !== 'Concluído' && (
                 <>
                   <div>
                     <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest mb-1 flex items-center gap-1"><Link2 size={12} /> Link de Inscrição</label>
                     <input type="url" value={registrationLink} onChange={(e) => setRegistrationLink(e.target.value)} className="w-full bg-background border border-white/10 rounded-xl p-3 text-white focus:border-race-volt outline-none text-sm" placeholder="https://..." />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="text-xs font-bold uppercase text-gray-500 tracking-widest block mb-1">Local</label>
                        <input type="text" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} className="w-full bg-background border border-white/10 rounded-xl p-3 text-white outline-none transition-colors" />
                     </div>
                     <div>
                        <label className="text-xs font-bold uppercase text-gray-500 tracking-widest block mb-1">Valor</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">R$</span>
                          <input type="text" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, ''))} className="w-full bg-background border border-white/10 rounded-xl p-3 pl-10 text-white outline-none focus:border-race-volt" placeholder="0,00" />
                        </div>
                     </div>
                  </div>
                 </>
               )}
             </div>
          )}

          <div className="flex gap-3 mt-4">
            <button type="button" onClick={handleDelete} disabled={loading} className="flex-1 bg-red-500/10 text-red-500 border border-red-500/20 font-bold uppercase text-xs rounded-xl p-4 flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition-all">
              <Trash2 size={18} /> Apagar
            </button>
            <button type="submit" disabled={loading} className="flex-2 bg-race-volt text-black font-black uppercase italic rounded-xl p-4 flex items-center justify-center gap-2 shadow-lg shadow-race-volt/10 hover:bg-opacity-90 transition-opacity">
              <Save size={20} /> {loading ? '...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}