'use client';

import { useState, ChangeEvent } from 'react';
import { Plus, X, Link2, Timer, Zap, Calculator, FileBadge, Activity, Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function AddRaceModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activityType, setActivityType] = useState<'prova' | 'treino'>('prova');

  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [distance, setDistance] = useState(''); 
  const [status, setStatus] = useState('A Planejar');
  const [registrationLink, setRegistrationLink] = useState(''); 
  const [eventLocation, setEventLocation] = useState(''); 
  const [price, setPrice] = useState(''); 
  const [finishTime, setFinishTime] = useState('');
  const [pace, setPace] = useState('');
  const [file, setFile] = useState<File | null>(null);

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
      alert("Preencha o Tempo Final e a Distância primeiro (ex: 00:55:00 e 10)");
      return;
    }
    const distKm = parseFloat(distance.replace(',', '.'));
    if (isNaN(distKm) || distKm === 0) return;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (date.length !== 10) {
      alert('Por favor, preencha a data completa no formato DD/MM/AAAA.');
      setLoading(false); return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [day, month, year] = date.split('/');
    const formattedDateForDB = `${year}-${month}-${day}`;
    const numericPrice = price.trim() === '' ? null : parseFloat(price.replace(',', '.'));
    
    let certificateUrl = null;

    try {
      if (status === 'Concluído' && activityType === 'prova' && file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `cert_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('certificates').upload(fileName, file);
        if (uploadError) throw new Error('Erro no certificado.');
        certificateUrl = supabase.storage.from('certificates').getPublicUrl(fileName).data.publicUrl;
      }

      const finalStatus = activityType === 'treino' ? 'Concluído' : status;
      
      const numericDist = parseFloat(distance.replace(',', '.'));
      const finalDistance = isNaN(numericDist) ? distance : `${numericDist.toFixed(2)} KM`;

      const { error } = await supabase.from('races').insert([
        {
          user_id: user.id, 
          name, 
          date: formattedDateForDB, 
          distance: finalDistance,
          status: finalStatus, 
          registration_link: registrationLink,
          event_location: eventLocation, 
          price: numericPrice,
          finish_time: finalStatus === 'Concluído' ? finishTime : null,
          pace: finalStatus === 'Concluído' ? pace : null,
          certificate_url: certificateUrl,
          activity_type: activityType
        },
      ]);

      if (error) throw error;
      resetStates();
      setIsOpen(false);
      window.location.reload(); 
    } catch (error: unknown) {
      console.error(error);
      alert('Erro ao adicionar atividade.');
    } finally {
      setLoading(false);
    }
  };

  const resetStates = () => {
    setName(''); setDate(''); setDistance(''); setStatus('A Planejar');
    setRegistrationLink(''); setEventLocation(''); setPrice('');
    setFinishTime(''); setPace(''); setFile(null);
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="bg-race-volt text-black px-3 py-2 rounded-xl font-bold uppercase text-[10px] tracking-widest flex items-center gap-1 hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-race-volt/20">
        <Plus size={14} strokeWidth={3} /> ADD
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-10 sm:pt-24">
          <div className="bg-race-card w-full max-w-md rounded-3xl p-6 border border-white/10 shadow-2xl overflow-y-auto max-h-[85vh]">
            
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black uppercase italic text-white flex items-center gap-2">
                {activityType === 'treino' ? <Activity className="text-race-volt" /> : <Trophy className="text-race-volt" />}
                Adicionar Atividade
              </h2>
              <button onClick={() => { resetStates(); setIsOpen(false); }} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              
              <div className="flex bg-background border border-white/10 rounded-xl p-1 mb-2">
                <button type="button" onClick={() => setActivityType('prova')} className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${activityType === 'prova' ? 'bg-race-volt text-black' : 'text-gray-500 hover:text-white'}`}>
                  🏁 Prova
                </button>
                <button type="button" onClick={() => { setActivityType('treino'); setStatus('Concluído'); }} className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${activityType === 'treino' ? 'bg-race-volt text-black' : 'text-gray-500 hover:text-white'}`}>
                  👟 Treino
                </button>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-gray-500 tracking-widest block mb-1">
                  {activityType === 'treino' ? 'Nome do Treino' : 'Nome da Prova'}
                </label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-background border border-white/10 rounded-xl p-3 text-white focus:border-race-volt outline-none transition-colors" placeholder={activityType === 'treino' ? "Ex: Rodagem Leve..." : "Ex: Volta da Pampulha"} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-gray-500 tracking-widest block mb-1">Data</label>
                  <input type="text" required maxLength={10} value={date} onChange={handleDateChange} className="w-full bg-background border border-white/10 rounded-xl p-3 text-white focus:border-race-volt outline-none transition-colors" placeholder="DD/MM/AAAA" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-gray-500 tracking-widest block mb-1">Distância</label>
                  <div className="relative">
                    <input type="text" required value={distance} onChange={(e) => setDistance(e.target.value.replace(/[^\d.,]/g, ''))} className="w-full bg-background border border-white/10 rounded-xl p-3 pr-10 text-white focus:border-race-volt outline-none transition-colors" placeholder="Ex: 10" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs">KM</span>
                  </div>
                </div>
              </div>

              {(status === 'Concluído' || activityType === 'treino') && (
                <div className="flex flex-col gap-4 p-4 bg-black/30 border border-white/5 rounded-2xl animate-in fade-in slide-in-from-top-2">
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 flex items-center gap-1">
                        <Timer size={12} /> Tempo Final
                      </label>
                      <input type="text" required value={finishTime} onChange={handleTimeChange} className="w-full bg-background border border-white/10 rounded-xl p-3 text-white focus:border-race-volt outline-none" placeholder="00:25:00" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-bold uppercase text-gray-500 flex items-center gap-1"><Zap size={12} /> Pace</label>
                        <button type="button" onClick={handleCalculatePace} className="text-[9px] bg-race-volt/20 text-race-volt px-2 py-0.5 rounded flex items-center gap-1 hover:bg-race-volt transition-colors"><Calculator size={10} /> Auto</button>
                      </div>
                      <input type="text" required value={pace} onChange={handlePaceChange} className="w-full bg-background border border-white/10 rounded-xl p-3 text-white focus:border-race-volt outline-none" placeholder="05:00" />
                    </div>
                  </div>

                  {activityType === 'prova' && (
                    <div className="mt-2 border-t border-white/5 pt-4">
                      <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 flex items-center gap-1">
                        <FileBadge size={12} /> Certificado (Opcional)
                      </label>
                      <input type="file" accept=".png,.pdf,.jpg,.jpeg" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-white/10 file:text-white hover:file:bg-white/20 transition-all cursor-pointer" />
                    </div>
                  )}
                </div>
              )}

              {activityType === 'prova' && (
                <>
                  <div>
                    <label className="text-xs font-bold uppercase text-gray-500 mb-1">Status</label>
                    <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full bg-background border border-white/10 rounded-xl p-3 text-white outline-none focus:border-race-volt transition-colors">
                      <option value="A Planejar">A Planejar</option>
                      <option value="Inscrito">Inscrito</option>
                      <option value="Concluído">Concluído</option>
                    </select>
                  </div>
                  {status !== 'Concluído' && (
                    <div className="grid grid-cols-1 gap-4 p-4 bg-background border border-white/5 rounded-2xl animate-in fade-in slide-in-from-top-2">
                        <div>
                          <label className="text-xs font-bold uppercase text-gray-500 mb-1 flex items-center gap-1"><Link2 size={12} /> Link de Inscrição</label>
                          <input type="url" value={registrationLink} onChange={(e) => setRegistrationLink(e.target.value)} className="w-full bg-background border border-white/10 rounded-xl p-3 text-white focus:border-race-volt outline-none transition-colors" placeholder="https://..." />
                        </div>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">R$</span>
                            <input type="text" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, ''))} className="w-full bg-background border border-white/10 rounded-xl p-3 pl-10 text-white outline-none focus:border-race-volt" placeholder="0,00" />
                        </div>
                    </div>
                  )}
                </>
              )}

              <button type="submit" disabled={loading} className="w-full bg-race-volt text-black font-black uppercase italic rounded-xl p-4 mt-2 hover:bg-opacity-90 disabled:opacity-50 transition-opacity">
                {loading ? 'Processando...' : 'Adicionar Atividade'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}