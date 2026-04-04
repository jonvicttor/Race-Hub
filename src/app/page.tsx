'use client'; 

import { useState, useEffect, useCallback } from 'react';
import { Trophy, Calendar, MapPin, Edit3, Clock, LogOut, Timer, Link2, Map, Check, Flame, MessageCircle, Activity, ChevronRight, ChevronLeft, Zap, Crown } from 'lucide-react';
import { supabase } from './lib/supabase';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { AddRaceModal } from './components/AddRaceModal';
import { EditRaceModal } from './components/EditRaceModal';
import { AddFriendModal } from './components/AddFriendModal'; 
import { ChallengeModal } from './components/ChallengeModal'; 
import { Leaderboard } from './components/Leaderboard'; 

const RouteMap = dynamic(() => import('./components/RouteMap'), { 
  ssr: false, 
  loading: () => <div className="w-full h-full bg-[#121212] animate-pulse rounded-xl flex items-center justify-center text-race-volt text-xs font-bold uppercase italic border border-white/5">Carregando Mapa...</div>
});

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
  finish_time?: string;
  pace?: string;
  user_id: string;
  activity_type?: string;
  map_url?: string;
  map_polyline?: string; 
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
  winner_id?: string;
  duel_type?: string;
  challenger_finish_time?: string; 
  challenged_finish_time?: string; 
  race: Race;
  challenger: Profile;
}

interface ActivityComment {
  id: string;
  user_id: string;
  race_id: string;
  text: string;
  created_at: string;
  profiles?: {
    username: string;
  };
}

const timeToSeconds = (timeStr: string) => {
  if (!timeStr) return 0; 
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  if (parts.length === 2) return (parts[0] * 60) + parts[1];
  return 0;
};

