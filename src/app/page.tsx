'use client'; 

import { useState, useEffect, useCallback } from 'react'; 
import { Trophy, Calendar, MapPin, Edit3, Clock, LogOut, Timer, Link2, Map, Check, Flame } from 'lucide-react';
import { supabase } from './lib/supabase';
import { useRouter } from 'next/navigation';
import { AddRaceModal } from './components/AddRaceModal';
import { EditRaceModal } from './components/EditRaceModal';
import { AddFriendModal } from './components/AddFriendModal'; 
import { ChallengeModal } from './components/ChallengeModal'; 
import { Leaderboard } from './components/Leaderboard'; 

interface Race {
  id: string;
  name: string;
  date: string;
  distance: string;
  status: string;
  kit_location: string;
  kit_datetime?: string;
  registration_link?: string;
  event_location?: string;
  price?: string;
  challenged_by?: string | null;
}

interface Profile {
  id: string;
  username: string;
  avatar_url: string;
}

interface Challenge {
  id: string;
  challenger_id: string;
  challenged_id: string;
  race_id: string;
  status: string;
  race: Race;
  challenger: Profile;
}

const formatPrice = (priceStr?: string | number | null) => {
  if (priceStr === null || priceStr === undefined || priceStr === '') return '';
  const str = String(priceStr);
  const hasNumbers = /\d/.test(str);
  if (!hasNumbers) return str;
  let cleanStr = str.replace(/[^\d.,]/g, '');
  if (cleanStr.includes(',')) cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleanStr);
  if (isNaN(num)) return str;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};

