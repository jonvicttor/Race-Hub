'use client'; 

import { useState, useEffect, useCallback } from 'react'; 
import { Trophy, Calendar, MapPin, Edit3, Clock, LogOut, Timer, Zap, Link2, Map } from 'lucide-react';
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
  finish_time?: string;
  pace?: string;
  registration_link?: string;
  event_location?: string;
  price?: string;
}

interface Profile {
  id: string;
  username: string;
  avatar_url: string;
}

const formatPrice = (priceStr?: string | number | null) => {
  if (priceStr === null || priceStr === undefined || priceStr === '') return '';
  
  const str = String(priceStr);
  const hasNumbers = /\d/.test(str);
  if (!hasNumbers) return str;

  let cleanStr = str.replace(/[^\d.,]/g, '');
  
  if (cleanStr.includes(',')) {
    cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
  }

  const num = parseFloat(cleanStr);
  if (isNaN(num)) return str;

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(num);
};

export default function Home() {
  const [races, setRaces] = useState<Race[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [editingRace, setEditingRace] = useState<Race | null>(null);
  const [countdown, setCountdown] = useState<string>('');
  const router = useRouter();

  const refreshData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: p } = await supabase.from('profiles').select('*');
    const { data: r } = await supabase.from('races').select('*').order('date', { ascending: true });

    if (p) {
      const friends = p.filter(profile => profile.id !== user.id);
      setProfiles(friends);
      
      const current = p.find(profile => profile.id === user.id);
      if (current) setUserProfile(current);
    }
    if (r) setRaces(r);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initializeHome() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      const [profilesRes, racesRes] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('races').select('*').order('date', { ascending: true })
      ]);

      if (isMounted) {
        if (profilesRes.data) {
          const friends = profilesRes.data.filter(profile => profile.id !== user.id);
          setProfiles(friends);

          const current = profilesRes.data.find(p => p.id === user.id);
          if (current) setUserProfile(current);
        }
        if (racesRes.data) setRaces(racesRes.data);
      }
    }

    initializeHome();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const today = new Date().toISOString().split('T')[0];
  const upcomingRace = races?.find(race => race.date >= today);

  // --- MOTOR DA CONTAGEM REGRESSIVA ---
  useEffect(() => {
    if (!upcomingRace) return;

    const targetDate = new Date(`${upcomingRace.date}T00:00:00`);

    const updateTimer = () => {
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();

      if (difference <= 0) {
        setCountdown('É HOJE! Pra cima! 🏃‍♂️💨');
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      const h = String(hours).padStart(2, '0');
      const m = String(minutes).padStart(2, '0');
      const s = String(seconds).padStart(2, '0');

      setCountdown(`${days}d ${h}h ${m}m ${s}s`);
    };

    updateTimer(); 
    const intervalId = setInterval(updateTimer, 1000); 

    return () => clearInterval(intervalId); 
  }, [upcomingRace]);

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
          
          <button 
            onClick={() => router.push('/profile')}
            className="w-10 h-10 rounded-full border-2 border-race-volt p-0.5 hover:scale-105 active:scale-95 transition-transform"
            title="Ver Meu Perfil"
          >
            <div className="w-full h-full bg-race-gray rounded-full flex items-center justify-center text-[10px] text-foreground font-bold uppercase">
              {userProfile?.username?.substring(0, 2) || '??'}
            </div>
          </button>
        </div>
      </div>

      {/* Card Destaque */}
      {upcomingRace ? (
        <div className="bg-race-volt p-6 rounded-4xl text-black mb-8 relative overflow-hidden shadow-lg shadow-race-volt/10 flex flex-col items-start">
          <div className="relative z-10 w-full">
            <div className="flex items-center justify-between mb-2">
              <span className="bg-black text-white text-[10px] px-3 py-1 rounded-full font-black uppercase italic">
                {upcomingRace.status === 'Inscrito' ? 'Squad Confirmado' : 'Próxima Prova'}
              </span>
              
              {/* Cronômetro Discreto */}
              {countdown && (
                <span className="bg-black text-white text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest flex items-center gap-1.5">
                  <Timer size={10} strokeWidth={3} />
                  {countdown}
                </span>
              )}
            </div>

            <h2 className="text-3xl font-black uppercase italic mt-2 leading-none">{upcomingRace.name}</h2>
            
            <div className="flex gap-4 mt-4">
              <div className="flex items-center gap-1 font-bold text-sm leading-none">
                <Calendar size={16} /> {upcomingRace.date.split('-')[2]}/{upcomingRace.date.split('-')[1]}
              </div>
              <div className="flex items-center gap-1 font-bold text-sm leading-none">
                <Trophy size={16} /> {upcomingRace.distance.toUpperCase()}
              </div>
            </div>
            
            {/* Informações Extras no Destaque */}
            <div className="mt-4 flex flex-wrap gap-2">
              {upcomingRace.event_location && (
                <div className="inline-flex items-start gap-2 bg-black/10 px-3 py-2.5 rounded-lg text-xs font-bold max-w-full">
                  <Map size={14} className="shrink-0 mt-0.5" /> 
                  {/* Atualização do break-words para wrap-break-word */}
                  <span className="leading-snug wrap-break-word">{upcomingRace.event_location}</span>
                </div>
              )}
              {upcomingRace.price && (
                <div className="inline-flex items-center gap-2 bg-black/10 px-3 py-2.5 rounded-lg text-xs font-bold text-black max-w-full">
                  {formatPrice(upcomingRace.price)}
                </div>
              )}
            </div>

            {/* Botão de inscrição */}
            {upcomingRace.registration_link && upcomingRace.status === 'A Planejar' && (
              <div className="block mt-5">
                <a 
                  href={upcomingRace.registration_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-transform"
                >
                  <Link2 size={14} /> Inscrever-se
                </a>
              </div>
            )}
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
              <div className="w-14 h-14 rounded-2xl bg-race-card border border-white/10 flex items-center justify-center font-bold text-race-volt text-xl uppercase shadow-sm">
                {p.username?.[0] || '?'}
              </div>
              <span className="text-[10px] font-medium text-gray-400">{p.username}</span>
            </div>
          ))
        ) : (
          <p className="text-gray-600 text-[10px] italic">Buscando o Squad...</p>
        )}
      </div>

      {/* Calendário e Resultados + Botão Novo */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xs font-bold uppercase text-gray-500 tracking-widest">Calendário e Resultados</h3>
        <AddRaceModal />
      </div>
      
      <div className="flex flex-col gap-4">
        {races.map((race) => (
          <div key={race.id} className={`p-4 rounded-2xl border flex flex-col gap-3 transition-all ${race.status === 'Concluído' ? 'bg-race-card border-race-volt/30 shadow-lg shadow-race-volt/5' : 'bg-race-card border-white/5'}`}>
            <div className="flex justify-between items-start">
              <div className="pr-4">
                <h4 className="font-bold text-lg leading-tight uppercase text-white">{race.name}</h4>
                <p className={`text-xs mt-1 ${race.status === 'Inscrito' ? 'text-race-volt font-bold' : race.status === 'Concluído' ? 'text-green-400 font-bold' : 'text-gray-400'}`}>
                  {race.status === 'Concluído' ? '🏁 Concluída' : race.status}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className="text-race-volt font-black italic whitespace-nowrap">{race.distance.toUpperCase()}</span>
                <button 
                  onClick={() => setEditingRace(race)}
                  className="p-2 bg-white/5 rounded-lg hover:bg-race-volt hover:text-black transition-all"
                >
                  <Edit3 size={14} />
                </button>
              </div>
            </div>

            {/* Exibição dos Tempos se a prova estiver concluída */}
            {race.status === 'Concluído' && (race.finish_time || race.pace) ? (
              <div className="grid grid-cols-2 gap-2 mt-2 bg-black/40 p-3 rounded-xl border border-white/5">
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase text-gray-500 font-bold flex items-center gap-1"><Timer size={10} /> Tempo</span>
                  <span className="text-sm font-black italic text-white">{race.finish_time || '--:--:--'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase text-gray-500 font-bold flex items-center gap-1"><Zap size={10} /> Pace</span>
                  <span className="text-sm font-black italic text-race-volt">{race.pace || '--:--'} min/km</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 mt-2">
                {/* Linha 1: Data e Local do Evento (Opcional) */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} /> {race.date.split('-')[2]}/{race.date.split('-')[1]}
                  </span>
                  
                  {race.event_location && (
                    <span className="flex items-center gap-1 text-white">
                      <Map size={12} className="text-race-volt" /> {race.event_location}
                    </span>
                  )}

                  {race.price && (
                    <span className="flex items-center gap-1 text-green-400 font-medium">
                      {formatPrice(race.price)}
                    </span>
                  )}
                </div>

                {/* Linha 2: Informações do Kit (Opcional) */}
                {(race.kit_location || race.kit_datetime) && (
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-500 bg-white/5 p-2 rounded-lg border border-white/5">
                    <span className="font-bold uppercase text-[9px] tracking-widest text-gray-400">KIT:</span>
                    {race.kit_location && (
                      <span className="flex items-center gap-1">
                        <MapPin size={10} /> {race.kit_location}
                      </span>
                    )}
                    {race.kit_datetime && (
                      <span className="flex items-center gap-1">
                        <Clock size={10} /> {race.kit_datetime}
                      </span>
                    )}
                  </div>
                )}

                {/* Botão de Inscrição no Card da Lista */}
                {race.registration_link && race.status === 'A Planejar' && (
                  <a 
                    href={race.registration_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center justify-center gap-2 bg-race-volt/10 text-race-volt border border-race-volt/20 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-race-volt hover:text-black transition-colors"
                  >
                    <Link2 size={12} /> Link de Inscrição
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

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