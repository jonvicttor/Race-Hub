'use client';

import { useState } from 'react';
import { Plus, X, Link2 } from 'lucide-react';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // TRATAMENTO DO PREÇO: Se estiver vazio, manda null. Se tiver valor, troca vírgula por ponto.
    const numericPrice = price.trim() === '' ? null : parseFloat(price.replace(',', '.'));

    try {
      const { error } = await supabase.from('races').insert([
        {
          name,
          date,
          distance,
          kit_location: location,
          status,
          registration_link: registrationLink,
          event_location: eventLocation,
          price: numericPrice, // Agora vai como número ou null
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

      alert('Corrida adicionada com sucesso!');
      window.location.reload(); // Recarrega para atualizar a lista
    } catch (error) {
      console.error('Erro ao adicionar corrida:', error);
      alert('Erro ao adicionar. Verifique se o valor está correto (ex: 140,00)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-race-volt text-black px-3 py-2 rounded-xl font-bold uppercase text-[10px] tracking-widest flex items-center gap-1 hover:scale-105 active:scale-95 transition-transform"
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
                <input 
                  type="text" required value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-background border border-white/10 rounded-xl p-3 text-white focus:border-race-volt outline-none transition-colors"
                  placeholder="Ex: Volta da Pampulha"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-gray-500 tracking-widest mb-1 flex items-center gap-1">
                  <Link2 size={12} /> Link de Inscrição (Opcional)
                </label>
                <input 
                  type="url" value={registrationLink}
                  onChange={(e) => setRegistrationLink(e.target.value)}
                  className="w-full bg-background border border-white/10 rounded-xl p-3 text-white focus:border-race-volt outline-none transition-colors text-sm"
                  placeholder="https://www.ticketsports.com.br/..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-gray-500 tracking-widest block mb-1">Data</label>
                  <input 
                    type="date" required value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-background border border-white/10 rounded-xl p-3 text-white scheme-dark outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-gray-500 tracking-widest block mb-1">Distância</label>
                  <input 
                    type="text" required value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    className="w-full bg-background border border-white/10 rounded-xl p-3 text-white focus:border-race-volt outline-none transition-colors"
                    placeholder="Ex: 21KM"
                  />
                </div>
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
                    {/* Campo com R$ Fixo */}
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

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-xs font-bold uppercase text-gray-500 tracking-widest block mb-1">Local/Kit</label>
                    <input 
                      type="text" value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full bg-background border border-white/10 rounded-xl p-3 text-white outline-none transition-colors"
                      placeholder="Ex: Shopping RioMar"
                    />
                 </div>
                 <div>
                    <label className="text-xs font-bold uppercase text-gray-500 tracking-widest block mb-1">Status</label>
                    <select 
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full bg-background border border-white/10 rounded-xl p-3 text-white outline-none transition-colors"
                    >
                      <option value="A Planejar">A Planejar</option>
                      <option value="Inscrito">Inscrito</option>
                      <option value="Concluído">Concluído</option>
                    </select>
                 </div>
              </div>

              <button 
                type="submit" disabled={loading}
                className="w-full bg-race-volt text-black font-black uppercase italic rounded-xl p-4 mt-2 hover:bg-opacity-90 disabled:opacity-50 transition-opacity"
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