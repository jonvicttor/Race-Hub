'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Route, FileText, UserMinus, Activity, Trophy, Flame, Calendar, MapPin } from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';

// 👇 Carregamento dinâmico do mapa para evitar erros de SSR
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
}

interface Profile {
  id: string;
  username: string;
}

const formatDistance = (dist?: string) => {
  if (!dist) return '';
  const numeric = parseFloat(dist.replace(/[^\d.,]/g, '').replace(',', '.'));
  if (isNaN(numeric)) return dist.toUpperCase();
  return `${numeric.toFixed(2)} KM`;
};

// 👇 MOTOR DE NÍVEIS E INSÍGNIAS (PADRÃO RACE HUB) 👇
function calculateLevelAndInsignia(totalKm: number, numRaces: number) {
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
  let insigniaName = 'Iniciante';
  
  if (level >= 30) {
    insigniaPath = '/insignias/insignia_lenda.png';
    insigniaName = 'Lenda';
  } else if (level >= 20) {
    insigniaPath = '/insignias/insignia_mestra.png';
    insigniaName = 'Mestre';
  } else if (level >= 10) {
    insigniaPath = '/insignias/insignia_pioneira.png';
    insigniaName = 'Pioneiro';
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
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchPublicProfile() {
      if (!profileId) return;
      const { data: p } = await supabase.from('profiles').select('*').eq('id', profileId).single();
      const { data: r } = await supabase.from('races').select('*').eq('user_id', profileId).order('date', { ascending: false });

      if (isMounted) {
        if (p) setProfile(p);
        if (r) {
          setCompletedRaces(r.filter(race => race.status === 'Concluído'));
          const upcoming = r.filter(race => race.status !== 'Concluído').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          setUpcomingRaces(upcoming);
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

  const { level, xp, nextLevelXp, progress, insigniaPath, insigniaName } = calculateLevelAndInsignia(totalKm, completedRaces.length);

  return (
    <main className="min-h-screen bg-background text-foreground p-6 font-sans relative pb-24">
      {/* Header Navigation */}
      <div className="flex items-center justify-between mb-12">
        <button onClick={() => router.back()} className="p-2 bg-white/5 rounded-xl border border-white/10 text-gray-400">
          <ChevronLeft size={24} />
        </button>
        <button onClick={handleRemoveFriend} disabled={removing} className="px-3 py-2 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20 text-[10px] font-black uppercase tracking-widest">
          {removing ? '...' : 'Excluir'}
        </button>
      </div>

      {/* ÁREA DA INSÍGNIA E NÍVEL (PADRÃO JONES) */}
      <div className="flex flex-col items-center mb-12 relative">
        <div className="absolute top-10 w-40 h-40 bg-race-volt/10 blur-[80px] rounded-full"></div>
        
        <div className="relative flex flex-col items-center">
          {/* Insígnia Flutuante */}
          <div className="absolute -top-16 w-32 h-32 z-20 animate-in fade-in zoom-in duration-700">
             <Image src={insigniaPath} alt={insigniaName} fill className="object-contain drop-shadow-[0_0_20px_rgba(204,255,0,0.3)]" />
          </div>
          
          {/* Círculo do Nível */}
          <div className="w-32 h-32 rounded-full border-[6px] border-white/5 p-1 relative z-10 bg-linear-to-b from-race-card to-background shadow-2xl flex flex-col items-center justify-center">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter leading-none mb-1">Nível</span>
            <span className="text-5xl font-black italic text-white leading-none tracking-tighter">{level}</span>
            <div className="absolute -bottom-2 bg-black border border-white/10 px-2 py-0.5 rounded text-[8px] font-bold text-race-volt uppercase">
              {xp} / {nextLevelXp} XP
            </div>
          </div>
        </div>

        <h2 className="text-4xl font-black italic text-white uppercase mt-8 tracking-tighter">{profile.username}</h2>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] text-race-volt font-black uppercase tracking-[0.2em] italic border-b-2 border-race-volt/30 pb-1">Caçador de Provas</span>
        </div>

        {/* Barra de Progresso XP */}
        <div className="w-full max-w-[200px] h-1.5 bg-white/5 rounded-full mt-6 overflow-hidden border border-white/5">
           <div className="h-full bg-race-volt shadow-[0_0_15px_rgba(204,255,0,0.6)] transition-all duration-1000 ease-out" style={{ width: `${progress}%` }}></div>
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
        {completedRaces.length > 0 ? completedRaces.map((race) => (
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
        )) : <div className="text-center p-12 border border-dashed border-white/10 rounded-4xl text-gray-600 text-xs italic uppercase tracking-widest font-bold">Sem registros de elite.</div>}
      </div>
    </main>
  );
}