'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ChevronLeft, Flame, Skull, Swords, Check, Target, Crown, Calendar, Zap } from 'lucide-react';

interface Profile {
  id: string;
  username: string;
  avatar_url: string;
}

interface Race {
  id: string;
  name: string;
  date: string;
  distance: string;
}

interface Duel {
  id: string;
  challenger_id: string;
  challenged_id: string;
  race_id: string;
  status: string;
  winner_id?: string;
  duel_type?: string;
  challenger_finish_time?: string;
  challenged_finish_time?: string;
  race?: Race;
  challenger?: Profile;
  challenged?: Profile;
}

function ArenaContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [duels, setDuels] = useState<Duel[]>([]);
  const [activeTab, setActiveTab] = useState<'ativos' | 'historico' | 'ranking'>('ativos');

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // 1. Busca perfil do usuário
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (profile && isMounted) setCurrentUser(profile);

      // 2. Busca todos os duelos em que o usuário está envolvido
      const { data: userDuels } = await supabase
        .from('duels')
        .select('*')
        .or(`challenger_id.eq.${user.id},challenged_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (userDuels && userDuels.length > 0) {
        // Pega IDs de raças e perfis únicos para enriquecer os dados
        const raceIds = [...new Set(userDuels.map(d => d.race_id))];
        const profileIds = [...new Set(userDuels.flatMap(d => [d.challenger_id, d.challenged_id]))];

        const [racesRes, profilesRes] = await Promise.all([
          supabase.from('races').select('*').in('id', raceIds),
          supabase.from('profiles').select('*').in('id', profileIds)
        ]);

        const enrichedDuels = userDuels.map(duel => ({
          ...duel,
          race: racesRes.data?.find(r => r.id === duel.race_id),
          challenger: profilesRes.data?.find(p => p.id === duel.challenger_id),
          challenged: profilesRes.data?.find(p => p.id === duel.challenged_id),
        }));

        if (isMounted) setDuels(enrichedDuels);
      }
      
      if (isMounted) setLoading(false);
    }

    fetchData();
    return () => { isMounted = false; };
  }, [router]);

  const handleAcceptChallenge = async (challengeId: string) => {
    await supabase.from('duels').update({ status: 'aceito' }).eq('id', challengeId);
    setDuels(prev => prev.map(d => d.id === challengeId ? { ...d, status: 'aceito' } : d));
    alert("Duelo aceito! Prepare-se para a guerra.");
  };

  const handleDeclineChallenge = async (challengeId: string) => {
    await supabase.from('duels').update({ status: 'recusado' }).eq('id', challengeId);
    setDuels(prev => prev.map(d => d.id === challengeId ? { ...d, status: 'recusado' } : d));
  };

  // === CÁLCULOS DO CARTEL ===
  const cartel = useMemo(() => {
    if (!currentUser) return { wins: 0, losses: 0, winRate: 0 };
    
    const finished = duels.filter(d => d.status === 'finalizado');
    let wins = 0;
    let losses = 0;

    finished.forEach(d => {
      if (d.winner_id === currentUser.id) wins++;
      else if (d.winner_id && d.winner_id !== currentUser.id) losses++;
    });

    const total = wins + losses;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

    return { wins, losses, winRate };
  }, [duels, currentUser]);

  const activeDuels = duels.filter(d => d.status === 'pendente' || d.status === 'aceito');
  const historyDuels = duels.filter(d => d.status === 'finalizado');

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-race-volt font-black uppercase italic">Aquecendo a Arena...</div>;
  }

  return (
    <main className="min-h-screen bg-background text-foreground p-6 font-sans relative pb-24">
      {/* HEADER */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push('/')} className="p-2 bg-race-card rounded-xl border border-white/5 text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-2xl font-black uppercase italic tracking-tighter">A <span className="text-red-500">Arena</span></h1>
      </div>

      {/* CARTEL (STATUS DO GLADIADOR) */}
      <div className="bg-race-card border border-white/5 rounded-3xl p-5 mb-8 relative overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
        <div className="absolute -right-10 -top-10 opacity-5 text-white pointer-events-none">
          <Swords size={120} />
        </div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
          <Target size={14} className="text-red-500" /> Meu Cartel de Duelos
        </h3>
        
        <div className="grid grid-cols-3 gap-3 relative z-10">
          <div className="flex flex-col items-center justify-center bg-black/40 border border-white/5 rounded-2xl p-3">
            <span className="text-2xl font-black italic text-race-volt leading-none mb-1">{cartel.wins}</span>
            <span className="text-[9px] uppercase font-bold text-gray-400 tracking-widest">Vitórias</span>
          </div>
          <div className="flex flex-col items-center justify-center bg-black/40 border border-white/5 rounded-2xl p-3">
            <span className="text-2xl font-black italic text-red-500 leading-none mb-1">{cartel.losses}</span>
            <span className="text-[9px] uppercase font-bold text-gray-400 tracking-widest">Derrotas</span>
          </div>
          <div className="flex flex-col items-center justify-center bg-black/40 border border-white/5 rounded-2xl p-3">
            <span className="text-2xl font-black italic text-white leading-none mb-1">{cartel.winRate}%</span>
            <span className="text-[9px] uppercase font-bold text-gray-400 tracking-widest">Win Rate</span>
          </div>
        </div>
      </div>

      {/* ABAS DA ARENA */}
      <div className="flex bg-background border border-white/10 rounded-2xl p-1.5 mb-6">
        <button onClick={() => setActiveTab('ativos')} className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5 ${activeTab === 'ativos' ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}>
          <Flame size={14} className={activeTab === 'ativos' ? 'text-red-500' : ''} /> Pegando Fogo
        </button>
        <button onClick={() => setActiveTab('historico')} className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5 ${activeTab === 'historico' ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}>
          <Skull size={14} /> Cemitério
        </button>
      </div>

      {/* CONTEÚDO: ATIVOS */}
      {activeTab === 'ativos' && (
        <div className="animate-in fade-in duration-300 flex flex-col gap-4">
          {activeDuels.length > 0 ? activeDuels.map(duel => {
            const isChallenged = currentUser?.id === duel.challenged_id;
            const opponent = isChallenged ? duel.challenger : duel.challenged;
            const isPending = duel.status === 'pendente';

            return (
              <div key={duel.id} className="bg-linear-to-r from-race-card to-black border border-white/5 rounded-3xl p-5 relative overflow-hidden shadow-lg">
                {isPending && isChallenged && <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/20 blur-xl rounded-full"></div>}
                
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/10 bg-black relative">
                      {opponent?.avatar_url ? <Image src={opponent.avatar_url} alt="Rival" fill className="object-cover"/> : <span className="text-xs font-black text-white absolute inset-0 flex items-center justify-center">{opponent?.username?.substring(0,2)}</span>}
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest">Seu Rival</span>
                      <h4 className="font-black text-white uppercase text-lg leading-none">{opponent?.username}</h4>
                    </div>
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded bg-black border ${isPending ? 'border-orange-500/50 text-orange-500' : 'border-race-volt/50 text-race-volt'}`}>
                    {isPending ? 'Aguardando' : 'Guerra Declarada'}
                  </span>
                </div>

                <div className="bg-black/50 p-3 rounded-2xl border border-white/5 mb-4 relative z-10 flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><Calendar size={12}/> {duel.race?.name}</span>
                  {duel.duel_type && (
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><Zap size={12} className="text-race-volt"/> MODO: {duel.duel_type === 'rp' ? 'Superação (RP)' : 'Velocidade'}</span>
                  )}
                </div>

                {isPending && isChallenged ? (
                  <div className="flex gap-2 relative z-10">
                    <button onClick={() => handleAcceptChallenge(duel.id)} className="flex-1 bg-red-600 text-white text-xs font-black uppercase tracking-widest py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-red-500 transition-colors shadow-lg shadow-red-600/20">
                      <Check size={16} strokeWidth={3} /> Aceitar
                    </button>
                    <button onClick={() => handleDeclineChallenge(duel.id)} className="px-5 bg-white/5 text-gray-400 border border-white/10 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-white/10 hover:text-white transition-colors">
                      Arregar
                    </button>
                  </div>
                ) : (
                  <div className="text-center p-3 border border-dashed border-white/10 rounded-xl bg-black/20">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                      {isPending ? 'Esperando o rival aceitar o desafio...' : 'Treine duro. O dia da prova está chegando!'}
                    </p>
                  </div>
                )}
              </div>
            )
          }) : (
            <div className="text-center p-10 border border-dashed border-white/10 rounded-3xl text-gray-500 flex flex-col items-center gap-3">
              <Swords size={40} className="opacity-20" />
              <p className="text-xs font-bold uppercase tracking-widest">A Arena está vazia</p>
              <p className="text-[10px] uppercase">Nenhum duelo pendente no momento.</p>
            </div>
          )}
        </div>
      )}

      {/* CONTEÚDO: HISTÓRICO (CEMITÉRIO) */}
      {activeTab === 'historico' && (
        <div className="animate-in fade-in duration-300 flex flex-col gap-5">
          {historyDuels.length > 0 ? historyDuels.map(duel => {
            const isWinner = duel.winner_id === currentUser?.id;
            const isEmpate = !duel.winner_id;
            
            // Define quem fica na esquerda e quem fica na direita
            const leftPlayer = currentUser?.id === duel.challenger_id ? duel.challenger : duel.challenged;
            const rightPlayer = currentUser?.id === duel.challenger_id ? duel.challenged : duel.challenger;
            
            const leftTime = currentUser?.id === duel.challenger_id ? duel.challenger_finish_time : duel.challenged_finish_time;
            const rightTime = currentUser?.id === duel.challenger_id ? duel.challenged_finish_time : duel.challenger_finish_time;

            const leftWon = duel.winner_id === leftPlayer?.id;
            const rightWon = duel.winner_id === rightPlayer?.id;

            return (
              <div key={duel.id} className="relative bg-[#0a0a0a] border-y border-white/5 py-6">
                {/* Efeito de Fundo do Vencedor */}
                {leftWon && <div className="absolute left-0 top-0 bottom-0 w-1/2 bg-linear-to-r from-race-volt/5 to-transparent pointer-events-none"></div>}
                {rightWon && <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-linear-to-l from-red-500/5 to-transparent pointer-events-none"></div>}

                <div className="text-center mb-6 relative z-10">
                  <p className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">{duel.race?.name}</p>
                </div>

                <div className="flex items-center justify-between relative z-10 px-4">
                  {/* JOGADOR ESQUERDA (VOCÊ) */}
                  <div className={`flex flex-col items-center flex-1 ${leftWon ? 'opacity-100 scale-110' : 'opacity-50 grayscale transition-all'}`}>
                    <div className="relative mb-2">
                      {leftWon && <Crown className="absolute -top-5 left-1/2 -translate-x-1/2 text-race-volt drop-shadow-[0_0_10px_rgba(204,255,0,0.8)] z-20" size={20} strokeWidth={3} />}
                      <div className={`w-16 h-16 rounded-full overflow-hidden border-2 ${leftWon ? 'border-race-volt shadow-[0_0_15px_rgba(204,255,0,0.4)]' : 'border-white/10'} bg-black relative`}>
                        {leftPlayer?.avatar_url ? <Image src={leftPlayer.avatar_url} alt="Left" fill className="object-cover"/> : <span className="absolute inset-0 flex items-center justify-center font-black text-xl">{leftPlayer?.username?.substring(0,2)}</span>}
                      </div>
                    </div>
                    <h4 className={`font-black uppercase text-sm ${leftWon ? 'text-white' : 'text-gray-400'}`}>{leftPlayer?.username}</h4>
                    <span className="text-lg font-black italic text-white mt-1">{leftTime || '--:--'}</span>
                  </div>

                  {/* O "VS" CENTRAL */}
                  <div className="flex flex-col items-center justify-center px-4 shrink-0">
                    <span className="text-3xl font-black italic text-gray-700">VS</span>
                  </div>

                  {/* JOGADOR DIREITA (RIVAL) */}
                  <div className={`flex flex-col items-center flex-1 ${rightWon ? 'opacity-100 scale-110' : 'opacity-50 grayscale transition-all'}`}>
                    <div className="relative mb-2">
                      {rightWon && <Crown className="absolute -top-5 left-1/2 -translate-x-1/2 text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)] z-20" size={20} strokeWidth={3} />}
                      <div className={`w-16 h-16 rounded-full overflow-hidden border-2 ${rightWon ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'border-white/10'} bg-black relative`}>
                        {rightPlayer?.avatar_url ? <Image src={rightPlayer.avatar_url} alt="Right" fill className="object-cover"/> : <span className="absolute inset-0 flex items-center justify-center font-black text-xl">{rightPlayer?.username?.substring(0,2)}</span>}
                      </div>
                    </div>
                    <h4 className={`font-black uppercase text-sm ${rightWon ? 'text-white' : 'text-gray-400'}`}>{rightPlayer?.username}</h4>
                    <span className="text-lg font-black italic text-white mt-1">{rightTime || '--:--'}</span>
                  </div>
                </div>

                <div className="text-center mt-6 relative z-10">
                  {isEmpate ? (
                    <span className="bg-white/10 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">Empate Técnico</span>
                  ) : (
                    <span className={`${isWinner ? 'bg-race-volt/10 text-race-volt border-race-volt/30' : 'bg-red-500/10 text-red-500 border-red-500/30'} border px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest`}>
                      {isWinner ? 'Vitória Esmagadora' : 'Derrota Amarga'}
                    </span>
                  )}
                </div>
              </div>
            );
          }) : (
            <div className="text-center p-10 border border-dashed border-white/10 rounded-3xl text-gray-500 flex flex-col items-center gap-3">
              <Skull size={40} className="opacity-20" />
              <p className="text-xs font-bold uppercase tracking-widest">Cemitério Vazio</p>
              <p className="text-[10px] uppercase">Nenhum duelo foi finalizado ainda.</p>
            </div>
          )}
        </div>
      )}

    </main>
  );
}

export default function ArenaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-race-volt font-black uppercase italic">Entrando na Arena...</div>}>
      <ArenaContent />
    </Suspense>
  );
}