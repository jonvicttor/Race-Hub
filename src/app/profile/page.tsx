'use client';

import { useEffect, useState, useMemo, Suspense, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Medal, TrendingUp, Route, Edit2, Check, X, FileText, BarChart3, Activity, Target, ChevronRight, Trophy, Map, Timer, Link2, Calendar, RefreshCw } from 'lucide-react';
import { AddRaceModal } from '../components/AddRaceModal'; 
import Image from 'next/image';

interface Race {
  id: string;
  name: string;
  date: string; 
  distance: string;
  finish_time: string;
  pace: string;
  status: string;
  certificate_url?: string; 
  activity_type?: string; 
  event_location?: string;
  price?: string | number | null;
  registration_link?: string;
  map_polyline?: string; // 👇 Novo campo do Mapa
}

interface Profile {
  id: string;
  username: string;
  monthly_goal?: number; 
  gender?: 'M' | 'F'; 
  is_owner?: boolean; 
  is_pioneer?: boolean; 
  strava_access_token?: string; 
}

interface ChartPoint {
  label: string;
  year: number;
  monthIndex: number;
  totalKm: number;
  provaKm: number;
  treinoKm: number;
}

// 👇 Função Mágica que Descriptografa a Rota do Strava (CORRIGIDA) 👇
const decodePolyline = (str: string) => {
  let index = 0, lat = 0, lng = 0;
  const coordinates = [];
  while (index < str.length) {
    let b, shift = 0, result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;
    shift = 0;
    result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;
    coordinates.push([lat / 1e5, lng / 1e5]);
  }
  return coordinates;
};

