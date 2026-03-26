'use client'; 

import { useState, useEffect, useCallback } from 'react'; 
import { Trophy, Calendar, MapPin, Edit3, Clock, LogOut } from 'lucide-react';
import { supabase } from './lib/supabase';
import { useRouter } from 'next/navigation';
import { AddRaceModal } from './components/AddRaceModal';
import { EditRaceModal } from './components/EditRaceModal';

interface Race {
  id: string;
  name: string;
  date: string;
  distance: string;
  status: string;
  kit_location: string;
  kit_datetime?: string;
}

interface Profile {
  id: string;
  username: string;
  avatar_url: string;
}

export default function Home() {
  const [races, setRaces] = useState<Race[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [editingRace, setEditingRace] = useState<Race | null>(null);
  const router = useRouter();

  // Mantemos esta função para os Modals poderem atualizar a lista (onUpdate)
  const refreshData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: p } = await supabase.from('profiles').select('*');
    const { data: r } = await supabase.from('races').select('*').order('date', { ascending: true });

    if (p) {
      setProfiles(p);
      const current = p.find(profile => profile.id === user.id);
      if (current) setUserProfile(current);
    }
    if (r) setRaces(r);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initializeHome() {
      // 1. Verifica autenticação
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      // 2. Busca dados em paralelo para ganhar tempo
      const [profilesRes, racesRes] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('races').select('*').order('date', { ascending: true })
      ]);

      // 3. Só atualiza o estado se o usuário ainda estiver na página
      if (isMounted) {
        if (profilesRes.data) {
          setProfiles(profilesRes.data);
          const current = profilesRes.data.find(p => p.id === user.id);
          if (current) setUserProfile(current);
        }
        if (racesRes.data) setRaces(racesRes.data);
      }
    }

    initializeHome();

    return () => {
      isMounted = false; // "Limpa" a execução se o componente sair da tela
    };
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const today = new Date().toISOString().split('T')[0];
  const upcomingRace = races?.find(race => race.date >= today);

  return (
    <main className="min-h-screen bg-background text-foreground p-6 font-sans relative pb-24">
      {/* Header */}
      <div className="flex justify-between items-center mb-10">
        <div>
          <p className="text-gray-500 text-xs uppercase tracking-widest font-bold">
            Bom dia, {userProfile?.username || 'Atleta'}
          </p>
          <h1 className="text-2xl font-black italic uppercase tracking-tighter">
            Race <span className="text-race-volt">Hub</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleLogout}
            className="p-2 text-gray-500 hover:text-red-500 transition-colors"
            title="Sair do App"
          >
            <LogOut size={20} />
          </button>
          <div className="w-10 h-10 rounded-full border-2 border-race-volt p-0.5">
            <div className="w-full h-full bg-race-gray rounded-full flex items-center justify-center text-[10px] text-foreground font-bold uppercase">
              {userProfile?.username?.substring(0, 2) || '??'}
            </div>
          </div>
        </div>
      </div>

      {/* Card Destaque */}
      {upcomingRace ? (
        <div className="bg-race-volt p-6 rounded-4xl text-black mb-8 relative overflow-hidden">
          <div className="relative z-10">
            <span className="bg-black text-white text-[10px] px-3 py-1 rounded-full font-black uppercase italic">
              {upcomingRace.status === 'Inscrito' ? 'Squad Confirmado' : 'Próxima Prova'}
            </span>
            <h2 className="text-3xl font-black uppercase italic mt-4 leading-none">{upcomingRace.name}</h2>
            <div className="flex gap-4 mt-6">
              <div className="flex items-center gap-1 font-bold text-sm leading-none">
                <Calendar size={16} /> {upcomingRace.date.split('-')[2]}/{upcomingRace.date.split('-')[1]}
              </div>
              <div className="flex items-center gap-1 font-bold text-sm leading-none">
                <Trophy size={16} /> {upcomingRace.distance.toUpperCase()}
              </div>
            </div>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-10">
            <Trophy size={150} strokeWidth={3} />
          </div>
        </div>
      ) : (
        <div className="bg-race-card p-6 rounded-4xl text-gray-500 mb-8 border border-white/5 italic text-sm text-center">
          Nenhuma prova futura no horizonte.
        </div>
      )}

      {/* Amigos (Squad) */}
      <h3 className="text-xs font-bold uppercase text-gray-500 mb-4 tracking-widest">Amigos na Pista</h3>
      <div className="flex gap-4 mb-10 overflow-x-auto pb-2 scrollbar-hide">
        {profiles.length > 0 ? (
          profiles.map((p) => (
            <div key={p.id} className="flex flex-col items-center gap-2 min-w-14">
              <div className="w-14 h-14 rounded-2xl bg-race-card border border-white/10 flex items-center justify-center font-bold text-race-volt text-xl uppercase">
                {p.username?.[0] || '?'}
              </div>
              <span className="text-[10px] font-medium text-gray-400">{p.username}</span>
            </div>
          ))
        ) : (
          <p className="text-gray-600 text-[10px] italic">Buscando o Squad...</p>
        )}
      </div>

      <h3 className="text-xs font-bold uppercase text-gray-500 mb-4 tracking-widest">Calendário 2026</h3>
      <div className="flex flex-col gap-4">
        {races.map((race) => (
          <div key={race.id} className="bg-race-card p-4 rounded-2xl border border-white/5 flex flex-col gap-3 group">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-lg leading-tight uppercase text-white">{race.name}</h4>
                <p className={`text-xs mt-1 ${race.status === 'Inscrito' ? 'text-race-volt font-bold' : 'text-gray-400'}`}>
                  {race.status}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-race-volt font-black italic">{race.distance.toUpperCase()}</span>
                <button 
                  onClick={() => setEditingRace(race)}
                  className="p-2 bg-white/5 rounded-lg hover:bg-race-volt hover:text-black transition-all"
                >
                  <Edit3 size={14} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-400 mt-2">
              <span className="flex items-center gap-1">
                <Calendar size={12} /> {race.date.split('-')[2]}/{race.date.split('-')[1]}
              </span>
              <span className="flex items-center gap-1">
                <MapPin size={12} /> {race.kit_location || 'Local TBD'}
              </span>
              {race.kit_datetime && (
                <span className="flex items-center gap-1 text-race-volt font-medium">
                  <Clock size={12} /> {race.kit_datetime}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <AddRaceModal />

      {editingRace && (
        <EditRaceModal 
          race={editingRace} 
          onClose={() => setEditingRace(null)} 
          onUpdate={refreshData}
        />
      )}
    </main>
  );
}