const formatDistance = (dist?: string) => {
  if (!dist) return '';
  const numeric = parseFloat(dist.replace(/[^\d.,]/g, '').replace(',', '.'));
  if (isNaN(numeric)) return dist.toUpperCase();
  return `${numeric.toFixed(2)} KM`;
};

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
  const [feedRaces, setFeedRaces] = useState<Race[]>([]); 
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Profile[]>([]);
  const [pendingChallenges, setPendingChallenges] = useState<Challenge[]>([]); 
  const [finishedDuels, setFinishedDuels] = useState<Challenge[]>([]); 
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [editingRace, setEditingRace] = useState<Race | null>(null);
  const [challengingRace, setChallengingRace] = useState<Race | null>(null); 
  const [countdown, setCountdown] = useState<string>('');
  
  const [mainTab, setMainTab] = useState<'feed' | 'calendario'>('feed');
  const [calViewMode, setCalViewMode] = useState<'menu' | 'provas' | 'treinos'>('menu');

  const [likes, setLikes] = useState<Record<string, string[]>>({}); 
  const [comments, setComments] = useState<Record<string, ActivityComment[]>>({}); 
  const [activeCommentRaceId, setActiveCommentRaceId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');

  const router = useRouter();

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

    const [profilesRes, racesRes, friendshipsRes, duelsRes] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('races').select('*').eq('user_id', user.id).neq('status', 'Concluído').order('date', { ascending: true }),
      supabase.from('friendships').select('*').or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`),
      supabase.from('duels').select('*').eq('challenged_id', user.id).eq('status', 'pendente')
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

        const feedIds = [user.id, ...acceptedIds];
        const { data: feedData } = await supabase
          .from('races')
          .select('*')
          .in('user_id', feedIds)
          .eq('status', 'Concluído')
          .order('date', { ascending: false })
          .limit(30);
        
        if (feedData) {
          setFeedRaces(feedData);
          const raceIds = feedData.map(r => r.id);
          
          const { data: likesData } = await supabase.from('activity_likes').select('*').in('race_id', raceIds);
          const likesMap: Record<string, string[]> = {};
          likesData?.forEach(l => {
            if (!likesMap[l.race_id]) likesMap[l.race_id] = [];
            likesMap[l.race_id].push(l.user_id);
          });
          setLikes(likesMap);

          const { data: commentsData } = await supabase.from('activity_comments').select('*, profiles(username)').in('race_id', raceIds).order('created_at', { ascending: true });
          const commentsMap: Record<string, ActivityComment[]> = {};
          commentsData?.forEach(c => {
            if (!commentsMap[c.race_id]) commentsMap[c.race_id] = [];
            commentsMap[c.race_id].push(c as ActivityComment);
          });
          setComments(commentsMap);

          const { data: duelsFinalizados } = await supabase
            .from('duels')
            .select('*, race:race_id(name, date)')
            .eq('status', 'finalizado');

          if (duelsFinalizados) {
            setFinishedDuels(duelsFinalizados as Challenge[]);
          }
        }
      }

      if (duelsRes.data && duelsRes.data.length > 0) {
        const raceIds = duelsRes.data.map(c => c.race_id);
        const { data: cRaces } = await supabase.from('races').select('*').in('id', raceIds);
        
        const enrichedChallenges = duelsRes.data.map(duel => ({
          ...duel,
          race: cRaces?.find(r => r.id === duel.race_id),
          challenger: profilesRes.data.find(p => p.id === duel.challenger_id)
        })).filter(c => c.race && c.challenger) as Challenge[]; 
        
        setPendingChallenges(enrichedChallenges);
      } else {
        setPendingChallenges([]);
      }
    }
    if (racesRes.data) setRaces(racesRes.data);
  }, []);

  useEffect(() => {
    async function initializeHome() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      await refreshData();
    }
    initializeHome();
  }, [router, refreshData]);

  const handleToggleVolt = async (raceId: string) => {
    if (!userProfile) return;
    const raceLikes = likes[raceId] || [];
    const hasLiked = raceLikes.includes(userProfile.id);

    if (hasLiked) {
      await supabase.from('activity_likes').delete().eq('race_id', raceId).eq('user_id', userProfile.id);
      setLikes(prev => ({ ...prev, [raceId]: prev[raceId].filter(id => id !== userProfile.id) }));
    } else {
      await supabase.from('activity_likes').insert({ race_id: raceId, user_id: userProfile.id });
      setLikes(prev => ({ ...prev, [raceId]: [...(prev[raceId] || []), userProfile.id] }));
    }
  };

  const handlePostComment = async (raceId: string) => {
    if (!newCommentText.trim() || !userProfile) return;

    const { data, error } = await supabase.from('activity_comments').insert({
      race_id: raceId,
      user_id: userProfile.id,
      text: newCommentText.trim()
    }).select('*, profiles(username)').single();

    if (!error && data) {
      setComments(prev => ({ ...prev, [raceId]: [...(prev[raceId] || []), data as ActivityComment] }));
      setNewCommentText('');
    }
  };

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
    
    await supabase.from('duels').update({ status: 'aceito' }).eq('id', challenge.id);
    
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
    await supabase.from('duels').update({ status: 'recusado' }).eq('id', challengeId);
    refreshData();
  };

  const today = new Date().toISOString().split('T')[0];
  const upcomingRace = races?.find(race => race.date >= today);

  useEffect(() => {
    if (!upcomingRace) return;
    const targetDate = new Date(`${upcomingRace.date}T00:00:00`);
    
    const calculateCountdown = () => {
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

    setTimeout(calculateCountdown, 0);
    const intervalId = setInterval(calculateCountdown, 1000);

    return () => clearInterval(intervalId); 
  }, [upcomingRace]);

  const listProvas = races.filter(r => r.activity_type !== 'treino');
  const listTreinos = races.filter(r => r.activity_type === 'treino');

  const renderRaceList = (items: Race[], title: string) => (
    <div className="animate-in slide-in-from-right-8 fade-in duration-300">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => setCalViewMode('menu')} className="p-2 bg-race-card rounded-xl border border-white/5 text-gray-400 hover:text-white">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-black uppercase italic tracking-tighter">
          Próximas <span className="text-race-volt">{title}</span>
        </h1>
      </div>
      <div className="flex flex-col gap-4">
        {items.length > 0 ? (
          items.map((race) => (
            <div key={race.id} className="p-4 rounded-2xl border flex flex-col gap-3 transition-all bg-race-card border-white/5">
              <div className="flex justify-between items-start">
                <div className="pr-4">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-lg leading-tight uppercase text-white truncate max-w-37.5 sm:max-w-xs">{race.name}</h4>
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
                
                {race.map_polyline ? (
                  <div className="w-10 h-10 sm:w-12 sm:h-12 ml-auto mr-2 sm:mr-4 opacity-80 shrink-0 rounded overflow-hidden relative z-0 border border-white/10">
                    <RouteMap polyline={race.map_polyline} />
                  </div>
                ) : (
                  <div className="w-10 h-10 sm:w-12 sm:h-12 ml-auto mr-2 sm:mr-4 opacity-0 shrink-0"></div>
                )}

                <div className={`flex flex-col items-end gap-2 shrink-0 ${!race.map_polyline ? 'ml-auto' : ''}`}>
                  <span className="text-race-volt font-black italic whitespace-nowrap">{formatDistance(race.distance)}</span>
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
          ))
        ) : (
          <div className="text-center p-8 border border-dashed border-white/10 rounded-2xl text-gray-500 text-sm italic">
            Nenhuma atividade agendada.
          </div>
        )}
      </div>
    </div>
  );

  const renderedDuels = new Set<string>();

  return (
    <main className="min-h-screen bg-background text-foreground p-6 font-sans relative pb-24">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
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
            <div className="w-full h-full bg-race-gray rounded-full flex items-center justify-center text-[10px] text-foreground font-bold uppercase overflow-hidden relative">
              {userProfile?.avatar_url ? (
                <Image src={userProfile.avatar_url} alt="Meu Avatar" fill className="object-cover" />
              ) : (
                <>{userProfile?.username?.substring(0, 2) || '??'}</>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* ===================== DESTAQUE GLOBAL (PRÓXIMA PROVA) ===================== */}
      <div className="animate-in fade-in duration-300">
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
                  <Trophy size={16} /> {formatDistance(upcomingRace.distance)}
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
          <div className="bg-race-card p-6 rounded-4xl text-gray-500 mb-8 border border-white/5 italic text-sm text-center hidden">
          </div>
        )}
      </div>

      {/* ===================== 🚨 NOTIFICAÇÕES GLOBAIS VIP (DESAFIOS E AMIGOS) 🚨 ===================== */}
      <div className="flex flex-col gap-3 mb-8">
        
        {/* DESAFIOS RECEBIDOS */}
        {pendingChallenges.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-bold uppercase text-race-volt tracking-widest mb-1 flex items-center gap-2">
              <Flame size={16} /> Desafios Pendentes
            </h3>
            {pendingChallenges.map(c => (
              <div key={c.id} className="bg-linear-to-r from-race-volt/20 to-black border border-race-volt/30 rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden shadow-[0_0_15px_rgba(204,255,0,0.1)]">
                <div className="relative z-10">
                  <p className="text-sm font-bold text-white uppercase leading-tight mb-1">
                    <span className="text-race-volt">{c.challenger.username}</span> te desafiou!
                  </p>
                  <p className="text-xs text-gray-400 font-medium mb-1">Prova: <span className="text-white italic">{c.race.name}</span></p>
                  {c.duel_type && (
                    <p className="text-[10px] bg-black/30 inline-block px-2 py-1 rounded border border-white/5 text-gray-300 font-bold tracking-widest uppercase">
                      MODO: <span className="text-race-volt">{c.duel_type === 'rp' ? 'Superação (RP)' : 'Velocidade'}</span>
                    </p>
                  )}
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => handleAcceptChallenge(c)} className="flex-1 bg-race-volt text-black text-xs font-black uppercase tracking-widest py-2.5 rounded-lg flex items-center justify-center gap-1 hover:scale-105 transition-transform"><Check size={14} strokeWidth={3} /> Aceitar</button>
                    <button onClick={() => handleDeclineChallenge(c.id)} className="px-4 bg-red-500/10 text-red-500 border border-red-500/20 text-xs font-black uppercase tracking-widest rounded-lg flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors">Arregar</button>
                  </div>
                </div>
                <Flame className="absolute -right-4 -bottom-4 text-race-volt/10" size={100} />
              </div>
            ))}
          </div>
        )}

        {/* CONVITES DE PELOTÃO RECEBIDOS */}
        {pendingRequests.length > 0 && (
          <div className="flex flex-col gap-2 mt-2">
            <h3 className="text-xs font-bold uppercase text-gray-500 tracking-widest mb-1 flex items-center gap-2">
              🤝 Convites do Pelotão
            </h3>
            {pendingRequests.map(p => (
              <div key={p.id} className="bg-race-volt/10 border border-race-volt/30 rounded-2xl p-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-race-volt/20 flex items-center justify-center text-race-volt font-black uppercase text-[10px] overflow-hidden relative">
                    {p.avatar_url ? <Image src={p.avatar_url} alt="Avatar" fill className="object-cover"/> : p.username.substring(0, 2)}
                  </div>
                  <span className="text-xs font-bold text-white uppercase">{p.username} enviou um convite!</span>
                </div>
                <button onClick={() => handleAcceptFriend(p.id)} className="bg-race-volt text-black p-2 rounded-lg hover:scale-105 transition-transform"><Check size={16} strokeWidth={3} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ABA DE NAVEGAÇÃO PRINCIPAL (FEED / CALENDÁRIO) */}
      <div className="flex bg-background border border-white/10 rounded-2xl p-1.5 mb-8">
        <button onClick={() => setMainTab('feed')} className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all ${mainTab === 'feed' ? 'bg-race-volt text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}>
          🔥 Feed
        </button>
        <button onClick={() => setMainTab('calendario')} className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all ${mainTab === 'calendario' ? 'bg-race-volt text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}>
          📅 Calendário
        </button>
      </div>

      {/* ===================== ABA FEED ===================== */}
      {mainTab === 'feed' && (
        <div className="animate-in fade-in duration-300 flex flex-col gap-6">
          
          <Leaderboard />

          {/* ================= SESSÃO DO PELOTÃO ================= */}
          <div className="mt-4 mb-2">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold uppercase text-gray-500 tracking-widest">Seu Pelotão</h3>
              <AddFriendModal />
            </div>
            
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {profiles.length > 0 ? profiles.map((p) => (
                <button key={p.id} onClick={() => router.push(`/profile/${p.id}`)} className="flex flex-col items-center gap-2 min-w-14 hover:scale-105 transition-transform group">
                  <div className="w-14 h-14 rounded-2xl bg-race-card border border-white/10 group-hover:border-race-volt/50 flex items-center justify-center font-bold text-race-volt text-xl uppercase shadow-sm transition-colors overflow-hidden relative">
                    {p.avatar_url ? <Image src={p.avatar_url} alt="Avatar" fill className="object-cover"/> : (p.username?.[0] || '?')}
                  </div>
                  <span className="text-[10px] font-medium text-gray-400 group-hover:text-white transition-colors">{p.username}</span>
                </button>
              )) : (
                <p className="text-gray-600 text-[10px] italic py-4">Você ainda não recrutou ninguém pro seu Pelotão.</p>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center mb-2 mt-2 pt-6 border-t border-white/5">
            <h3 className="text-xs font-bold uppercase text-gray-500 tracking-widest">Feed de Atividades</h3>
            <AddRaceModal />
          </div>

          {feedRaces.length > 0 ? feedRaces.map((activity) => {
            // 👇 LÓGICA EXATA PARA ACHAR O DUELO DO ATLETA 👇
            const duel = finishedDuels.find(d => 
              d.race?.name?.toLowerCase() === activity.name.toLowerCase() && 
              d.race?.date === activity.date &&
              (d.challenger_id === activity.user_id || d.challenged_id === activity.user_id)
            );

            // Se for um duelo finalizado, desenha a UI de Batalha (só 1 vez por duelo)
            if (duel) {
              if (renderedDuels.has(duel.id)) return null; 
              renderedDuels.add(duel.id);

              const winnerId = duel.winner_id;
              const loserId = duel.challenger_id === winnerId ? duel.challenged_id : duel.challenger_id;
              
              const winnerProfile = profiles.find(p => p.id === winnerId) || (userProfile?.id === winnerId ? userProfile : null);
              const loserProfile = profiles.find(p => p.id === loserId) || (userProfile?.id === loserId ? userProfile : null);

              const winnerTime = duel.challenger_id === winnerId ? duel.challenger_finish_time : duel.challenged_finish_time;
              const loserTime = duel.challenger_id === loserId ? duel.challenger_finish_time : duel.challenged_finish_time;

              const diffSecs = Math.abs(timeToSeconds(winnerTime || '00:00:00') - timeToSeconds(loserTime || '00:00:00'));
              const diffString = diffSecs >= 60 ? `${Math.floor(diffSecs/60)}m ${diffSecs%60}s` : `${diffSecs}s`;

              return (
                <div key={`duel-${duel.id}`} className="bg-[#121212] border border-yellow-500/30 rounded-3xl p-6 shadow-[0_0_30px_rgba(234,179,8,0.1)] flex flex-col gap-4 relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-500/20 blur-[50px] rounded-full pointer-events-none"></div>
                  
                  <div className="flex flex-col items-center text-center relative z-10">
                    <span className="text-yellow-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 mb-4">
                      <Crown size={14} strokeWidth={3} /> Resultado do Duelo
                    </span>
                    
                    <div className="w-16 h-16 rounded-full flex items-center justify-center font-black text-xl uppercase overflow-hidden relative border-2 border-yellow-500 bg-yellow-500/20 text-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.5)] mb-2">
                      {winnerProfile?.avatar_url ? <Image src={winnerProfile.avatar_url} alt="Winner" fill className="object-cover"/> : (winnerProfile?.username?.substring(0, 2) || '??')}
                    </div>
                    
                    <h3 className="text-xl font-black uppercase italic text-white">{winnerProfile?.username} VENCEU!</h3>
                    <p className="text-xs text-gray-400 font-medium">Na prova <span className="text-white italic">{activity.name}</span></p>
                  </div>

                  <div className="bg-black/50 border border-white/5 rounded-2xl p-4 flex justify-between items-center relative z-10 mt-2">
                    <div className="flex flex-col items-center flex-1">
                      <span className="text-yellow-500 font-black text-xs uppercase tracking-widest mb-1 flex items-center gap-1">
                        <Crown size={10} /> {winnerProfile?.username}
                      </span>
                      <span className="text-2xl font-black text-white italic">{winnerTime}</span>
                    </div>
                    <div className="flex flex-col items-center px-4">
                      <span className="text-gray-600 font-black italic text-sm">VS</span>
                    </div>
                    <div className="flex flex-col items-center flex-1 opacity-60">
                      <span className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-1">{loserProfile?.username}</span>
                      <span className="text-xl font-bold text-white italic">{loserTime}</span>
                    </div>
                  </div>

                  <div className="text-center relative z-10 bg-yellow-500/10 border border-yellow-500/20 rounded-xl py-2 mt-2">
                    <p className="text-yellow-500 text-[10px] font-black uppercase tracking-widest">
                      Vitória por {diffString} de diferença!
                    </p>
                  </div>
                </div>
              );
            }

            // Se a corrida for normal (não for duelo), renderiza o card padrão
            const athlete = profiles.find(p => p.id === activity.user_id) || userProfile;
            const raceLikes = likes[activity.id] || [];
            const hasLiked = userProfile && raceLikes.includes(userProfile.id);
            const raceComments = comments[activity.id] || [];

            return (
              <div key={activity.id} className="bg-[#121212] border border-white/5 rounded-3xl p-5 shadow-lg flex flex-col gap-4 relative overflow-hidden">
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-black uppercase overflow-hidden relative bg-race-volt/20 border border-race-volt/50 text-race-volt">
                      {athlete?.avatar_url ? <Image src={athlete.avatar_url} alt="Avatar" fill className="object-cover"/> : (athlete?.username?.substring(0, 2) || '??')}
                    </div>
                    <div>
                      <h4 className="font-bold text-white leading-none">{athlete?.username || 'Atleta'}</h4>
                      <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest">{activity.date.split('-').reverse().join('/')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-white/5 p-2 rounded-full text-gray-400">
                      {activity.activity_type === 'treino' ? <Activity size={16} /> : <Trophy size={16} className="text-race-volt" />}
                    </div>
                    
                    {userProfile && userProfile.id === activity.user_id && (
                      <button 
                        onClick={() => setEditingRace(activity)} 
                        className="text-gray-500 hover:text-white transition-colors" 
                        title="Editar Atividade"
                      >
                        <Edit3 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 relative z-10">
                  <h3 className="text-lg font-black uppercase italic text-white">{activity.name}</h3>
                </div>

                {activity.map_polyline ? (
                  <div className="w-full h-48 sm:h-64 bg-black/40 rounded-xl border border-white/5 overflow-hidden relative z-0 mt-2 mb-2">
                    <RouteMap polyline={activity.map_polyline} />
                  </div>
                ) : (
                   <div className="w-full h-2 mt-2 mb-2"></div>
                )}

                <div className="grid grid-cols-3 gap-2 relative z-10">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Distância</span>
                    <span className="text-base font-black text-white">{formatDistance(activity.distance)}</span>
                  </div>
                  <div className="flex flex-col border-l border-white/10 pl-3">
                    <span className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Tempo</span>
                    <span className="text-base font-black text-white">{activity.finish_time || '--:--'}</span>
                  </div>
                  <div className="flex flex-col border-l border-white/10 pl-3">
                    <span className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Pace</span>
                    <span className="text-base font-black text-white">{activity.pace ? `${activity.pace}/km` : '--'}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 mt-2 pt-4 border-t border-white/5 relative z-10">
                  <div className="flex gap-6">
                    <button 
                      onClick={() => handleToggleVolt(activity.id)} 
                      className={`flex items-center gap-2 transition-colors group ${hasLiked ? 'text-race-volt' : 'text-gray-400 hover:text-race-volt'}`}
                    >
                      <Zap size={18} className={`${hasLiked ? 'fill-race-volt' : ''} group-hover:scale-110 transition-transform`} />
                      <span className="text-xs font-bold">{raceLikes.length} Volts</span>
                    </button>
                    <button 
                      onClick={() => setActiveCommentRaceId(activeCommentRaceId === activity.id ? null : activity.id)} 
                      className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
                    >
                      <MessageCircle size={18} className="group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold">{raceComments.length} Comentários</span>
                    </button>
                  </div>

                  {activeCommentRaceId === activity.id && (
                    <div className="mt-2 flex flex-col gap-3 bg-black/20 p-3 rounded-xl border border-white/5 animate-in fade-in slide-in-from-top-2">
                      {raceComments.length > 0 ? raceComments.map(c => (
                        <div key={c.id} className="flex flex-col">
                          <span className="text-[10px] font-bold text-race-volt uppercase">{c.profiles?.username || 'Atleta'}</span>
                          <p className="text-xs text-gray-300">{c.text}</p>
                        </div>
                      )) : (
                        <p className="text-[10px] text-gray-500 italic">Seja o primeiro a incentivar!</p>
                      )}
                      
                      <div className="flex gap-2 mt-1">
                        <input 
                          type="text" 
                          value={newCommentText}
                          onChange={e => setNewCommentText(e.target.value)}
                          placeholder="Deixe um comentário..."
                          className="flex-1 bg-background border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-race-volt transition-colors"
                          onKeyDown={e => e.key === 'Enter' && handlePostComment(activity.id)}
                        />
                        <button 
                          onClick={() => handlePostComment(activity.id)} 
                          className="bg-race-volt text-black px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform"
                        >
                          Enviar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          }) : (
            <div className="text-center p-8 border border-dashed border-white/10 rounded-3xl text-gray-500 text-sm italic mt-4">
              O feed está vazio. Seja o primeiro a suar a camisa!
            </div>
          )}
        </div>
      )}

      {/* ===================== ABA CALENDÁRIO ===================== */}
      {mainTab === 'calendario' && (
        <div className="animate-in fade-in duration-300">
          
          {calViewMode === 'provas' && renderRaceList(listProvas, 'Provas')}
          {calViewMode === 'treinos' && renderRaceList(listTreinos, 'Treinos da Semana')}

          {calViewMode === 'menu' && (
            <div className="animate-in fade-in duration-300">
              
              <div className="flex justify-between items-center mb-4 mt-2">
                <h3 className="text-[10px] font-bold uppercase text-gray-500 tracking-widest flex items-center gap-1.5">
                  <Calendar size={12} className="text-race-volt" /> Agenda
                </h3>
                <AddRaceModal /> 
              </div>

              <div className="grid grid-cols-2 gap-4 mb-10">
                <button onClick={() => setCalViewMode('provas')} className="bg-linear-to-br from-race-card to-background border border-white/5 hover:border-race-volt/50 rounded-3xl p-5 flex flex-col items-start gap-4 transition-all group relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-20 h-20 bg-race-volt/5 blur-2xl rounded-full"></div>
                  <div className="w-10 h-10 rounded-full bg-race-volt/10 flex items-center justify-center text-race-volt group-hover:scale-110 transition-transform relative z-10">
                    <Trophy size={20} />
                  </div>
                  <div className="text-left w-full relative z-10 leading-none">
                    <h4 className="text-2xl font-black italic text-white mb-1">{listProvas.length}</h4>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Provas Oficiais</p>
                  </div>
                  <div className="w-full flex items-center justify-between mt-2 pt-4 border-t border-white/5 relative z-10">
                    <span className="text-[9px] text-gray-400 uppercase tracking-widest truncate max-w-[80%]">{listProvas.length > 0 ? listProvas[0].name : 'Nenhuma'}</span>
                    <ChevronRight size={12} className="text-race-volt" />
                  </div>
                </button>

                <button onClick={() => setCalViewMode('treinos')} className="bg-linear-to-br from-race-card to-background border border-white/5 hover:border-race-volt/50 rounded-3xl p-5 flex flex-col items-start gap-4 transition-all group relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-20 h-20 bg-race-volt/5 blur-2xl rounded-full"></div>
                  <div className="w-10 h-10 rounded-full bg-race-volt/10 flex items-center justify-center text-race-volt group-hover:scale-110 transition-transform relative z-10">
                    <Activity size={20} />
                  </div>
                  <div className="text-left w-full relative z-10 leading-none">
                    <h4 className="text-2xl font-black italic text-white mb-1">{listTreinos.length}</h4>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Treinos da Semana</p>
                  </div>
                  <div className="w-full flex items-center justify-between mt-2 pt-4 border-t border-white/5 relative z-10">
                    <span className="text-[9px] text-gray-400 uppercase tracking-widest">{listTreinos.length > 0 ? formatDistance(listTreinos[0].distance) : 'Nenhum'}</span>
                    <ChevronRight size={12} className="text-race-volt" />
                  </div>
                </button>
              </div>

            </div>
          )}
        </div>
      )}

      {editingRace && (
        <EditRaceModal race={editingRace} onClose={() => setEditingRace(null)} onUpdate={refreshData} />
      )}

      {challengingRace && (
        <ChallengeModal race={challengingRace} friends={profiles} onClose={() => { setChallengingRace(null); refreshData(); }} />
      )}
    </main>
  );
}