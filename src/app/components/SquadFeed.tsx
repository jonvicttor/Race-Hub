'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Medal, Timer, Zap, History, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface FeedItem {
  id: string;
  name: string;
  distance: string;
  finish_time: string;
  pace: string;
  date: string;
  activity_type?: string; // Adicionado
  training_plan?: string; // Adicionado
  user: {
    id: string;
    username: string;
  };
}

export function SquadFeed() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
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
          <div 
            key={item.id} 
            className="snap-start shrink-0 w-72 bg-race-card border border-white/5 p-4 rounded-3xl flex flex-col gap-3 relative overflow-hidden group"
          >
            {/* Decoração sutil */}
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-race-volt/5 rounded-full blur-xl group-hover:bg-race-volt/10 transition-colors"></div>

            <div className="flex items-center gap-3 relative z-10">
              <button 
                onClick={() => router.push(`/profile/${item.user.id}`)}
                className="w-10 h-10 bg-race-gray rounded-full flex items-center justify-center font-black text-white text-xs uppercase hover:ring-2 hover:ring-race-volt transition-all"
              >
                {item.user.username.substring(0, 2)}
              </button>
              <div>
                <p className="text-xs font-bold text-white uppercase leading-none">{item.user.username}</p>
                <p className="text-[9px] text-gray-500 uppercase tracking-widest mt-1">
                  {/* Dinâmico: Prova ou Treino */}
                  {item.activity_type === 'treino' ? 'Concluiu um treino' : 'Concluiu uma prova'}
                </p>
              </div>
            </div>

            <div className="bg-background/50 border border-white/5 rounded-2xl p-3 relative z-10">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-sm text-white uppercase italic leading-tight max-w-[70%] truncate">
                  {item.name}
                </h4>
                <span className="text-[10px] text-race-volt font-black uppercase bg-race-volt/10 px-2 py-0.5 rounded shrink-0">
                  {item.distance}
                </span>
              </div>
              
              {/* NOVO BLOCO: PLANILHA DO TREINADOR */}
              {item.training_plan && (
                <div className="mb-3 p-2 bg-black/40 rounded-lg border border-white/5">
                  <p className="text-[9px] font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                    <FileText size={10} /> Planilha
                  </p>
                  <p className="text-xs text-gray-400 italic line-clamp-2">
                    {item.training_plan}
                  </p>
                </div>
              )}

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

            <div className="absolute top-4 right-4 text-race-volt/20">
              <Medal size={24} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}