export default function Home() {
  const [races, setRaces] = useState<Race[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Profile[]>([]);
  const [pendingChallenges, setPendingChallenges] = useState<Challenge[]>([]); 
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [editingRace, setEditingRace] = useState<Race | null>(null);
  const [challengingRace, setChallengingRace] = useState<Race | null>(null); 
  const [countdown, setCountdown] = useState<string>('');
  const router = useRouter();

  // LÓGICA DE SAUDAÇÃO DINÂMICA
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'BOM DIA';
    if (hour >= 12 && hour < 18) return 'BOA TARDE';
    return 'BOA NOITE';
  };

  const greeting = getGreeting();

  const refreshData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [profilesRes, racesRes, friendshipsRes, challengesRes] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('races').select('*').eq('user_id', user.id).neq('status', 'Concluído').order('date', { ascending: true }),
      supabase.from('friendships').select('*').or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`),
      supabase.from('challenges').select('*').eq('challenged_id', user.id).eq('status', 'pendente')
    ]);

    if (profilesRes.data) {
      const current = profilesRes.data.find(p => p.id === user.id);
      if (current) setUserProfile(current);

      if (friendshipsRes.data) {
        const accepted = friendshipsRes.data.filter(f => f.status === 'aceito');
        const acceptedIds = accepted.map(f => f.sender_id === user.id ? f.receiver_id : f.sender_id);
        setProfiles(profilesRes.data.filter(p => acceptedIds.includes(p.id)));

        const pending = friendshipsRes.data.filter(f => f.status === 'pendente' && f.receiver_id === user.id);
        const pendingIds = pending.map(f => f.sender_id);
        setPendingRequests(profilesRes.data.filter(p => pendingIds.includes(p.id)));
      }

      if (challengesRes.data && challengesRes.data.length > 0) {
        const raceIds = challengesRes.data.map(c => c.race_id);
        const { data: cRaces } = await supabase.from('races').select('*').in('id', raceIds);
        
        const enrichedChallenges = challengesRes.data.map(challenge => ({
          ...challenge,
          race: cRaces?.find(r => r.id === challenge.race_id),
          challenger: profilesRes.data.find(p => p.id === challenge.challenger_id)
        })).filter(c => c.race && c.challenger) as Challenge[]; 
        
        setPendingChallenges(enrichedChallenges);
      } else {
        setPendingChallenges([]);
      }
    }
    if (racesRes.data) setRaces(racesRes.data);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initializeHome() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      
      const [profilesRes, racesRes, friendshipsRes, challengesRes] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('races').select('*').eq('user_id', user.id).neq('status', 'Concluído').order('date', { ascending: true }),
        supabase.from('friendships').select('*').or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`),
        supabase.from('challenges').select('*').eq('challenged_id', user.id).eq('status', 'pendente')
      ]);

      if (isMounted) {
        if (profilesRes.data) {
          const current = profilesRes.data.find(p => p.id === user.id);
          if (current) setUserProfile(current);

          if (friendshipsRes.data) {
            const accepted = friendshipsRes.data.filter(f => f.status === 'aceito');
            const acceptedIds = accepted.map(f => f.sender_id === user.id ? f.receiver_id : f.sender_id);
            setProfiles(profilesRes.data.filter(p => acceptedIds.includes(p.id)));

            const pending = friendshipsRes.data.filter(f => f.status === 'pendente' && f.receiver_id === user.id);
            const pendingIds = pending.map(f => f.sender_id);
            setPendingRequests(profilesRes.data.filter(p => pendingIds.includes(p.id)));
          }

          if (challengesRes.data && challengesRes.data.length > 0) {
            const raceIds = challengesRes.data.map(c => c.race_id);
            const { data: cRaces } = await supabase.from('races').select('*').in('id', raceIds);
            
            const enrichedChallenges = challengesRes.data.map(challenge => ({
              ...challenge,
              race: cRaces?.find(r => r.id === challenge.race_id),
              challenger: profilesRes.data.find(p => p.id === challenge.challenger_id)
            })).filter(c => c.race && c.challenger) as Challenge[]; 
            
            setPendingChallenges(enrichedChallenges);
          }
        }
        if (racesRes.data) setRaces(racesRes.data);
      }
    }

    initializeHome();
    return () => { isMounted = false; };
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleAcceptFriend = async (friendId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('friendships').update({ status: 'aceito' }).eq('sender_id', friendId).eq('receiver_id', user.id);
    refreshData();
  };

  const handleAcceptChallenge = async (challenge: Challenge) => { 
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('challenges').update({ status: 'aceito' }).eq('id', challenge.id);

    const newRace = {
      user_id: user.id,
      name: challenge.race.name,
      date: challenge.race.date,
      distance: challenge.race.distance,
      kit_location: challenge.race.kit_location,
      status: 'A Planejar', 
      registration_link: challenge.race.registration_link,
      event_location: challenge.race.event_location,
      price: challenge.race.price,
      challenged_by: challenge.challenger.id 
    };

    await supabase.from('races').insert([newRace]);
    refreshData();
  };

  const handleDeclineChallenge = async (challengeId: string) => {
    await supabase.from('challenges').update({ status: 'recusado' }).eq('id', challengeId);
    refreshData();
  };

  const today = new Date().toISOString().split('T')[0];
  const upcomingRace = races?.find(race => race.date >= today);

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
          {/* SAUDAÇÃO DINÂMICA AQUI 👇 */}
          <p className="text-gray-500 text-xs uppercase tracking-widest font-bold">
            {greeting}, {userProfile?.username || 'ATLETA'}
          </p>
          <h1 className="text-2xl font-black italic uppercase tracking-tighter">
            Race <span className="text-race-volt">Hub</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-red-500 transition-colors" title="Sair do App">
            <LogOut size={20} />
          </button>
          <button onClick={() => router.push('/profile')} className="w-10 h-10 rounded-full border-2 border-race-volt p-0.5 hover:scale-105 active:scale-95 transition-transform" title="Ver Meu Perfil">
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
                {upcomingRace.status === 'Inscrito' ? 'Pelotão Confirmado' : 'Próxima Prova'}
              </span>
              {countdown && (
                <span className="bg-black text-white text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest flex items-center gap-1.5">
                  <Timer size={10} strokeWidth={3} /> {countdown}
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
            <div className="mt-4 flex flex-wrap gap-2">
              {upcomingRace.event_location && (
                <div className="inline-flex items-start gap-2 bg-black/10 px-3 py-2.5 rounded-lg text-xs font-bold max-w-full">
                  <Map size={14} className="shrink-0 mt-0.5" /> 
                  <span className="leading-snug wrap-break-word">{upcomingRace.event_location}</span>
                </div>
              )}
              {upcomingRace.price && (
                <div className="inline-flex items-center gap-2 bg-black/10 px-3 py-2.5 rounded-lg text-xs font-bold text-black max-w-full">
                  {formatPrice(upcomingRace.price)}
                </div>
              )}
            </div>
            {upcomingRace.registration_link && upcomingRace.status === 'A Planejar' && (
              <div className="block mt-5">
                <a href={upcomingRace.registration_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-transform">
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

      {/* SESSÃO DE DESAFIOS RECEBIDOS 🔥 */}
      {pendingChallenges.length > 0 && (
        <div className="mb-8 flex flex-col gap-3">
          <h3 className="text-xs font-bold uppercase text-race-volt tracking-widest mb-1 flex items-center gap-2">
            <Flame size={16} /> Desafios do Pelotão
          </h3>
          {pendingChallenges.map(c => (
            <div key={c.id} className="bg-linear-to-r from-race-volt/20 to-black border border-race-volt/30 rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-sm font-bold text-white uppercase leading-tight mb-1">
                  <span className="text-race-volt">{c.challenger.username}</span> te desafiou!
                </p>
                <p className="text-xs text-gray-400 font-medium">Prova: <span className="text-white italic">{c.race.name}</span></p>
                <p className="text-xs text-gray-400 font-medium mt-1">Distância: <span className="text-white">{c.race.distance}</span></p>
                
                <div className="flex gap-2 mt-4">
                  <button onClick={() => handleAcceptChallenge(c)} className="flex-1 bg-race-volt text-black text-xs font-black uppercase tracking-widest py-2.5 rounded-lg flex items-center justify-center gap-1 hover:scale-105 transition-transform">
                    <Check size={14} strokeWidth={3} /> Aceitar
                  </button>
                  <button onClick={() => handleDeclineChallenge(c.id)} className="px-4 bg-red-500/10 text-red-500 border border-red-500/20 text-xs font-black uppercase tracking-widest rounded-lg flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors">
                    Arregar
                  </button>
                </div>
              </div>
              <Flame className="absolute -right-4 -bottom-4 text-race-volt/10" size={100} />
            </div>
          ))}
        </div>
      )}

      {/* SESSÃO DE CONVITES DE AMIZADE */}
      {pendingRequests.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          {pendingRequests.map(p => (
            <div key={p.id} className="bg-race-volt/10 border border-race-volt/30 rounded-2xl p-3 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-race-volt/20 flex items-center justify-center text-race-volt font-black uppercase text-[10px]">
                  {p.username.substring(0, 2)}
                </div>
                <span className="text-xs font-bold text-white uppercase">{p.username} enviou um convite!</span>
              </div>
              <button onClick={() => handleAcceptFriend(p.id)} className="bg-race-volt text-black p-2 rounded-lg hover:scale-105 transition-transform" title="Aceitar no Pelotão">
                <Check size={16} strokeWidth={3} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* LEADERBOARD */}
      <Leaderboard />

      {/* Amigos (Pelotão) */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xs font-bold uppercase text-gray-500 tracking-widest">Pelotão</h3>
        <AddFriendModal />
      </div>

      <div className="flex gap-4 mb-10 overflow-x-auto pb-2 scrollbar-hide">
        {profiles.length > 0 ? (
          profiles.map((p) => (
            <button key={p.id} onClick={() => router.push(`/profile/${p.id}`)} className="flex flex-col items-center gap-2 min-w-14 hover:scale-105 transition-transform group">
              <div className="w-14 h-14 rounded-2xl bg-race-card border border-white/10 group-hover:border-race-volt/50 flex items-center justify-center font-bold text-race-volt text-xl uppercase shadow-sm transition-colors">
                {p.username?.[0] || '?'}
              </div>
              <span className="text-[10px] font-medium text-gray-400 group-hover:text-white transition-colors">{p.username}</span>
            </button>
          ))
        ) : (
          <p className="text-gray-600 text-[10px] italic">Você ainda não recrutou ninguém pro seu Pelotão.</p>
        )}
      </div>

      {/* Calendário e Resultados */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xs font-bold uppercase text-gray-500 tracking-widest">Calendário</h3>
        <AddRaceModal />
      </div>
      
      <div className="flex flex-col gap-4">
        {races.map((race) => (
          <div key={race.id} className="p-4 rounded-2xl border flex flex-col gap-3 transition-all bg-race-card border-white/5">
            <div className="flex justify-between items-start">
              <div className="pr-4">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-lg leading-tight uppercase text-white">{race.name}</h4>
                  {race.challenged_by && (
                     <span className="text-[10px] text-black bg-race-volt px-1.5 py-0.5 rounded font-bold uppercase italic flex items-center gap-1 shadow-sm shadow-race-volt/30">
                        <Flame size={10} /> Desafio
                     </span>
                  )}
                </div>
                <p className={`text-xs mt-1 ${race.status === 'Inscrito' ? 'text-race-volt font-bold' : 'text-gray-400'}`}>
                  {race.status}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className="text-race-volt font-black italic whitespace-nowrap">{race.distance.toUpperCase()}</span>
                <div className="flex gap-2 mt-1">
                  {profiles.length > 0 && (
                    <button onClick={() => setChallengingRace(race)} className="p-1.5 bg-race-volt/10 text-race-volt rounded-lg hover:bg-race-volt hover:text-black transition-all" title="Desafiar Pelotão">
                      <Flame size={14} />
                    </button>
                  )}
                  <button onClick={() => setEditingRace(race)} className="p-1.5 bg-white/5 rounded-lg hover:bg-white/20 transition-all">
                    <Edit3 size={14} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 mt-2">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Calendar size={12} /> {race.date.split('-')[2]}/{race.date.split('-')[1]}</span>
                {race.event_location && <span className="flex items-center gap-1 text-white"><Map size={12} className="text-race-volt" /> {race.event_location}</span>}
                {race.price && <span className="flex items-center gap-1 text-green-400 font-medium">{formatPrice(race.price)}</span>}
              </div>
              {(race.kit_location || race.kit_datetime) && (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-500 bg-white/5 p-2 rounded-lg border border-white/5">
                  <span className="font-bold uppercase text-[9px] tracking-widest text-gray-400">KIT:</span>
                  {race.kit_location && <span className="flex items-center gap-1"><MapPin size={10} /> {race.kit_location}</span>}
                  {race.kit_datetime && <span className="flex items-center gap-1"><Clock size={10} /> {race.kit_datetime}</span>}
                </div>
              )}
              {race.registration_link && race.status === 'A Planejar' && (
                <a href={race.registration_link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center justify-center gap-2 bg-race-volt/10 text-race-volt border border-race-volt/20 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-race-volt hover:text-black transition-colors">
                  <Link2 size={12} /> Link de Inscrição
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {editingRace && (
        <EditRaceModal race={editingRace} onClose={() => setEditingRace(null)} onUpdate={refreshData} />
      )}

      {challengingRace && (
        <ChallengeModal race={challengingRace} friends={profiles} onClose={() => { setChallengingRace(null); refreshData(); }} />
      )}
    </main>
  );
}