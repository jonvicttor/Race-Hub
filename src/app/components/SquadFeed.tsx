'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Medal, Timer, Zap, History, ClipboardList, RotateCcw, Dumbbell, Target } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface FeedItem {
  id: string;
  name: string;
  distance: string;
  finish_time: string;
  pace: string;
  date: string;
  activity_type?: string; 
  training_plan?: string; 
  user: {
    id: string;
    username: string;
  };
}

// O MESMO FORMATADOR VISUAL DO PAGE.TSX
const formatCoachText = (text: string) => {
  const lines = text.split('\n').filter(line => line.trim() !== '');

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {lines.map((line, idx) => {
        const lowerLine = line.toLowerCase();
        let Icon = <Target size={14} className="text-race-volt" />; 
        const isTotalTime = lowerLine.includes('tempo total');
        
        if (isTotalTime) {
          Icon = <span className="text-[12px] leading-none">⏱️</span>;
        } else if (lowerLine.includes('aquecer') || lowerLine.includes('aquecimento')) {
          Icon = <span className="text-[12px] leading-none">🔥</span>;
        } else if (lowerLine.includes('desaquecer') || lowerLine.includes('desaquecimento')) {
          Icon = <span className="text-[12px] leading-none">❄️</span>;
        } else if (lowerLine.includes('descansar') || lowerLine.includes('descanso')) {
          Icon = <span className="text-[12px] leading-none">🛑</span>;
        } else if (lowerLine.includes('tiro') || lowerLine.includes('intervalado')) {
          Icon = <span className="text-[12px] leading-none">🚀</span>;
        } else if (lowerLine.includes('correr') || lowerLine.includes('rodagem')) {
          Icon = <span className="text-[12px] leading-none">👟</span>;
        }

        const formattedLine = line.split(/(Z[1-5])/g).map((part, i) => {
          if (part === 'Z1') return <span key={i} className="text-gray-300 font-black px-1.5 py-0.5 bg-gray-500/20 border border-gray-500/30 rounded inline-block mx-0.5 shadow-sm text-[10px]">Z1</span>;
          if (part === 'Z2') return <span key={i} className="text-blue-400 font-black px-1.5 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded inline-block mx-0.5 shadow-sm text-[10px]">Z2</span>;
          if (part === 'Z3') return <span key={i} className="text-green-400 font-black px-1.5 py-0.5 bg-green-500/20 border border-green-500/30 rounded inline-block mx-0.5 shadow-sm text-[10px]">Z3</span>;
          if (part === 'Z4') return <span key={i} className="text-orange-400 font-black px-1.5 py-0.5 bg-orange-500/20 border border-orange-500/30 rounded inline-block mx-0.5 shadow-sm text-[10px]">Z4</span>;
          if (part === 'Z5') return <span key={i} className="text-red-500 font-black px-1.5 py-0.5 bg-red-500/20 border border-red-500/30 rounded inline-block mx-0.5 shadow-sm text-[10px] animate-pulse">Z5</span>;
          return <span key={i}>{part}</span>;
        });

        return (
          <div key={idx} className={`flex items-start gap-3 bg-white/5 p-3 rounded-2xl border ${isTotalTime ? 'border-race-volt/30 shadow-[0_0_10px_rgba(204,255,0,0.1)]' : 'border-white/5'} hover:bg-white/10 transition-colors w-full`}>
            <div className="w-6 h-6 rounded-full bg-black/40 flex items-center justify-center shrink-0 border border-white/5 shadow-inner">
              {Icon}
            </div>
            <div className={`text-xs ${isTotalTime ? 'text-race-volt font-black uppercase tracking-widest' : 'text-gray-200 font-medium'} leading-relaxed pt-0.5 flex-1`}>
              {formattedLine}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export function SquadFeed() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [flippedCardId, setFlippedCardId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    
    async function fetchFeed() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Pega os amigos aprovados
      const { data: friendships } = await supabase
        .from('friendships')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .eq('status', 'aceito');

      let friendIds: string[] = [];
      
      if (friendships) {
        friendIds = friendships.map(f => f.sender_id === user.id ? f.receiver_id : f.sender_id);
      }

      if (friendIds.length === 0) {
        if (isMounted) setLoading(false);
        return; // Se não tem amigos, não tem feed
      }

      // 2. Busca as últimas corridas concluídas DESSES amigos
      const { data: races } = await supabase
        .from('races')
        .select(`
          id,
          name,
          distance,
          finish_time,
          pace,
          date,
          user_id,
          activity_type,
          training_plan
        `)
        .eq('status', 'Concluído')
        .in('user_id', friendIds)
        .order('date', { ascending: false })
        .limit(5);

      if (races && races.length > 0) {
        // 3. Puxa os usernames de quem correu
        const raceUserIds = [...new Set(races.map(r => r.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', raceUserIds);

        if (isMounted && profiles) {
          const enrichedFeed = races.map(race => {
            const profile = profiles.find(p => p.id === race.user_id);
            return {
              ...race,
              user: {
                id: profile?.id || '',
                username: profile?.username || 'Atleta'
              }
            };
          });
          setFeed(enrichedFeed as FeedItem[]);
        }
      }
      
      if (isMounted) setLoading(false);
    }

    fetchFeed();
    return () => { isMounted = false; };
  }, []);

  if (loading) {
    return <div className="animate-pulse bg-race-card h-24 rounded-2xl border border-white/5 mb-8"></div>;
  }

  if (feed.length === 0) {
    return null; // Oculta a sessão inteira se os amigos não tiverem corridas concluídas
  }

  return (
    <div className="mb-10">
      <h3 className="text-xs font-bold uppercase text-gray-500 tracking-widest mb-4 flex items-center gap-2">
        <History size={14} /> Giro do Pelotão
      </h3>
      
      <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide snap-x">
        {feed.map((item) => (
          <div key={item.id} className="snap-start shrink-0 w-72 perspective-[1000px] h-55">
            
            {/* CONTAINER 3D */}
            <div 
              className="relative w-full h-full transition-transform duration-700"
              style={{
                transformStyle: 'preserve-3d',
                transform: flippedCardId === item.id ? 'rotateY(180deg)' : 'rotateY(0deg)'
              }}
            >
              
              {/* FRENTE DO CARD */}
              <div 
                className="absolute inset-0 bg-race-card border border-white/5 p-4 rounded-3xl flex flex-col justify-between overflow-hidden group"
                style={{ 
                  backfaceVisibility: 'hidden', 
                  WebkitBackfaceVisibility: 'hidden',
                  pointerEvents: flippedCardId === item.id ? 'none' : 'auto', 
                  zIndex: flippedCardId === item.id ? 0 : 10 
                }}
              >
                <div className="absolute -right-4 -top-4 w-16 h-16 bg-race-volt/5 rounded-full blur-xl group-hover:bg-race-volt/10 transition-colors"></div>

                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => router.push(`/profile/${item.user.id}`)}
                      className="w-10 h-10 bg-race-gray rounded-full flex items-center justify-center font-black text-white text-xs uppercase hover:ring-2 hover:ring-race-volt transition-all"
                    >
                      {item.user.username.substring(0, 2)}
                    </button>
                    <div>
                      <p className="text-xs font-bold text-white uppercase leading-none">{item.user.username}</p>
                      <p className="text-[9px] text-gray-500 uppercase tracking-widest mt-1">
                        {item.activity_type === 'treino' ? 'Concluiu um treino' : 'Concluiu uma prova'}
                      </p>
                    </div>
                  </div>
                  {/* ICONE PLANILHA */}
                  {item.training_plan && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setFlippedCardId(item.id); }}
                      className="p-2 bg-white/5 hover:bg-race-volt hover:text-black rounded-full text-gray-400 transition-colors"
                      title="Ver Planilha"
                    >
                      <ClipboardList size={16} />
                    </button>
                  )}
                </div>

                <div className="bg-background/50 border border-white/5 rounded-2xl p-3 relative z-10 mt-3">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-sm text-white uppercase italic leading-tight max-w-[70%] truncate">
                      {item.name}
                    </h4>
                    <span className="text-[10px] text-race-volt font-black uppercase bg-race-volt/10 px-2 py-0.5 rounded shrink-0">
                      {item.distance}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mt-2 pt-2 border-t border-white/5">
                    <div className="flex items-center gap-1.5 text-gray-300">
                      <Timer size={12} className="text-race-volt" />
                      <span className="text-xs font-black italic">{item.finish_time || '--:--'}</span>
                    </div>
                    {item.pace && (
                      <div className="flex items-center gap-1.5 text-gray-300">
                        <Zap size={12} className="text-race-volt" />
                        <span className="text-xs font-black italic">{item.pace}/km</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="absolute top-4 right-4 text-race-volt/20 pointer-events-none">
                  <Medal size={24} />
                </div>
              </div>

              {/* VERSO DO CARD (PLANILHA) */}
              <div 
                className="absolute inset-0 w-full h-full bg-linear-to-br from-[#181818] to-[#0a0a0a] border border-race-volt/30 rounded-3xl p-5 shadow-[0_0_20px_rgba(209,255,0,0.05)] flex flex-col"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  pointerEvents: flippedCardId === item.id ? 'auto' : 'none', 
                  zIndex: flippedCardId === item.id ? 10 : 0 
                }}
              >
                <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
                  <h3 className="text-race-volt font-black uppercase italic text-[10px] tracking-widest flex items-center gap-1.5">
                    <ClipboardList size={14} /> Treino do Pelotão
                  </h3>
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFlippedCardId(null); }} 
                    className="text-gray-400 hover:text-white transition-colors bg-white/5 p-1.5 rounded-full hover:bg-white/10 cursor-pointer"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-1">
                  {item.training_plan ? (
                    formatCoachText(item.training_plan)
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-60 gap-2">
                      <Dumbbell size={24} />
                      <p className="text-[10px] uppercase tracking-widest text-center">Treino Livre</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        ))}
      </div>
    </div>
  );
}