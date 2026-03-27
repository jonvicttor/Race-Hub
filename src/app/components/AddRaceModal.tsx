'use client';

import { useState } from 'react';
import { Plus, X, Link2, Timer, Zap, Calculator, FileBadge } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function AddRaceModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [distance, setDistance] = useState(''); 
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState('A Planejar');
  const [registrationLink, setRegistrationLink] = useState(''); 
  const [eventLocation, setEventLocation] = useState(''); 
  const [price, setPrice] = useState(''); 
  
  // Novos estados para corridas já concluídas
  const [finishTime, setFinishTime] = useState('');
  const [pace, setPace] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const handleCalculatePace = () => {
    if (!finishTime || !distance) {
      alert("Preencha o Tempo Final e a Distância primeiro (ex: 00:55:00 e 10KM)");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const numericPrice = price.trim() === '' ? null : parseFloat(price.replace(',', '.'));
    let certificateUrl = null;

    try {
      // TRATAMENTO DO UPLOAD SE ESTIVER CONCLUÍDO
      if (status === 'Concluído') {
        if (!file) {
          alert('Por favor, anexe o certificado (PNG, JPG ou PDF) para registrar uma prova concluída.');
          setLoading(false);
          return;
        }

        const fileExt = file.name.split('.').pop();
        // Cria um nome único para o arquivo para não dar conflito
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('certificates')
          .upload(fileName, file);

        if (uploadError) throw new Error('Erro ao fazer upload do certificado.');

        // Pega o link público do arquivo recém-enviado
        const { data: publicUrlData } = supabase.storage
          .from('certificates')
          .getPublicUrl(fileName);

        certificateUrl = publicUrlData.publicUrl;
      }

      // SALVA NO BANCO
      const { error } = await supabase.from('races').insert([
        {
          name,
          date,
          distance,
          kit_location: location,
          status,
          registration_link: registrationLink,
          event_location: eventLocation,
          price: numericPrice,
          finish_time: status === 'Concluído' ? finishTime : null,
          pace: status === 'Concluído' ? pace : null,
          certificate_url: certificateUrl, // Link do certificado
        },
      ]);

      if (error) throw error;

      setIsOpen(false);
      setName('');
      setDate('');
      setDistance('');
      setLocation('');
      setStatus('A Planejar');
      setRegistrationLink('');
      setEventLocation('');
      setPrice('');
      setFinishTime('');
      setPace('');
      setFile(null);

      alert('Corrida adicionada com sucesso!');
      window.location.reload(); 
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao adicionar corrida.';
      console.error(error);
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-race-volt text-black px-3 py-2 rounded-xl font-bold uppercase text-[10px] tracking-widest flex items-center gap-1 hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-race-volt/20"
      >
        <Plus size={14} strokeWidth={3} /> Prova
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-race-card w-full max-w-md rounded-3xl p-6 border border-white/10 shadow-2xl overflow-y-auto max-h-[90vh]">
            
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black uppercase italic text-white">Nova Corrida</h2>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold uppercase text-gray-500 tracking-widest block mb-1">Nome da Prova</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-background border border-white/10 rounded-xl p-3 text-white focus:border-race-volt outline-none transition-colors" placeholder="Ex: Volta da Pampulha" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-gray-500 tracking-widest block mb-1">Data</label>
                  <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-background border border-white/10 rounded-xl p-3 text-white scheme-dark outline-none transition-colors" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-gray-500 tracking-widest block mb-1">Distância</label>
                  <input type="text" required value={distance} onChange={(e) => setDistance(e.target.value)} className="w-full bg-background border border-white/10 rounded-xl p-3 text-white focus:border-race-volt outline-none transition-colors" placeholder="Ex: 21KM" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-gray-500 tracking-widest block mb-1">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full bg-background border border-white/10 rounded-xl p-3 text-white outline-none focus:border-race-volt transition-colors">
                  <option value="A Planejar">A Planejar</option>
                  <option value="Inscrito">Inscrito</option>
                  <option value="Concluído">Concluído</option>
                </select>
              </div>

              {/* CAMPOS ESCONDIDOS: Só aparecem se for CONCLUÍDO */}
              {status === 'Concluído' && (
                <div className="flex flex-col gap-4 p-4 bg-race-volt/5 border border-race-volt/20 rounded-2xl animate-in fade-in slide-in-from-top-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-race-volt mb-1 flex items-center gap-1">
                        <Timer size={12} /> Tempo Final
                      </label>
                      <input type="text" required value={finishTime} onChange={(e) => setFinishTime(e.target.value)} className="w-full bg-background border border-white/10 rounded-xl p-3 text-white outline-none focus:border-race-volt transition-colors" placeholder="00:55:00" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-bold uppercase text-race-volt flex items-center gap-1">
                          <Zap size={12} /> Pace
                        </label>
                        <button type="button" onClick={handleCalculatePace} className="text-[9px] bg-race-volt/20 text-race-volt px-2 py-0.5 rounded flex items-center gap-1 hover:bg-race-volt hover:text-black transition-colors">
                          <Calculator size={10} /> Auto
                        </button>
                      </div>
                      <input type="text" required value={pace} onChange={(e) => setPace(e.target.value)} className="w-full bg-background border border-white/10 rounded-xl p-3 text-white outline-none focus:border-race-volt transition-colors" placeholder="05:30" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-race-volt mb-1 flex items-center gap-1">
                      <FileBadge size={12} /> Upload do Certificado
                    </label>
                    <input 
                      type="file" 
                      accept=".png,.pdf,.jpg,.jpeg" 
                      onChange={(e) => setFile(e.target.files?.[0] || null)} 
                      className="w-full text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-race-volt file:text-black hover:file:bg-race-volt/80 transition-all cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* CAMPOS NORMAIS: Só aparecem se NÃO for concluído */}
              {status !== 'Concluído' && (
                <>
                  <div>
                    <label className="text-xs font-bold uppercase text-gray-500 tracking-widest mb-1 flex items-center gap-1">
                      <Link2 size={12} /> Link de Inscrição (Opcional)
                    </label>
                    <input type="url" value={registrationLink} onChange={(e) => setRegistrationLink(e.target.value)} className="w-full bg-background border border-white/10 rounded-xl p-3 text-white focus:border-race-volt outline-none transition-colors text-sm" placeholder="https://..." />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold uppercase text-gray-500 tracking-widest block mb-1">Local</label>
                        <input type="text" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} className="w-full bg-background border border-white/10 rounded-xl p-3 text-white outline-none transition-colors" placeholder="Ex: Olinda - PE" />
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase text-gray-500 tracking-widest block mb-1">Valor</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">R$</span>
                          <input type="text" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full bg-background border border-white/10 rounded-xl p-3 pl-10 text-white outline-none transition-colors focus:border-race-volt" placeholder="0,00" />
                        </div>
                    </div>
                  </div>
                </>
              )}

              <button type="submit" disabled={loading} className="w-full bg-race-volt text-black font-black uppercase italic rounded-xl p-4 mt-2 hover:bg-opacity-90 disabled:opacity-50 transition-opacity">
                {loading ? 'Salvando Prova...' : 'Adicionar ao Calendário'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}