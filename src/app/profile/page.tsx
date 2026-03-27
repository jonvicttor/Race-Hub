'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Medal, TrendingUp, Route } from 'lucide-react';

interface Race {
  id: string;
  name: string;
  distance: string;
  finish_time: string;
  pace: string;
  status: string;
}

interface Profile {
  username: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [completedRaces, setCompletedRaces] = useState<Race[]>([]);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    async function fetchProfileData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Busca Perfil
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      
      // Busca apenas corridas concluídas
      const { data: r } = await supabase
        .from('races')
        .select('*')
        .eq('status', 'Concluído')
        .order('date', { ascending: false });

      if (isMounted) {
        if (p) setProfile(p);
        if (r) setCompletedRaces(r);
      }
    }

    fetchProfileData();
    return () => { isMounted = false; };
  }, [router]);

  // Calcula KM Total
  const totalKm = completedRaces.reduce((acc, race) => {
    const km = parseFloat(race.distance.replace(/[^\d.]/g, '')) || 0;
    return acc + km;
  }, 0);

  return (
    <main className="min-h-screen bg-background text-foreground p-6 font-sans">
      {/* Header com botão voltar */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.push('/')} className="p-2 bg-race-card rounded-xl border border-white/5 text-gray-400 hover:text-white">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-black uppercase italic tracking-tighter">
          Meu <span className="text-race-volt">Perfil</span>
        </h1>
      </div>

      {/* Info do Atleta */}
      <div className="flex flex-col items-center mb-10">
        <div className="w-24 h-24 rounded-full border-4 border-race-volt p-1 mb-4 shadow-xl shadow-race-volt/20">
          <div className="w-full h-full bg-race-card rounded-full flex items-center justify-center text-3xl text-white font-black uppercase">
            {profile?.username?.substring(0, 2) || 'JV'}
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white uppercase">{profile?.username}</h2>
        <p className="text-race-volt font-medium text-sm tracking-widest uppercase mt-1">Atleta Squad</p>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        <div className="bg-race-card border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center gap-2">
          <TrendingUp className="text-race-volt" size={24} />
          <span className="text-3xl font-black italic">{completedRaces.length}</span>
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Provas</span>
        </div>
        <div className="bg-race-card border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center gap-2">
          <Route className="text-race-volt" size={24} />
          <span className="text-3xl font-black italic">{totalKm}</span>
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Km Rodados</span>
        </div>
      </div>

      {/* Galeria de Medalhas */}
      <h3 className="text-xs font-bold uppercase text-gray-500 mb-4 tracking-widest">Galeria de Conquistas</h3>
      <div className="flex flex-col gap-4">
        {completedRaces.length > 0 ? (
          completedRaces.map((race) => (
            <div key={race.id} className="bg-race-volt/5 border border-race-volt/20 p-4 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-race-volt/20 p-3 rounded-full text-race-volt">
                  <Medal size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-white uppercase leading-tight">{race.name}</h4>
                  <p className="text-xs text-gray-400 mt-1">{race.distance.toUpperCase()}</p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-black italic text-race-volt">{race.finish_time || '--:--'}</span>
                <span className="text-[10px] text-gray-500 font-bold uppercase">{race.pace ? `${race.pace} /km` : ''}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center p-8 border border-dashed border-white/10 rounded-2xl text-gray-500 text-sm italic">
            Nenhuma prova registrada. A pista te espera!
          </div>
        )}
      </div>
    </main>
  );
}