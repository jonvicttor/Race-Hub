'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, Zap, Target, Flame } from 'lucide-react';

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
  const [selectedFriendId, setSelectedFriendId] = useState('');
  const [duelType, setDuelType] = useState<'pace' | 'rp'>('pace');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSendChallenge = async () => {
    if (!selectedFriendId) {
      alert("Escolha um adversário para o duelo!");
      return;
    }

    setIsSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // 1. Verifica se já existe um duelo pendente para não duplicar
      const { data: existing } = await supabase
        .from('duels')
        .select('id')
        .eq('race_id', race.id)
        .eq('challenged_id', selectedFriendId)
        .eq('status', 'pendente')
        .maybeSingle();

      if (existing) {
        alert('Você já desafiou esse atleta para esta prova!');
        setIsSubmitting(false);
        return;
      }

      // 2. Insere o novo duelo
      const { error } = await supabase.from('duels').insert({
        challenger_id: user.id,
        challenged_id: selectedFriendId,
        race_id: race.id,
        duel_type: duelType,
        status: 'pendente'
      });

      if (error) {
        console.error(error);
        alert("Erro ao enviar desafio.");
      } else {
        alert("DESAFIO ENVIADO! Prepare as pernas. 🔥");
        onClose();
      }
    }
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-race-card border border-white/10 w-full max-w-md rounded-4xl p-8 relative overflow-hidden shadow-2xl">
        {/* Efeito de Fundo */}
        <div className="absolute -right-10 -top-10 opacity-10">
          <Flame size={200} className="text-race-volt" />
        </div>

        <button onClick={onClose} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors">
          <X size={24} />
        </button>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-race-volt text-black text-[10px] font-black uppercase px-2 py-0.5 rounded italic">Modo Batalha</span>
          </div>
          <h2 className="text-3xl font-black uppercase italic text-white mb-6 leading-tight">
            Intimar para <span className="text-race-volt">Duelo</span>
          </h2>

          <div className="space-y-6">
            {/* Seleção de Adversário */}
            <div>
              <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-3 block">Convocação do Pelotão</label>
              <select 
                value={selectedFriendId}
                onChange={(e) => setSelectedFriendId(e.target.value)}
                className="w-full bg-background border border-white/10 rounded-2xl p-4 text-white font-bold outline-none focus:border-race-volt transition-colors appearance-none"
              >
                <option value="">Selecione o adversário...</option>
                {friends.map(f => (
                  <option key={f.id} value={f.id}>{f.username}</option>
                ))}
              </select>
            </div>

            {/* Seleção do Tipo de Duelo */}
            <div>
              <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-3 block">Regras da Disputa</label>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setDuelType('pace')}
                  className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${duelType === 'pace' ? 'border-race-volt bg-race-volt/10 text-race-volt' : 'border-white/5 bg-white/5 text-gray-500'}`}
                >
                  <Zap size={20} />
                  <span className="text-[10px] font-black uppercase italic">Velocidade</span>
                </button>
                <button 
                  onClick={() => setDuelType('rp')}
                  className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${duelType === 'rp' ? 'border-race-volt bg-race-volt/10 text-race-volt' : 'border-white/5 bg-white/5 text-gray-500'}`}
                >
                  <Target size={20} />
                  <span className="text-[10px] font-black uppercase italic">Superação (RP)</span>
                </button>
              </div>
              <p className="text-[10px] text-gray-500 mt-3 text-center italic">
                {duelType === 'pace' 
                  ? "Vence quem cruzar a linha primeiro (Tempo Líquido)." 
                  : "Vence quem baixar mais o próprio Recorde Pessoal."}
              </p>
            </div>

            <button 
              onClick={handleSendChallenge}
              disabled={isSubmitting}
              className="w-full bg-race-volt text-black py-5 rounded-2xl font-black uppercase italic tracking-tighter flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-race-volt/20 disabled:opacity-50"
            >
              {isSubmitting ? 'Enviando...' : 'Lançar Desafio'} <Flame size={20} strokeWidth={3} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}