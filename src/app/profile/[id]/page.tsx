'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Route, FileText, UserMinus, Activity, Trophy, Flame, Calendar, MapPin, Crown } from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';

const RouteMap = dynamic<{ polyline: string }>(() => import('../../components/RouteMap'), { 
  ssr: false, 
  loading: () => <div className="w-full h-full bg-[#121212] animate-pulse rounded-xl flex items-center justify-center text-race-volt text-xs font-bold uppercase italic border border-white/5">Carregando Mapa...</div>
});

interface Race {
  id: string;
  name: string;
  date: string;
  distance: string;
  finish_time: string;
  pace: string;
  status: string;
  activity_type?: string;
  certificate_url?: string;
  map_polyline?: string;
  event_location?: string;
  challenged_by?: string | null;
  user_id: string;
}

interface Profile {
  id: string;
  username: string;
  gender?: 'M' | 'F';
  is_owner?: boolean;
  is_pioneer?: boolean;
  avatar_url?: string;
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
  race?: { name: string; date: string; };
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

// 👇 MOTOR DE NÍVEIS E INSÍGNIAS 👇
function calculateLevelAndInsignia(totalKm: number, numRaces: number, gender: 'M' | 'F') {
  let xp = Math.floor(totalKm * 10);
  xp += numRaces * 50;

  let level = 1;
  let nextLevelXp = 100;

  while (xp >= nextLevelXp) {
    level++;
    nextLevelXp = Math.floor(100 * Math.pow(1.5, level - 1));
  }

  const prevLevelXp = Math.floor(100 * Math.pow(1.5, level - 2));
  const progress = Math.floor(((xp - prevLevelXp) / (nextLevelXp - prevLevelXp)) * 100);

  let insigniaPath = '/insignias/insignia_iniciante.png';
  let insigniaName = 'Iniciante do Asfalto';
  
  if (level >= 60) {
    insigniaPath = '/insignias/insignia_lenda.png';
    insigniaName = 'Lenda do Pelotão';
  } else if (level >= 40) {
    insigniaPath = gender === 'F' ? '/insignias/insignia_mestra.png' : '/insignias/insignia_mestre.png';
    insigniaName = gender === 'F' ? 'Mestra do Asfalto' : 'Mestre do Asfalto';
  } else if (level >= 20) {
    insigniaPath = gender === 'F' ? '/insignias/insignia_cacadora.png' : '/insignias/insignia_cacador.png';
    insigniaName = gender === 'F' ? 'Caçadora de RP' : 'Caçador de RP';
  } else if (level >= 10) {
    insigniaPath = gender === 'F' ? '/insignias/insignia_focada.png' : '/insignias/insignia_focado.png';
    insigniaName = gender === 'F' ? 'Corredora Focada' : 'Corredor Focado';
  }

  return { level, xp, nextLevelXp, progress: isNaN(progress) || progress < 0 ? 0 : progress, insigniaPath, insigniaName };
}

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const profileId = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [completedRaces, setCompletedRaces] = useState<Race[]>([]);
  const [upcomingRaces, setUpcomingRaces] = useState<Race[]>([]); 
  const [finishedDuels, setFinishedDuels] = useState<Challenge[]>([]); 
  const [duelProfiles, setDuelProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchPublicProfile() {
      if (!profileId) return;
      
      const { data: p } = await supabase.from('profiles').select('*').eq('id', profileId).single();
      const { data: r } = await supabase.from('races').select('*').eq('user_id', profileId).order('date', { ascending: false });

      const { data: duels } = await supabase
        .from('duels')
        .select('*, race:race_id(name, date)')
        .eq('status', 'finalizado')
        .or(`challenger_id.eq.${profileId},challenged_id.eq.${profileId}`);

      if (isMounted) {
        if (p) setProfile(p);
        if (r) {
          setCompletedRaces(r.filter((race: Race) => race.status === 'Concluído'));
          const upcoming = r.filter((race: Race) => race.status !== 'Concluído').sort((a: Race, b: Race) => new Date(a.date).getTime() - new Date(b.date).getTime());
          setUpcomingRaces(upcoming);
        }
        
        if (duels) {
          setFinishedDuels(duels as Challenge[]);
          
          const profileIds = new Set<string>();
          // 👇 Corrigido: 'any' substituído por 'Challenge'
          (duels as Challenge[]).forEach((d: Challenge) => {
            profileIds.add(d.challenger_id);
            profileIds.add(d.challenged_id);
          });
          
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('*')
            .in('id', Array.from(profileIds));

          if (profilesData) {
            const pMap: Record<string, Profile> = {};
            // 👇 Corrigido: 'any' substituído por 'Profile'
            (profilesData as Profile[]).forEach((pr: Profile) => pMap[pr.id] = pr);
            setDuelProfiles(pMap);
          }
        }

        setLoading(false);
      }
    }
    fetchPublicProfile();
    return () => { isMounted = false; };
  }, [profileId]);

  const handleRemoveFriend = async () => {
    if (!confirm(`Remover ${profile?.username} do seu Pelotão?`)) return;
    setRemoving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      await supabase.from('friendships').delete().or(`and(sender_id.eq.${user.id},receiver_id.eq.${profileId}),and(sender_id.eq.${profileId},receiver_id.eq.${user.id})`);
      router.push('/'); 
    } catch (error) {
      console.error(error);
      setRemoving(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-race-volt font-bold uppercase animate-pulse">Sincronizando Atleta...</div>;
  if (!profile) return <div className="min-h-screen bg-background flex flex-col items-center justify-center text-white font-bold uppercase"><p>Atleta não encontrado</p></div>;

  const totalKm = completedRaces.reduce((acc, race) => {
    const km = parseFloat(race.distance.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    return acc + km;
  }, 0);

  const { level, xp, nextLevelXp, progress, insigniaPath, insigniaName } = calculateLevelAndInsignia(totalKm, completedRaces.length, profile.gender || 'M');
  const renderedDuels = new Set<string>();

  return (
    <main className="min-h-screen bg-background text-foreground p-6 font-sans relative pb-24">
      {/* Header Navigation */}
      <div className="flex items-center justify-between mb-12">
        <button onClick={() => router.back()} className="p-2 bg-white/5 rounded-xl border border-white/10 text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={24} />
        </button>
        <button onClick={handleRemoveFriend} disabled={removing} className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20 text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-colors">
          <UserMinus size={14} strokeWidth={2.5} />
          {removing ? '...' : 'Excluir'}
        </button>
      </div>

      {/* ÁREA DA FOTO E NÍVEL (PERFIL DO AMIGO) */}
      <div className="flex flex-col items-center mb-12 relative">
        <div className="absolute top-10 w-40 h-40 bg-race-volt/10 blur-[80px] rounded-full"></div>
        
        <div className="relative flex flex-col items-center">
          <div className="w-32 h-32 rounded-full border-[6px] border-white/5 p-1 relative z-10 bg-linear-to-b from-race-card to-background shadow-2xl flex flex-col items-center justify-center overflow-visible">
            <div className="w-full h-full rounded-full overflow-hidden relative flex items-center justify-center bg-background border border-white/5">
              {profile?.avatar_url ? (
                  <Image src={profile.avatar_url} alt="Avatar do Atleta" fill className="object-cover" />
              ) : (
                  <span className="text-5xl font-black italic text-race-volt uppercase">{profile?.username?.substring(0, 2) || '??'}</span>
              )}
            </div>
            <div className="absolute -bottom-3 bg-race-volt text-black border border-black px-3 py-0.5 rounded-full text-[10px] font-black uppercase italic shadow-lg z-30">
              Nível {level}
            </div>
          </div>
        </div>

        <h2 className="text-4xl font-black italic text-white uppercase mt-8 tracking-tighter">{profile.username}</h2>
        
        {/* Insígnias na parte inferior */}
        <div className="flex items-center justify-center mt-2 w-full">
          <span className="text-[10px] text-race-volt font-black uppercase tracking-[0.2em] italic border-b-2 border-race-volt/30 pb-1 mr-2 text-center">
            Atleta Pelotão • {insigniaName}
          </span>
          <div className="flex items-center gap-1.5 justify-center">
            <div className="relative group hover:scale-110 transition-transform">
              <Image src={insigniaPath} alt="Nível Insignia" width={28} height={28} className="relative shrink-0" />
            </div>
            {(profile?.is_owner || profile?.is_pioneer) && (
              <div className="flex items-center gap-1.5 border-l border-white/10 pl-2 ml-1">
                {profile?.is_owner && (
                  <div className="relative group hover:scale-110 transition-transform">
                    <Image src="/insignias/insignia_ceo_dev.png" alt="CEO/Dev" width={28} height={28} className="relative shrink-0" />
                  </div>
                )}
                {profile?.is_pioneer && (
                  <div className="relative group hover:scale-110 transition-transform">
                    <Image src={profile.gender === 'F' ? '/insignias/insignia_pioneira.png' : '/insignias/insignia_pioneiro.png'} alt="Pioneiro" width={28} height={28} className="relative shrink-0" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Barra de Progresso XP */}
        <div className="w-full max-w-50 mt-6 relative z-10">
          <div className="flex justify-between items-end mb-1 px-1">
            <span className="text-[10px] font-black text-white">{xp} XP</span>
            <span className="text-[10px] font-black text-race-volt text-opacity-80">Meta: {nextLevelXp} XP</span>
          </div>
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
             <div className="h-full bg-race-volt shadow-[0_0_15px_rgba(204,255,0,0.6)] transition-all duration-1000 ease-out" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 mb-12">
        <div className="bg-race-card border border-white/5 rounded-3xl p-5 flex flex-col gap-3 relative overflow-hidden group hover:border-race-volt/30 transition-colors">
          <Trophy className="text-race-volt/40 group-hover:text-race-volt transition-colors" size={20} />
          <div className="leading-none">
            <h4 className="text-3xl font-black italic text-white">{completedRaces.length}</h4>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-1">Concluídas</p>
          </div>
        </div>

        <div className="bg-race-card border border-white/5 rounded-3xl p-5 flex flex-col gap-3 relative overflow-hidden group hover:border-race-volt/30 transition-colors">
          <Route className="text-race-volt/40 group-hover:text-race-volt transition-colors" size={20} />
          <div className="leading-none">
            <h4 className="text-3xl font-black italic text-white">{totalKm.toFixed(2)}</h4>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-1">Km Rodados</p>
          </div>
        </div>
      </div>

      {/* Próximos Desafios (Agenda) */}
      {upcomingRaces.length > 0 && (
        <div className="mb-12">
          <h3 className="text-[10px] font-black uppercase text-gray-500 tracking-[0.3em] mb-4 flex items-center gap-2">
            <Calendar size={14} className="text-race-volt" /> Agenda do Atleta
          </h3>
          <div className="flex flex-col gap-4">
            {upcomingRaces.map(race => (
              <div key={race.id} className="p-5 rounded-3xl border border-white/5 bg-[#121212] flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-lg uppercase text-white truncate">{race.name}</h4>
                      {race.challenged_by && <span className="text-[9px] text-black bg-race-volt px-2 py-0.5 rounded font-black uppercase italic flex items-center gap-1 shadow-lg shadow-race-volt/20"><Flame size={10} /> Duelo</span>}
                    </div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase mt-1 tracking-widest">{race.status}</p>
                  </div>
                  <span className="text-race-volt font-black italic">{formatDistance(race.distance)}</span>
                </div>
                <div className="flex flex-wrap gap-4 text-[10px] text-gray-400 font-bold uppercase border-t border-white/5 pt-4">
                  <span className="flex items-center gap-1.5"><Calendar size={12} /> {race.date.split('-').reverse().join('/')}</span>
                  {race.event_location && <span className="flex items-center gap-1.5"><MapPin size={12} className="text-race-volt" /> {race.event_location}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Galeria Histórica */}
      <h3 className="text-[10px] font-black uppercase text-gray-500 tracking-[0.3em] mb-4 flex items-center gap-2">
        <Activity size={14} className="text-race-volt" /> Galeria Histórica
      </h3>
      <div className="flex flex-col gap-6">
        {completedRaces.length > 0 ? completedRaces.map((race) => {
          
          // 👇 LÓGICA DO CARD DE DUELO NA GALERIA 👇
          const duel = finishedDuels.find(d => 
            d.race?.name?.toLowerCase() === race.name.toLowerCase() && 
            d.race?.date === race.date &&
            (d.challenger_id === race.user_id || d.challenged_id === race.user_id)
          );

          if (duel) {
            if (renderedDuels.has(duel.id)) return null; 
            renderedDuels.add(duel.id);

            const winnerId = duel.winner_id;
            const loserId = duel.challenger_id === winnerId ? duel.challenged_id : duel.challenger_id;
            
            const winnerProfile = duelProfiles[winnerId || ''];
            const loserProfile = duelProfiles[loserId || ''];

            const winnerTime = duel.challenger_id === winnerId ? duel.challenger_finish_time : duel.challenged_finish_time;
            const loserTime = duel.challenger_id === loserId ? duel.challenger_finish_time : duel.challenged_finish_time;

            const diffSecs = Math.abs(timeToSeconds(winnerTime || '00:00:00') - timeToSeconds(loserTime || '00:00:00'));
            const diffString = diffSecs >= 60 ? `${Math.floor(diffSecs/60)}m ${diffSecs%60}s` : `${diffSecs}s`;

            return (
              <div key={`duel-${duel.id}`} className="bg-[#121212] border border-yellow-500/30 rounded-4xl p-6 shadow-[0_0_30px_rgba(234,179,8,0.1)] flex flex-col gap-4 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-500/20 blur-[50px] rounded-full pointer-events-none"></div>
                
                <div className="flex flex-col items-center text-center relative z-10">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center font-black text-xl uppercase overflow-hidden relative border-2 border-yellow-500 bg-yellow-500/20 text-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.5)] mb-2">
                    {winnerProfile?.avatar_url ? <Image src={winnerProfile.avatar_url} alt="Winner" fill className="object-cover"/> : (winnerProfile?.username?.substring(0, 2) || '??')}
                  </div>
                  
                  <h3 className="text-xl font-black uppercase italic text-white">{winnerProfile?.username} VENCEU!</h3>
                  <p className="text-xs text-gray-400 font-medium">Na prova <span className="text-white italic">{race.name}</span></p>
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

          // Card Normal
          return (
            <div key={race.id} className="bg-[#121212] border border-white/5 rounded-4xl p-6 shadow-xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-gray-500 group-hover:text-race-volt transition-colors">
                    {race.activity_type === 'treino' ? <Activity size={24} /> : <Trophy size={24} className="text-race-volt" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase italic text-white leading-tight">{race.name}</h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{race.date.split('-').reverse().join('/')}</p>
                  </div>
                </div>
                {race.certificate_url && <a href={race.certificate_url} target="_blank" rel="noopener noreferrer" className="p-3 bg-race-volt/10 text-race-volt rounded-2xl border border-race-volt/20 hover:bg-race-volt hover:text-black transition-all"><FileText size={20} /></a>}
              </div>

              {race.map_polyline && (
                <div className="w-full h-52 bg-black/40 rounded-3xl border border-white/5 overflow-hidden relative z-0">
                  <RouteMap polyline={race.map_polyline} />
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 mt-2 pt-4 border-t border-white/5">
                <div className="flex flex-col"><span className="text-[9px] text-gray-500 uppercase font-black">Distância</span><span className="text-lg font-black text-white">{formatDistance(race.distance)}</span></div>
                <div className="flex flex-col border-l border-white/10 pl-4"><span className="text-[9px] text-gray-500 uppercase font-black">Tempo</span><span className="text-lg font-black text-white">{race.finish_time || '--:--'}</span></div>
                <div className="flex flex-col border-l border-white/10 pl-4"><span className="text-[9px] text-gray-500 uppercase font-black">Pace</span><span className="text-lg font-black text-white">{race.pace ? `${race.pace}/km` : '--'}</span></div>
              </div>
            </div>
          );
        }) : <div className="text-center p-12 border border-dashed border-white/10 rounded-4xl text-gray-600 text-xs italic uppercase tracking-widest font-bold">Sem registros de elite.</div>}
      </div>
    </main>
  );
}