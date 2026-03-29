'use client';

import { useState } from 'react';
import { X, Flame } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Profile {
  id: string;
  username: string;
}

interface Race {
  id: string;
  name: string;
}

interface ChallengeModalProps {
  race: Race;
  friends: Profile[];
  onClose: () => void;
}

export function ChallengeModal({ race, friends, onClose }: ChallengeModalProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleChallenge = async (friendId: string) => {
    setLoadingId(friendId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // 1. Verifica se já não existe um desafio para essa pessoa nessa corrida
      const { data: existing } = await supabase
        .from('challenges')
        .select('id')
        .eq('race_id', race.id)
        .eq('challenged_id', friendId)
        .maybeSingle();

      if (existing) {
        alert('Você já desafiou esse atleta para esta prova!');
        setLoadingId(null);
        return;
      }

      // 2. Envia o desafio
      const { error } = await supabase.from('challenges').insert([
        {
          challenger_id: user.id,
          challenged_id: friendId,
          race_id: race.id,
          status: 'pendente'
        }
      ]);

      if (error) throw error;
      
      alert('Desafio enviado com sucesso! 🔥');
      onClose();
    } catch (error) {
      console.error(error);
      alert('Erro ao enviar desafio.');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-race-card w-full max-w-sm rounded-3xl p-6 border border-white/10 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-black uppercase italic text-white flex items-center gap-2">
              <Flame className="text-race-volt" size={24} /> Desafiar
            </h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Para: {race.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto scrollbar-hide">
          {friends.length > 0 ? (
            friends.map(friend => (
              <div key={friend.id} className="bg-background border border-white/5 p-3 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-race-gray rounded-full flex items-center justify-center text-white font-black uppercase">
                    {friend.username.substring(0, 2)}
                  </div>
                  <span className="font-bold text-white uppercase text-sm">{friend.username}</span>
                </div>
                <button 
                  onClick={() => handleChallenge(friend.id)}
                  disabled={loadingId === friend.id}
                  className="bg-race-volt/10 text-race-volt border border-race-volt/20 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg hover:bg-race-volt hover:text-black transition-colors disabled:opacity-50"
                >
                  {loadingId === friend.id ? '...' : 'Intimar'}
                </button>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-xs italic text-center py-4">Você ainda não tem amigos no Pelotão para desafiar.</p>
          )}
        </div>
      </div>
    </div>
  );
}