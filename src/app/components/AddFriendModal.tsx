'use client';

import { useState } from 'react';
import { UserPlus, X, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Profile {
  id: string;
  username: string;
}

export function AddFriendModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<Profile | null>(null);
  const [message, setMessage] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    setMessage('');
    setSearchResult(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Usando maybeSingle() para evitar erro caso não encontre ninguém
      const { data } = await supabase
        .from('profiles')
        .select('id, username')
        .ilike('username', searchQuery.trim())
        .neq('id', user.id)
        .maybeSingle();

      if (!data) {
        setMessage('Nenhum atleta encontrado com esse Nickname.');
      } else {
        setSearchResult(data);
      }
    } catch (err) {
      console.error(err);
      setMessage('Erro ao buscar atleta.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async () => {
    if (!searchResult) return;
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // CORREÇÃO AQUI: Trocado .first() por .maybeSingle()
      const { data: existing } = await supabase
        .from('friendships')
        .select('id')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${searchResult.id}),and(sender_id.eq.${searchResult.id},receiver_id.eq.${user.id})`)
        .maybeSingle();

      if (existing) {
        setMessage('Vocês já estão no mesmo pelotão ou há um convite pendente!');
        setLoading(false);
        return;
      }

      const { error: insertError } = await supabase.from('friendships').insert([
        { sender_id: user.id, receiver_id: searchResult.id, status: 'pendente' }
      ]);

      if (insertError) throw insertError;
      
      setMessage('Convite enviado com sucesso! Aguardando o atleta aceitar.');
      setSearchResult(null);
      setSearchQuery('');
    } catch (err) {
      console.error(err);
      setMessage('Erro ao enviar convite.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-14 h-14 rounded-2xl bg-race-volt/10 border border-race-volt/30 flex items-center justify-center text-race-volt hover:bg-race-volt hover:text-black transition-all shrink-0"
        title="Buscar Atleta"
      >
        <UserPlus size={24} strokeWidth={2.5} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-race-card w-full max-w-sm rounded-3xl p-6 border border-white/10 shadow-2xl">
            
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black uppercase italic text-white">Novo Recruta</h2>
              <button onClick={() => { setIsOpen(false); setMessage(''); setSearchResult(null); setSearchQuery(''); }} className="text-gray-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSearch} className="flex gap-2 mb-4">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Digite o Nickname..."
                className="flex-1 bg-background border border-white/10 rounded-xl p-3 text-white outline-none focus:border-race-volt transition-colors"
              />
              <button type="submit" disabled={loading} className="bg-race-volt text-black p-3 rounded-xl hover:scale-105 active:scale-95 transition-transform disabled:opacity-50">
                <Search size={20} strokeWidth={3} />
              </button>
            </form>

            {message && (
              <p className={`text-xs font-bold uppercase tracking-widest mb-4 text-center ${message.includes('sucesso') ? 'text-green-400' : 'text-gray-400'}`}>
                {message}
              </p>
            )}

            {searchResult && (
              <div className="bg-background border border-white/10 p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-race-gray rounded-full flex items-center justify-center text-white font-black uppercase">
                    {searchResult.username.substring(0, 2)}
                  </div>
                  <span className="font-bold text-white uppercase">{searchResult.username}</span>
                </div>
                <button 
                  onClick={handleAddFriend}
                  disabled={loading}
                  className="bg-race-volt text-black text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg hover:scale-105 transition-transform disabled:opacity-50"
                >
                  Convidar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}