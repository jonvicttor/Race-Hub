'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Trophy, Medal, Route } from 'lucide-react';

interface LeaderboardEntry {
  id: string;
  username: string;
  totalKm: number;
}

export function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    async function fetchLeaderboard() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Pega os amigos aprovados
      const { data: friendships } = await supabase
        .from('friendships')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .eq('status', 'aceito');

      let userIds = [user.id]; // Começa com você mesmo
      
      if (friendships) {
        const friendIds = friendships.map(f => f.sender_id === user.id ? f.receiver_id : f.sender_id);
        userIds = [...userIds, ...friendIds];
      }

      // 2. Busca os perfis da galera do Pelotão
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds);

      // 3. Busca as corridas concluídas no MÊS ATUAL
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

      const { data: races } = await supabase
        .from('races')
        .select('user_id, distance')
        .eq('status', 'Concluído')
        .in('user_id', userIds)
        .gte('date', startOfMonth)
        .lte('date', endOfMonth);

      if (isMounted && profiles) {
        // 4. Calcula a distância por pessoa
        const rankings = profiles.map(profile => {
          const userRaces = races?.filter(r => r.user_id === profile.id) || [];
          const totalKm = userRaces.reduce((acc, race) => {
            const km = parseFloat(race.distance.replace(/[^\d.]/g, '')) || 0;
            return acc + km;
          }, 0);
          
          return {
            id: profile.id,
            username: profile.username,
            totalKm
          };
        });

        // 5. Ordena do maior pro menor
        const sortedLeaderboard = rankings.sort((a, b) => b.totalKm - a.totalKm);
        setLeaderboard(sortedLeaderboard);
        setLoading(false);
      }
    }

    fetchLeaderboard();
    return () => { isMounted = false; };
  }, []);

  if (loading) {
    return <div className="animate-pulse bg-race-card h-32 rounded-3xl border border-white/5"></div>;
  }

  if (leaderboard.length === 0 || leaderboard.every(entry => entry.totalKm === 0)) {
    return (
      <div className="bg-race-card border border-white/5 p-6 rounded-3xl text-center">
        <p className="text-gray-500 text-xs uppercase font-bold tracking-widest">Pódio do Mês</p>
        <p className="text-gray-400 text-[10px] italic mt-2">Ninguém correu esse mês ainda. Bora aquecer as canelas!</p>
      </div>
    );
  }

  const currentMonthName = new Date().toLocaleString('pt-BR', { month: 'long' });

  return (
    <div className="bg-race-card border border-white/5 p-5 rounded-3xl mb-8 flex flex-col gap-4 relative overflow-hidden">
      {/* Background Decorativo */}
      <Route className="absolute -right-4 -bottom-4 text-white/5" size={120} strokeWidth={1} />
      
      <div className="relative z-10 flex justify-between items-center">
        <h3 className="text-xs font-bold uppercase text-gray-400 tracking-widest flex items-center gap-1.5">
          <Trophy size={14} className="text-race-volt" /> Ranking de {currentMonthName}
        </h3>
      </div>

      <div className="relative z-10 flex flex-col gap-2 mt-2">
        {leaderboard.slice(0, 3).map((entry, index) => (
          <div 
            key={entry.id} 
            className={`flex items-center justify-between p-3 rounded-xl border ${
              index === 0 
                ? 'bg-linear-to-r from-race-volt/20 to-transparent border-race-volt/30 text-white shadow-lg shadow-race-volt/5' 
                : 'bg-background/50 border-white/5 text-gray-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
                index === 0 ? 'bg-race-volt text-black' : 'bg-white/10 text-gray-400'
              }`}>
                {index === 0 ? <Medal size={14} /> : `${index + 1}º`}
              </div>
              <span className={`font-bold uppercase text-sm ${index === 0 ? 'text-race-volt' : ''}`}>
                {entry.username}
              </span>
            </div>
            
            <div className="flex flex-col items-end leading-none">
              <span className="font-black italic text-lg">{entry.totalKm}</span>
              <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">KM</span>
            </div>
          </div>
        ))}
      </div>
      
      {leaderboard.length > 3 && (
        <p className="text-[10px] text-gray-500 font-medium italic text-center relative z-10 mt-1">
          E mais {leaderboard.length - 3} atleta(s) no pelotão...
        </p>
      )}
    </div>
  );
}