// 👇 Componente que desenha o Mapa em Neon 👇
const RouteMap = ({ polyline }: { polyline: string }) => {
  const coords = useMemo(() => decodePolyline(polyline), [polyline]);
  
  if (!coords || coords.length === 0) return null;

  const lats = coords.map(c => c[0]);
  const lngs = coords.map(c => c[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latRange = maxLat - minLat || 0.01;
  const lngRange = maxLng - minLng || 0.01;
  
  const width = 100;
  const height = (latRange / lngRange) * 100;

  const points = coords.map(([lat, lng]) => {
    const x = ((lng - minLng) / lngRange) * width;
    const y = height - ((lat - minLat) / latRange) * height; 
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`-5 -5 ${width + 10} ${height + 10}`} className="w-full h-full drop-shadow-[0_0_5px_rgba(209,255,0,0.8)] overflow-visible">
      <polyline points={points} fill="none" stroke="#d1ff00" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

const getPatentData = (level: number, gender: 'M' | 'F') => {
  if (level >= 60) return { 
    name: 'Lenda do Pelotão', 
    insignia: '/insignias/insignia_lenda.png' 
  };
  if (level >= 40) return { 
    name: gender === 'F' ? 'Mestra do Asfalto' : 'Mestre do Asfalto', 
    insignia: gender === 'F' ? '/insignias/insignia_mestra.png' : '/insignias/insignia_mestre.png' 
  };
  if (level >= 20) return { 
    name: gender === 'F' ? 'Caçadora de RP' : 'Caçador de RP', 
    insignia: gender === 'F' ? '/insignias/insignia_cacadora.png' : '/insignias/insignia_cacador.png' 
  };
  if (level >= 10) return { 
    name: gender === 'F' ? 'Corredora Focada' : 'Corredor Focado', 
    insignia: gender === 'F' ? '/insignias/insignia_focada.png' : '/insignias/insignia_focado.png' 
  };
  return { 
    name: 'Iniciante do Asfalto', 
    insignia: '/insignias/insignia_iniciante.png' 
  };
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

function ProfileContent() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [completedRaces, setCompletedRaces] = useState<Race[]>([]);
  const [isStravaConnected, setIsStravaConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newGender, setNewGender] = useState<'M' | 'F'>('M');
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [newGoal, setNewGoal] = useState('');
  const [viewMode, setViewMode] = useState<'perfil' | 'provas' | 'treinos'>('perfil');
  const [countdown, setCountdown] = useState<string>('');
  const [selectedInsignia, setSelectedInsignia] = useState<{ src: string, title: string } | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const hasFetchedToken = useRef(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchProfileData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push('/login');
        return;
      }

      const code = searchParams.get('code');
      
      // 👇 Verifica o código e se já tentou buscar o token 👇
      if (code && !hasFetchedToken.current) {
        hasFetchedToken.current = true;
        
        // 🚀 LIMPA A URL NA HORA para o Next.js não tentar rodar o mesmo código duas vezes!
        window.history.replaceState({}, document.title, '/profile');

        try {
          const response = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: 220016, 
              client_secret: 'ff187c140ae7d513c5e8e297da714062879305ec', // 🔴 COLE SUA SENHA COPIADA DO STRAVA AQUI 🔴
              code: code,
              grant_type: 'authorization_code'
            })
          });

          const data = await response.json();
          console.log("Resposta do Strava:", data); // Adicionado para vermos o que ele responde!

          if (data.access_token) {
            const { error: dbError } = await supabase.from('profiles').update({
              strava_access_token: data.access_token,
              strava_refresh_token: data.refresh_token,
              strava_expires_at: data.expires_at
            }).eq('id', session.user.id);

            if (dbError) {
              console.error("Erro do banco de dados (Supabase):", dbError);
              alert("Erro ao salvar as chaves. Você criou as colunas strava_access_token, strava_refresh_token e strava_expires_at no Supabase?");
            } else {
              setIsStravaConnected(true);
            }
          } else {
            console.error("Strava recusou o acesso:", data);
            alert("O Strava recusou a conexão. Verifique o Console (F12) para detalhes.");
          }
        } catch (error) {
          console.error('Erro na requisição do token:', error);
        }
      }

      const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      const { data: r } = await supabase.from('races').select('*').eq('user_id', session.user.id).order('date', { ascending: false });

      if (isMounted) {
        if (p) {
          setProfile(p);
          setNewUsername(p.username); 
          setNewGender(p.gender || 'M');
          setNewGoal(p.monthly_goal?.toString() || '50'); 
          if (p.strava_access_token) setIsStravaConnected(true);
        }
        if (r) setCompletedRaces(r);
      }
    }

    fetchProfileData();
    return () => { isMounted = false; };
  }, [router, searchParams]);

  const handleConnectStrava = () => {
    const clientId = '220016';
    const redirectUri = `${window.location.origin}/profile`; 
    const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&approval_prompt=force&scope=activity:read_all`;
    window.location.href = stravaAuthUrl;
  };

  const syncStravaActivities = async () => {
    console.log("Iniciando sincronização...");
    console.log("Token Atual:", profile?.strava_access_token);

    if (!profile?.strava_access_token) {
      alert("⚠️ Chave de acesso não encontrada na memória. Dê um F5 na página e tente novamente!");
      return;
    }
    
    setIsSyncing(true);

    try {
      const response = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=5', {
        headers: { Authorization: `Bearer ${profile.strava_access_token}` }
      });

      console.log("Status da resposta da API de Atividades:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Detalhes do Erro da API:", errorData);
        throw new Error('Token inválido ou expirado');
      }

      const activities = await response.json();
      console.log("Atividades recebidas:", activities);
      let newRacesAdded = 0;

      for (const act of activities) {
        if (act.type !== 'Run') continue;

        const dateStr = act.start_date_local.split('T')[0];
        const alreadyExists = completedRaces.some(r => r.date === dateStr && r.name === act.name);
        if (alreadyExists) continue;

        const distKm = (act.distance / 1000).toFixed(2);
        
        const timeSec = act.moving_time;
        const hrs = Math.floor(timeSec / 3600);
        const mins = Math.floor((timeSec % 3600) / 60);
        const secs = timeSec % 60;
        const timeStr = hrs > 0 
          ? `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}` 
          : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        const speedMps = act.average_speed;
        let paceStr = '00:00';
        if (speedMps > 0) {
          const paceMinDec = (1000 / speedMps) / 60;
          const paceMin = Math.floor(paceMinDec);
          const paceSec = Math.floor((paceMinDec - paceMin) * 60);
          paceStr = `${paceMin.toString().padStart(2, '0')}:${paceSec.toString().padStart(2, '0')}`;
        }

        // 👇 Enviando a Rota do Mapa (map_polyline) para o Supabase 👇
        const { error } = await supabase.from('races').insert({
          user_id: profile.id,
          name: act.name,
          date: dateStr,
          distance: distKm,
          finish_time: timeStr,
          pace: paceStr,
          status: 'Concluído',
          activity_type: 'treino',
          event_location: 'Strava',
          map_polyline: act.map?.summary_polyline || null 
        });

        if (error) {
           console.error("Erro ao inserir no Supabase:", error);
        } else {
           newRacesAdded++;
        }
      }

      if (newRacesAdded > 0) {
        alert(`A Pista ferveu! 🔥 ${newRacesAdded} novos treinos importados com sucesso.`);
        window.location.reload(); 
      } else {
        alert('Seu diário está em dia! Nenhum treino novo encontrado.');
      }

    } catch (error) {
      console.error(error);
      alert('Erro ao puxar dados do Strava. Verifique o console (F12) para ver os detalhes. Pode ser que o token tenha expirado.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveUsernameAndGender = async () => {
    if (!profile || (!newUsername.trim() || newUsername === profile.username) && newGender === profile.gender) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);

    try {
      const { data: existingUser } = await supabase.from('profiles').select('id').ilike('username', newUsername.trim()).neq('id', profile.id).single();

      if (existingUser) {
        alert('Este Nickname já está em uso por outro atleta. Escolha outro!');
        setIsSaving(false);
        return;
      }

      const { error } = await supabase.from('profiles').update({ username: newUsername.trim(), gender: newGender }).eq('id', profile.id);

      if (error) throw error;

      setProfile({ ...profile, username: newUsername.trim(), gender: newGender });
      setIsEditing(false);

    } catch (error) {
      console.error(error);
      alert('Erro ao atualizar Perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveGoal = async () => {
    if (!profile) return;
    const goalVal = parseInt(newGoal);
    
    if (isNaN(goalVal) || goalVal <= 0) {
      alert("Insira um valor válido para a sua meta.");
      return;
    }

    try {
      const { error } = await supabase.from('profiles').update({ monthly_goal: goalVal }).eq('id', profile.id);
      if (error) throw error;

      setProfile({ ...profile, monthly_goal: goalVal });
      setIsEditingGoal(false);
    } catch (error) {
      console.error(error);
      alert('Erro ao atualizar a meta.');
    }
  };

  const finishedRaces = completedRaces.filter(r => r.status === 'Concluído');
  
  const totalKm = parseFloat(finishedRaces.reduce((acc, race) => {
    const km = parseFloat(race.distance.replace(/[^\d.]/g, '')) || 0;
    return acc + km;
  }, 0).toFixed(2));

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const currentMonthName = new Date().toLocaleString('pt-BR', { month: 'long' });

  const currentMonthKm = useMemo(() => {
    const sum = finishedRaces.reduce((acc, race) => {
      if (!race.date) return acc;
      const [y, m] = race.date.split('-');
      if (parseInt(y) === currentYear && parseInt(m) - 1 === currentMonth) {
        return acc + (parseFloat(race.distance.replace(/[^\d.]/g, '')) || 0);
      }
      return acc;
    }, 0);
    return parseFloat(sum.toFixed(2));
  }, [finishedRaces, currentMonth, currentYear]);

  const currentGoal = profile?.monthly_goal || 50;
  const progressPercent = Math.min((currentMonthKm / currentGoal) * 100, 100);

  const xpSystem = useMemo(() => {
    const TREINO_XP_PER_KM = 100;
    const PROVA_XP_PER_KM = 200; 
    const RP_BONUS_XP = 1000;

    let earnedBonus = 0;
    if (currentGoal <= 50) {
      earnedBonus = 1000;
    } else if (currentGoal <= 100) {
      earnedBonus = 2000;
    } else if (currentGoal <= 200) {
      earnedBonus = 3000;
    } else if (currentGoal <= 300) {
      earnedBonus = 4000;
    } else {
      earnedBonus = 5000;
    }

    let totalXp = 0;
    const bestPacesByDistance: Record<string, number> = {};

    finishedRaces.forEach(race => {
      const km = parseFloat(race.distance.replace(/[^\d.]/g, '')) || 0;
      const isProva = race.activity_type !== 'treino';
      let raceXp = km * (isProva ? PROVA_XP_PER_KM : TREINO_XP_PER_KM);

      const paceString = race.pace ? race.pace.replace(' /km', '') : '';
      const [min, sec] = paceString.split(':');
      const paceInSeconds = (parseInt(min) * 60) + (parseInt(sec)) || 0;

      if (paceInSeconds > 0) {
        if (!bestPacesByDistance[km.toString()] || paceInSeconds < bestPacesByDistance[km.toString()]) {
          bestPacesByDistance[km.toString()] = paceInSeconds;
          raceXp += RP_BONUS_XP;
        }
      }
      totalXp += raceXp;
    });

    if (progressPercent >= 100) {
      totalXp += earnedBonus;
    }

    let currentLevel = 1;
    let xpNeededForNext = 1000; 
    let tempXp = totalXp;

    while (tempXp >= xpNeededForNext) {
      tempXp -= xpNeededForNext;
      currentLevel++;
      
      if (currentLevel < 20) {
        xpNeededForNext = 1000 + (currentLevel * 50); 
      } else {
        xpNeededForNext = 1000 + (currentLevel * 120); 
      }
    }

    const levelProgressPercent = Math.min((tempXp / xpNeededForNext) * 100, 100);
    const patentData = getPatentData(currentLevel, profile?.gender || 'M');

    return { totalXp, currentLevel, tempXp, xpNeededForNext, levelProgressPercent, patentData, earnedBonus };
  }, [finishedRaces, profile?.gender, progressPercent, currentGoal]);

  const { chartPoints, maxKm } = useMemo(() => {
    const points: ChartPoint[] = [];
    const d = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const past = new Date(d.getFullYear(), d.getMonth() - i, 1);
      points.push({
        label: past.toLocaleString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase(),
        year: past.getFullYear(),
        monthIndex: past.getMonth(),
        totalKm: 0,
        provaKm: 0,
        treinoKm: 0
      });
    }

    let highest = 0;
    
    finishedRaces.forEach(race => {
      if (!race.date) return;
      const [y, m] = race.date.split('-');
      const raceYear = parseInt(y);
      const raceMonth = parseInt(m) - 1;

      const match = points.find(data => data.year === raceYear && data.monthIndex === raceMonth);
      if (match) {
        const km = parseFloat(race.distance.replace(/[^\d.]/g, '')) || 0;
        match.totalKm += km;
        
        if (race.activity_type === 'treino') {
          match.treinoKm += km;
        } else {
          match.provaKm += km;
        }
      }
    });

    points.forEach(p => {
      p.totalKm = parseFloat(p.totalKm.toFixed(2));
      p.treinoKm = parseFloat(p.treinoKm.toFixed(2));
      p.provaKm = parseFloat(p.provaKm.toFixed(2));
      if (p.totalKm > highest) highest = p.totalKm;
    });

    return { chartPoints: points, maxKm: highest };
  }, [finishedRaces]);

  const chartHeight = 160; 
  const chartWidth = 1000; 

  const { linePath, areaPath, pointsCoords } = useMemo(() => {
    if (chartPoints.length < 2 || maxKm === 0) {
      return { linePath: '', areaPath: '', pointsCoords: [] };
    }

    const effectiveMaxKm = maxKm * 1.1; 
    const stepX = chartWidth / (chartPoints.length - 1);
    
    const coords = chartPoints.map((point, index) => {
      const x = stepX * index;
      const y = chartHeight - (point.totalKm / effectiveMaxKm) * chartHeight;
      const percentX = (index / (chartPoints.length - 1)) * 100;
      return { x, y, percentX, totalKm: point.totalKm };
    });

    let linePathD = `M ${coords[0].x},${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      linePathD += ` L ${coords[i].x},${coords[i].y}`;
    }

    let areaPathD = `M 0,${chartHeight} L ${coords[0].x},${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      areaPathD += ` L ${coords[i].x},${coords[i].y}`;
    }
    areaPathD += ` L ${chartWidth},${chartHeight} Z`;

    return { linePath: linePathD, areaPath: areaPathD, pointsCoords: coords };
  }, [chartPoints, maxKm, chartHeight, chartWidth]);

  const today = new Date().toISOString().split('T')[0];
  const upcomingRace = completedRaces
    .filter(r => r.status !== 'Concluído' && r.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  useEffect(() => {
    if (!upcomingRace) return;
    const targetDate = new Date(`${upcomingRace.date}T00:00:00`);
    const calculateCountdown = () => {
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();
      if (difference <= 0) { setCountdown('É HOJE! Pra cima! 🏃‍♂️💨'); return; }
      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);
      const h = String(hours).padStart(2, '0'); const m = String(minutes).padStart(2, '0'); const s = String(seconds).padStart(2, '0');
      setCountdown(`${days}d ${h}h ${m}m ${s}s`);
    };
    setTimeout(calculateCountdown, 0);
    const intervalId = setInterval(calculateCountdown, 1000);
    return () => clearInterval(intervalId); 
  }, [upcomingRace]);

  const listProvas = finishedRaces.filter(r => r.activity_type !== 'treino');
  const listTreinos = finishedRaces.filter(r => r.activity_type === 'treino');

  const renderList = (items: Race[], title: string) => (
    <div className="animate-in slide-in-from-right-8 fade-in duration-300">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => setViewMode('perfil')} 
          className="p-2 bg-race-card rounded-xl border border-white/5 text-gray-400 hover:text-white"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-black uppercase italic tracking-tighter">
          Minhas <span className="text-race-volt">{title}</span>
        </h1>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xs font-bold uppercase text-gray-500 tracking-widest">
          {items.length} {title} Registradas
        </h3>
        <AddRaceModal /> 
      </div>

      <div className="flex flex-col gap-4">
        {items.length > 0 ? (
          items.map((race) => (
            <div key={race.id} className="bg-race-volt/5 border border-race-volt/20 p-4 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-race-volt/20 p-3 rounded-full text-race-volt shrink-0">
                  {race.activity_type === 'treino' ? <Activity size={24} /> : <Medal size={24} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    {/* 👇 CORREÇÃO DO TAILWIND APLICADA AQUI 👇 */}
                    <h4 className="font-bold text-white uppercase leading-tight truncate max-w-37.5 sm:max-w-xs">{race.name}</h4>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-gray-400">{formatDistance(race.distance)}</p>
                    <span className="text-[10px] text-gray-600 font-bold">•</span>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">{race.date.split('-').reverse().join('/')}</p>
                  </div>
                  
                  {race.certificate_url && (
                    <a 
                      href={race.certificate_url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="mt-2 inline-flex items-center gap-1.5 text-[10px] uppercase font-bold text-race-volt bg-race-volt/10 px-2 py-1 rounded hover:bg-race-volt hover:text-black transition-colors"
                    >
                      <FileText size={10} /> Certificado Oficial
                    </a>
                  )}
                </div>
              </div>

              {/* 👇 O MAPA ENTRA AQUI SE ELE EXISTIR 👇 */}
              {race.map_polyline && (
                <div className="w-10 h-10 sm:w-12 sm:h-12 ml-auto mr-2 sm:mr-4 opacity-80 shrink-0">
                  <RouteMap polyline={race.map_polyline} />
                </div>
              )}

              <div className={`flex flex-col items-end shrink-0 ${!race.map_polyline ? 'ml-auto' : ''}`}>
                <span className="font-black italic text-race-volt">{race.finish_time || '--:--'}</span>
                <span className="text-[10px] text-gray-500 font-bold uppercase">{race.pace ? `${race.pace} /km` : ''}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center p-8 border border-dashed border-white/10 rounded-2xl text-gray-500 text-sm italic">
            Nenhum registro encontrado. A pista te espera!
          </div>
        )}
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-background text-foreground p-6 font-sans pb-24">
      
      {viewMode === 'provas' && renderList(listProvas, 'Provas')}
      {viewMode === 'treinos' && renderList(listTreinos, 'Treinos')}

      {viewMode === 'perfil' && (
        <div className="animate-in fade-in duration-300">
          
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => router.push('/')} 
                className="p-2 bg-race-card rounded-xl border border-white/5 text-gray-400 hover:text-white"
              >
                <ChevronLeft size={24} />
              </button>
              <h1 className="text-xl font-black uppercase italic tracking-tighter">
                Meu <span className="text-race-volt">Perfil</span>
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {isStravaConnected && (
                <button 
                  onClick={syncStravaActivities}
                  disabled={isSyncing}
                  className="p-2 bg-race-volt/10 text-race-volt border border-race-volt/20 rounded-xl hover:bg-race-volt hover:text-black transition-all disabled:opacity-50"
                  title="Sincronizar Strava"
                >
                  <RefreshCw size={20} className={isSyncing ? 'animate-spin' : ''} />
                </button>
              )}

              <button 
                onClick={isStravaConnected ? undefined : handleConnectStrava}
                disabled={isStravaConnected}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${
                  isStravaConnected 
                  ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                  : 'bg-orange-600 text-white hover:bg-orange-500 active:scale-95 shadow-lg shadow-orange-600/20'
                }`}
              >
                <Image src="/strava-icon.png" alt="Strava" width={14} height={14} className={isStravaConnected ? 'opacity-50 grayscale' : ''} />
                {isStravaConnected ? 'Conectado' : 'Conectar Strava'}
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center mb-8 relative">
            <div className="w-28 h-28 rounded-full border-4 border-background p-1.5 mb-2 shadow-2xl shadow-race-volt/10 bg-race-volt/5 relative z-10 flex flex-col items-center justify-center">
              <div className="flex flex-col items-center leading-none mt-2">
                <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Nível</span>
                <span className="text-6xl font-black italic text-white tracking-tighter">{xpSystem.currentLevel}</span>
              </div>
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-baseline gap-0.5 bg-background border border-white/5 px-2.5 py-1 rounded-full text-center whitespace-nowrap">
                <span className="text-[9px] font-black text-white">{Math.round(xpSystem.tempXp)}</span>
                <span className="text-[8px] text-gray-600 font-bold uppercase tracking-wider">/</span>
                <span className="text-[9px] font-black text-race-volt">{Math.round(xpSystem.xpNeededForNext)}<span className="text-[7px] not-italic font-bold">XP</span></span>
              </div>
            </div>

            {isEditing ? (
              <div className="flex flex-col items-center gap-3 mt-4">
                <input 
                  type="text" 
                  value={newUsername} 
                  onChange={(e) => setNewUsername(e.target.value)} 
                  className="bg-background border border-race-volt text-white rounded-lg px-3 py-1 text-center font-bold uppercase outline-none w-48 text-2xl mb-1" 
                  autoFocus 
                />
                
                <div className="flex gap-2 w-full max-w-sm mb-2">
                  <button 
                    type="button" 
                    onClick={() => setNewGender('M')} 
                    className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-colors ${newGender === 'M' ? 'bg-race-volt text-black' : 'text-gray-500 bg-white/5'}`}
                  >
                    Masculino
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setNewGender('F')} 
                    className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-colors ${newGender === 'F' ? 'bg-race-volt text-black' : 'text-gray-500 bg-white/5'}`}
                  >
                    Feminino
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={handleSaveUsernameAndGender} disabled={isSaving} className="bg-race-volt text-black p-2 rounded-lg hover:scale-105 disabled:opacity-50 transition-transform"><Check size={20} strokeWidth={3} /></button>
                  <button onClick={() => { setIsEditing(false); setNewUsername(profile?.username || ''); setNewGender(profile?.gender || 'M'); }} className="bg-red-500/20 text-red-500 p-2 rounded-lg hover:bg-red-500 hover:text-white transition-colors"><X size={20} strokeWidth={3} /></button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 mt-2 relative group cursor-pointer" onClick={() => setIsEditing(true)}>
                <h2 className="text-3xl font-black text-white uppercase tracking-tight">{profile?.username}</h2>
                <div className="absolute top-1/2 -right-6 -translate-y-1/2"><Edit2 size={16} className="text-gray-500 group-hover:text-race-volt transition-colors" /></div>
              </div>
            )}

            <div className="flex flex-col items-center justify-center mt-3 w-full">
              <div className="flex items-center justify-center ml-6">
                <span className="text-race-volt font-bold text-[11px] tracking-widest uppercase mr-2 text-center">
                  {xpSystem.patentData.name}
                </span>

                <div className="flex items-center gap-1.5 justify-center">
                  <div 
                    className="relative group cursor-pointer hover:scale-110 transition-transform" 
                    title={`Patente Atual: ${xpSystem.patentData.name}`}
                    onClick={() => setSelectedInsignia({ src: xpSystem.patentData.insignia, title: `Patente Atual: ${xpSystem.patentData.name}` })}
                  >
                    <Image src={xpSystem.patentData.insignia} alt="Nível Insignia" width={28} height={28} className="relative shrink-0" />
                  </div>

                  {(profile?.is_owner || profile?.is_pioneer) && (
                    <div className="flex items-center gap-1.5 border-l border-white/10 pl-2 ml-1">
                      {profile?.is_owner && (
                        <div 
                          className="relative group cursor-pointer hover:scale-110 transition-transform" 
                          title="CEO & Desenvolvedor"
                          onClick={() => setSelectedInsignia({ src: "/insignias/insignia_ceo_dev.png", title: "CEO & Desenvolvedor" })}
                        >
                          <Image src="/insignias/insignia_ceo_dev.png" alt="Jones CEO/Dev" width={28} height={28} className="relative shrink-0" />
                        </div>
                      )}
                      {profile?.is_pioneer && (
                        <div 
                          className="relative group cursor-pointer hover:scale-110 transition-transform" 
                          title="Atleta Pioneiro"
                          onClick={() => setSelectedInsignia({ 
                            src: profile.gender === 'F' ? '/insignias/insignia_pioneira.png' : '/insignias/insignia_pioneiro.png', 
                            title: "Atleta Pioneiro" 
                          })}
                        >
                          <Image src={profile.gender === 'F' ? '/insignias/insignia_pioneira.png' : '/insignias/insignia_pioneiro.png'} alt="Pioneiro" width={28} height={28} className="relative shrink-0" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="w-full max-w-md h-1.5 bg-white/5 rounded-full overflow-hidden mt-6 relative shadow-inner">
                <div className="h-full bg-race-volt rounded-full transition-all duration-1000 ease-out relative" style={{ width: `${xpSystem.levelProgressPercent}%` }}>
                  <div className="absolute right-0 top-0 bottom-0 w-10 bg-linear-to-r from-transparent to-white/50 blur-[1px]"></div>
                </div>
            </div>
          </div>

          {upcomingRace && (
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
          )}

          <div className="bg-race-card border border-white/5 rounded-3xl p-5 mb-4 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-race-volt/5 blur-3xl rounded-full"></div>
            
            <div className="flex justify-between items-start mb-4 relative z-10">
              <h3 className="text-xs font-bold uppercase text-gray-500 tracking-widest flex items-center gap-2">
                <Target size={16} className="text-race-volt" /> Meta de {currentMonthName}
              </h3>
              {isEditingGoal ? (
                <div className="flex items-center gap-1">
                  <input 
                    type="number" 
                    value={newGoal} 
                    onChange={(e) => setNewGoal(e.target.value)} 
                    className="w-14 bg-background border border-race-volt rounded p-1 text-white text-xs text-center outline-none" 
                    autoFocus 
                  />
                  <button 
                    onClick={handleSaveGoal} 
                    className="text-race-volt bg-race-volt/20 p-1 rounded hover:bg-race-volt hover:text-black"
                  >
                    <Check size={14} />
                  </button>
                  <button 
                    onClick={() => setIsEditingGoal(false)} 
                    className="text-red-500 bg-red-500/20 p-1 rounded hover:bg-red-500 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setIsEditingGoal(true)} 
                  className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1 hover:text-race-volt transition-colors"
                >
                  Editar <Edit2 size={10} />
                </button>
              )}
            </div>
            
            <div className="relative z-10">
              <div className="flex items-end gap-1 mb-2">
                <span className="text-3xl font-black italic leading-none">{currentMonthKm}</span>
                <span className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-1">/ {currentGoal} KM</span>
              </div>
              
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden mt-3 relative">
                <div 
                  className="h-full bg-race-volt rounded-full transition-all duration-1000 ease-out relative" 
                  style={{ width: `${progressPercent}%` }}
                >
                  <div className="absolute right-0 top-0 bottom-0 w-10 bg-linear-to-r from-transparent to-white/50 blur-[2px]"></div>
                </div>
              </div>
              
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mt-3 text-right">
                {progressPercent >= 100 ? <span className="text-race-volt">Meta Atingida! 🔥 (+{xpSystem.earnedBonus} XP)</span> : `${Math.round(progressPercent)}% Concluído`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-10">
            <div className="bg-race-card border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center gap-2">
              <TrendingUp className="text-race-volt" size={24} />
              <span className="text-3xl font-black italic">{finishedRaces.length}</span>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Concluídas</span>
            </div>
            <div className="bg-race-card border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center gap-2">
              <Route className="text-race-volt" size={24} />
              <span className="text-3xl font-black italic">{totalKm}</span>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Km Totais</span>
            </div>
          </div>

          <div className="mb-10 bg-race-card border border-white/5 rounded-3xl p-5 pt-8">
            <div className="flex justify-between items-start mb-10">
              <h3 className="text-xs font-bold uppercase text-gray-500 tracking-widest flex items-center gap-2">
                <BarChart3 size={16} className="text-race-volt" /> Volume (6 meses)
              </h3>
            </div>
            
            {maxKm > 0 && chartPoints.length >= 2 ? (
              <div className="h-40 relative">
                <svg 
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
                  className="w-full h-full overflow-visible" 
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#d1ff00" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#d1ff00" stopOpacity="0.01" />
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>
                  
                  <line x1="0" y1={chartHeight * 0.5} x2={chartWidth} y2={chartHeight * 0.5} stroke="white" strokeOpacity="0.05" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="4,4" />
                  <line x1="0" y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke="white" strokeOpacity="0.1" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                  
                  <path d={areaPath} fill="url(#areaGradient)" className="transition-all duration-500 ease-out" />
                  <path d={linePath} fill="none" stroke="#d1ff00" strokeWidth="3" vectorEffect="non-scaling-stroke" filter="url(#glow)" className="transition-all duration-500 ease-out" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                
                {pointsCoords.map((coord, index) => {
                  let textPositionClass = "-translate-x-1/2 left-1/2"; 
                  if (index === pointsCoords.length - 1) {
                    textPositionClass = "-translate-x-[100%] left-0 pr-2"; 
                  } else if (index === 0) {
                    textPositionClass = "translate-x-0 left-0 pl-2"; 
                  }

                  return (
                    <div key={index} className="absolute flex flex-col items-center z-10" style={{ left: `${coord.percentX}%`, top: `${coord.y}px`, transform: 'translate(-50%, -50%)' }}>
                      {coord.totalKm > 0 && (
                        <div className={`absolute -top-7 flex items-baseline gap-0.5 pointer-events-none whitespace-nowrap ${textPositionClass}`}>
                          <span className="text-sm font-black text-white">{coord.totalKm.toFixed(2)}</span>
                          <span className="text-[9px] font-bold text-race-volt">KM</span>
                        </div>
                      )}
                      <div className={`w-2.5 h-2.5 rounded-full border-2 border-background shadow-[0_0_8px_rgba(209,255,0,0.6)] ${coord.totalKm > 0 ? 'bg-race-volt' : 'bg-transparent border-white/20'}`}></div>
                    </div>
                  );
                })}
                
                <div className="flex justify-between w-full absolute -bottom-6 px-1">
                  {chartPoints.map((p, i) => (
                    <span key={i} className={`text-[9px] font-bold uppercase tracking-wider ${p.totalKm > 0 ? 'text-gray-300' : 'text-gray-600'}`}>{p.label}</span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 border border-dashed border-white/5 rounded-2xl text-gray-600 italic text-center p-6 text-sm">
                Nenhum volume rodado nos últimos 6 meses. A pista te aguarda!
              </div>
            )}
          </div>

          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[10px] font-bold uppercase text-gray-500 tracking-widest flex items-center gap-1.5">
              <Activity size={12} className="text-race-volt" /> Pastas de Atividades
            </h3>
            <AddRaceModal /> 
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => setViewMode('provas')}
              className="bg-linear-to-br from-race-card to-background border border-white/5 hover:border-race-volt/50 rounded-3xl p-5 flex flex-col items-start gap-4 transition-all group relative overflow-hidden"
            >
              <div className="absolute right-0 top-0 w-20 h-20 bg-race-volt/5 blur-2xl rounded-full"></div>
              <div className="w-10 h-10 rounded-full bg-race-volt/10 flex items-center justify-center text-race-volt group-hover:scale-110 transition-transform relative z-10">
                <Medal size={20} />
              </div>
              <div className="text-left w-full relative z-10 leading-none">
                <h4 className="text-2xl font-black italic text-white mb-1">{listProvas.length}</h4>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Provas Oficiais</p>
              </div>
              <div className="w-full flex items-center justify-between mt-2 pt-4 border-t border-white/5 relative z-10">
                <span className="text-[9px] text-gray-400 uppercase tracking-widest truncate max-w-[80%]">
                  {listProvas.length > 0 ? listProvas[0].name : 'Nenhuma Prova'}
                </span>
                <ChevronRight size={12} className="text-race-volt" />
              </div>
            </button>

            <button 
              onClick={() => setViewMode('treinos')}
              className="bg-linear-to-br from-race-card to-background border border-white/5 hover:border-race-volt/50 rounded-3xl p-5 flex flex-col items-start gap-4 transition-all group relative overflow-hidden"
            >
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

      {/* MODAL DE ZOOM DA INSÍGNIA */}
      {selectedInsignia && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedInsignia(null)}
        >
          <div 
            className="flex flex-col items-center gap-4 bg-race-card border border-white/10 p-8 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] relative max-w-sm w-full" 
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={() => setSelectedInsignia(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white bg-white/5 p-1.5 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            
            <h3 className="text-race-volt font-black uppercase tracking-widest text-sm text-center mt-2">
              {selectedInsignia.title}
            </h3>
            
            <div className="relative w-48 h-48 my-4 drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">
              <Image 
                src={selectedInsignia.src} 
                alt={selectedInsignia.title} 
                fill 
                className="object-contain drop-shadow-2xl" 
              />
            </div>
            
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
              Insígnia Oficial
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-race-volt font-black uppercase italic">Carregando Atleta...</div>}>
      <ProfileContent />
    </Suspense>
  );
}