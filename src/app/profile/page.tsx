'use client'; 

import { useEffect, useState, useMemo, Suspense, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Medal, TrendingUp, Route, Edit2, Check, X, BarChart3, Activity, Target, ChevronRight, Trophy, MapPin, Timer, Link2, Calendar, RefreshCw, Camera, Zap, Flame, Crown } from 'lucide-react';
import { AddRaceModal } from '../components/AddRaceModal'; 
import Image from 'next/image';
import dynamic from 'next/dynamic';

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
  map_polyline?: string; 
}

interface Profile {
  id: string;
  username: string;
  monthly_goal?: number; 
  gender?: 'M' | 'F'; 
  is_owner?: boolean; 
  is_pioneer?: boolean; 
  strava_access_token?: string; 
  strava_refresh_token?: string; 
  strava_expires_at?: number; 
  strava_athlete_id?: string; 
  avatar_url?: string; 
}

interface ChartPoint {
  label: string;
  year: number;
  monthIndex: number;
  totalKm: number;
  provaKm: number;
  treinoKm: number;
}

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

const timeToSeconds = (timeStr?: string) => {
  if (!timeStr) return Infinity;
  const cleanStr = timeStr.replace(' /km', '').trim();
  const parts = cleanStr.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Infinity;
};

// Mapa Dinâmico
const RouteMap = dynamic<{ polyline: string }>(() => Promise.resolve(({ polyline }) => {
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
}), { ssr: false });

const getPatentData = (level: number, gender: 'M' | 'F') => {
  if (level >= 60) return { name: 'Lenda do Pelotão', insignia: '/insignias/insignia_lenda.png' };
  if (level >= 40) return { name: gender === 'F' ? 'Mestra do Asfalto' : 'Mestre do Asfalto', insignia: gender === 'F' ? '/insignias/insignia_mestra.png' : '/insignias/insignia_mestre.png' };
  if (level >= 20) return { name: gender === 'F' ? 'Caçadora de RP' : 'Caçador de RP', insignia: gender === 'F' ? '/insignias/insignia_cacadora.png' : '/insignias/insignia_cacador.png' };
  if (level >= 10) return { name: gender === 'F' ? 'Corredora Focada' : 'Corredor Focado', insignia: gender === 'F' ? '/insignias/insignia_focada.png' : '/insignias/insignia_focado.png' };
  return { name: 'Iniciante do Asfalto', insignia: '/insignias/insignia_iniciante.png' };
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

// Função auxiliar para descobrir a semana do ano (ISO)
const getWeekNumber = (dateString: string) => {
  const d = new Date(dateString);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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
      
      if (code && !hasFetchedToken.current) {
        hasFetchedToken.current = true;
        window.history.replaceState({}, document.title, '/profile');

        try {
          const response = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: 220016, 
              client_secret: 'ff187c140ae7d513c5e8e297da714062879305ec', 
              code: code,
              grant_type: 'authorization_code'
            })
          });

          const data = await response.json();
          if (data.access_token) {
            const athleteId = data.athlete?.id ? String(data.athlete.id) : null;
            
            await supabase.from('profiles').update({
              strava_access_token: data.access_token,
              strava_refresh_token: data.refresh_token,
              strava_expires_at: data.expires_at,
              ...(athleteId && { strava_athlete_id: athleteId }) 
            }).eq('id', session.user.id);
            
            setIsStravaConnected(true);
          } else {
            alert("O Strava recusou a conexão.");
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

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploadingAvatar(true);
      const file = event.target.files?.[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        alert('A imagem é muito pesada. O tamanho máximo é 5MB.');
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${profile?.id}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile?.id);

      if (updateError) throw updateError;

      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);

    } catch (error) {
      console.error('Erro no upload:', error);
      alert('Erro ao enviar a foto. Verifique se o bucket "avatars" é público no Supabase.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleConnectStrava = () => {
    const clientId = '220016';
    const redirectUri = `${window.location.origin}/profile`; 
    const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&approval_prompt=force&scope=activity:read_all`;
    window.location.href = stravaAuthUrl;
  };

  const syncStravaActivities = async () => {
    if (!profile?.strava_access_token) {
      alert("⚠️ Conexão com Strava não encontrada. Reconecte sua conta.");
      return;
    }
    
    setIsSyncing(true);
    try {
      let currentAccessToken = profile.strava_access_token;
      const nowInSeconds = Math.floor(Date.now() / 1000);

      if (profile.strava_expires_at && (profile.strava_expires_at - 60) < nowInSeconds) {
        console.log("Token do Strava expirado! Renovando silenciosamente...");
        
        const refreshRes = await fetch('https://www.strava.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: 220016, 
            client_secret: 'ff187c140ae7d513c5e8e297da714062879305ec', 
            grant_type: 'refresh_token',
            refresh_token: profile.strava_refresh_token
          })
        });

        if (!refreshRes.ok) {
          setIsStravaConnected(false); 
          throw new Error('A permissão expirou completamente. Por favor, conecte o Strava novamente.');
        }

        const refreshData = await refreshRes.json();
        currentAccessToken = refreshData.access_token;

        await supabase.from('profiles').update({
          strava_access_token: refreshData.access_token,
          strava_refresh_token: refreshData.refresh_token,
          strava_expires_at: refreshData.expires_at
        }).eq('id', profile.id);

        setProfile(prev => prev ? {
          ...prev,
          strava_access_token: refreshData.access_token,
          strava_refresh_token: refreshData.refresh_token,
          strava_expires_at: refreshData.expires_at
        } : null);
      }

      const startOfYear = Math.floor(new Date(new Date().getFullYear(), 0, 1).getTime() / 1000);

      const response = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${startOfYear}&per_page=200`, {
        headers: { Authorization: `Bearer ${currentAccessToken}` }
      });
      
      if (!response.ok) throw new Error('Falha ao buscar atividades no Strava.');

      const activities = await response.json();
      let newRacesAdded = 0;

      for (const act of activities) {
        if (act.type !== 'Run') continue; 

        const dateStr = act.start_date_local.split('T')[0];
        const alreadyExists = completedRaces.some(r => r.date === dateStr && r.name === act.name);
        if (alreadyExists) continue;

        const isRace = act.workout_type === 1;
        const definedActivityType = isRace ? 'prova' : 'treino';

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

        const { error } = await supabase.from('races').insert({
          user_id: profile.id,
          name: act.name,
          date: dateStr,
          distance: distKm,
          finish_time: timeStr,
          pace: paceStr,
          status: 'Concluído',
          activity_type: definedActivityType,
          event_location: 'Strava',
          map_polyline: act.map?.summary_polyline || null 
        });

        if (!error) newRacesAdded++;
      }

      if (newRacesAdded > 0) {
        alert(`A Pista ferveu! 🔥 ${newRacesAdded} novas atividades importadas e categorizadas com sucesso.`);
        window.location.reload(); 
      } else {
        alert('Seu diário está em dia! Nenhum treino novo encontrado.');
      }
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Erro interno ao sincronizar com o Strava.');
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
    if (isNaN(goalVal) || goalVal <= 0) { alert("Insira um valor válido para a sua meta."); return; }
    try {
      const { error } = await supabase.from('profiles').update({ monthly_goal: goalVal }).eq('id', profile.id);
      if (error) throw error;
      setProfile({ ...profile, monthly_goal: goalVal });
      setIsEditingGoal(false);
    } catch (error) {
      console.error(error);
    }
  };

  const finishedRaces = completedRaces.filter(r => r.status === 'Concluído');
  const listProvas = finishedRaces.filter(r => r.activity_type !== 'treino');
  const listTreinos = finishedRaces.filter(r => r.activity_type === 'treino');
  
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

  const personalRecords = useMemo<{
    fastest5k: Race | null;
    fastest10k: Race | null;
    longestRun: Race | null;
    bestPace: Race | null;
  }>(() => {
    let fastest5k: Race | null = null;
    let fastest10k: Race | null = null;
    let longestRun: Race | null = null;
    let bestPace: Race | null = null;

    finishedRaces.forEach(race => {
      const km = parseFloat(race.distance.replace(/[^\d.]/g, '')) || 0;
      const timeSecs = timeToSeconds(race.finish_time);
      const paceSecs = timeToSeconds(race.pace);

      if (km >= 4.8 && km <= 5.2) {
        if (!fastest5k || timeSecs < timeToSeconds(fastest5k.finish_time)) {
          fastest5k = race;
        }
      }

      if (km >= 9.8 && km <= 10.2) {
        if (!fastest10k || timeSecs < timeToSeconds(fastest10k.finish_time)) {
          fastest10k = race;
        }
      }

      if (!longestRun || km > (parseFloat(longestRun.distance.replace(/[^\d.]/g, '')) || 0)) {
        longestRun = race;
      }

      if (paceSecs > 120) {
        if (!bestPace || paceSecs < timeToSeconds(bestPace.pace)) {
          bestPace = race;
        }
      }
    });

    return { fastest5k, fastest10k, longestRun, bestPace };
  }, [finishedRaces]);

  // 👇 ALGORITMO DE BADGES COM FILTRO DE DESBLOQUEADAS 👇
  const allBadges = useMemo(() => {
    const weeksCount: Record<string, number> = {};
    const monthsCount: Record<string, number> = {};

    let isUnshakable = false;
    let isBat = false;
    let isEarlyBird = false;
    let isHalfMarathon = false;
    let isLightning = false;
    let isCenturion = false;
    let isResilient = false;

    finishedRaces.forEach(race => {
      const km = parseFloat(race.distance.replace(/[^\d.]/g, '')) || 0;
      const paceSecs = timeToSeconds(race.pace);

      if (km >= 21) isHalfMarathon = true;
      if (paceSecs > 0 && paceSecs <= 270) isLightning = true;
      if (km >= 10 && paceSecs >= 420) isResilient = true;

      if (race.date) {
        const monthKey = race.date.substring(0, 7); 
        monthsCount[monthKey] = (monthsCount[monthKey] || 0) + km;
        if (monthsCount[monthKey] >= 100) isCenturion = true;

        const weekKey = `${race.date.substring(0, 4)}-W${getWeekNumber(race.date)}`;
        weeksCount[weekKey] = (weeksCount[weekKey] || 0) + 1;
        if (weeksCount[weekKey] >= 3) isUnshakable = true;
      }

      const nameLower = race.name.toLowerCase();
      if (nameLower.includes('noturna') || nameLower.includes('night')) isBat = true;
      if (nameLower.includes('matinal') || nameLower.includes('morning')) isEarlyBird = true;
    });

    return [
      { id: 'inabalavel', name: 'Inabalável', desc: '3 treinos na mesma semana', imagePath: '/badges/fire.png', earned: isUnshakable, color: 'text-orange-500', bg: 'bg-orange-500/20', border: 'border-orange-500/30' },
      { id: 'morcego', name: 'Morcego', desc: 'Correu no período noturno', imagePath: '/badges/bat.png', earned: isBat, color: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500/30' },
      { id: 'madrugador', name: 'Madrugador', desc: 'Correu no período matinal', imagePath: '/badges/cool.png', earned: isEarlyBird, color: 'text-yellow-400', bg: 'bg-yellow-400/20', border: 'border-yellow-400/30' },
      { id: 'meia', name: 'Meia Maratona', desc: 'Sobreviveu aos 21km', imagePath: '/badges/silver-medal.png', earned: isHalfMarathon, color: 'text-gray-300', bg: 'bg-gray-400/20', border: 'border-gray-400/30' },
      { id: 'relampago', name: 'Relâmpago', desc: 'Pace médio abaixo de 4:30/km', imagePath: '/badges/flash.png', earned: isLightning, color: 'text-cyan-400', bg: 'bg-cyan-400/20', border: 'border-cyan-400/30' },
      { id: 'centuriao', name: 'Centurião', desc: '+100km rodados no mês', imagePath: '/badges/king.png', earned: isCenturion, color: 'text-amber-400', bg: 'bg-amber-400/20', border: 'border-amber-400/30' },
      { id: 'resiliencia', name: 'Resiliência', desc: 'Longo (+10k) sem ligar pro pace', imagePath: '/badges/defence.png', earned: isResilient, color: 'text-pink-500', bg: 'bg-pink-500/20', border: 'border-pink-500/30' },
    ];
  }, [finishedRaces]);

  // Filtra apenas as medalhas que o atleta conquistou
  const earnedBadgesToDisplay = allBadges.filter(badge => badge.earned);

  const xpSystem = useMemo(() => {
    const TREINO_XP_PER_KM = 100;
    const PROVA_XP_PER_KM = 200; 
    const RP_BONUS_XP = 1000;

    let earnedBonus = 0;
    if (currentGoal <= 50) earnedBonus = 1000;
    else if (currentGoal <= 100) earnedBonus = 2000;
    else if (currentGoal <= 200) earnedBonus = 3000;
    else if (currentGoal <= 300) earnedBonus = 4000;
    else earnedBonus = 5000;

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

    if (progressPercent >= 100) totalXp += earnedBonus;

    let currentLevel = 1;
    let xpNeededForNext = 1000; 
    let tempXp = totalXp;

    while (tempXp >= xpNeededForNext) {
      tempXp -= xpNeededForNext;
      currentLevel++;
      xpNeededForNext = currentLevel < 20 ? 1000 + (currentLevel * 50) : 1000 + (currentLevel * 120);
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
        year: past.getFullYear(), monthIndex: past.getMonth(),
        totalKm: 0, provaKm: 0, treinoKm: 0
      });
    }

    let highest = 0;
    finishedRaces.forEach(race => {
      if (!race.date) return;
      const [y, m] = race.date.split('-');
      const match = points.find(data => data.year === parseInt(y) && data.monthIndex === parseInt(m) - 1);
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
      if (p.totalKm > highest) highest = p.totalKm;
    });

    return { chartPoints: points, maxKm: highest };
  }, [finishedRaces]);

  const chartHeight = 160; 
  const chartWidth = 1000; 

  const { linePath, areaPath, pointsCoords } = useMemo(() => {
    if (chartPoints.length < 2 || maxKm === 0) return { linePath: '', areaPath: '', pointsCoords: [] };

    const effectiveMaxKm = maxKm * 1.1; 
    const stepX = chartWidth / (chartPoints.length - 1);
    
    const coords = chartPoints.map((point, index) => {
      const x = stepX * index;
      const y = chartHeight - (point.totalKm / effectiveMaxKm) * chartHeight;
      return { x, y, percentX: (index / (chartPoints.length - 1)) * 100, totalKm: point.totalKm };
    });

    let linePathD = `M ${coords[0].x},${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) linePathD += ` L ${coords[i].x},${coords[i].y}`;

    let areaPathD = `M 0,${chartHeight} L ${coords[0].x},${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) areaPathD += ` L ${coords[i].x},${coords[i].y}`;
    areaPathD += ` L ${chartWidth},${chartHeight} Z`;

    return { linePath: linePathD, areaPath: areaPathD, pointsCoords: coords };
  }, [chartPoints, maxKm]);

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
      if (difference <= 0) { setCountdown('É HOJE! Pra cima!'); return; }
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

  const handleRaceClick = (raceId: string) => {
    router.push(`/?scrollTo=${raceId}`);
  };

  const renderList = (items: Race[], title: string) => (
    <div className="animate-in slide-in-from-right-8 fade-in duration-300">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setViewMode('perfil')} className="p-2 bg-race-card rounded-xl border border-white/5 text-gray-400 hover:text-white"><ChevronLeft size={24} /></button>
        <h1 className="text-xl font-black uppercase italic tracking-tighter">Minhas <span className="text-race-volt">{title}</span></h1>
      </div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xs font-bold uppercase text-gray-500 tracking-widest">{items.length} {title} Registradas</h3>
        <AddRaceModal /> 
      </div>
      <div className="flex flex-col gap-4">
        {items.length > 0 ? items.map((race) => (
          <div 
            key={race.id} 
            onClick={() => handleRaceClick(race.id)}
            role="button"
            tabIndex={0}
            className="bg-race-volt/5 border border-race-volt/20 p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-race-volt/10 transition-colors hover:scale-[1.01] active:scale-[0.99]"
          >
            <div className="flex items-center gap-4 pointer-events-none">
              <div className="bg-race-volt/20 p-3 rounded-full text-race-volt shrink-0">
                {race.activity_type === 'treino' ? <Activity size={24} /> : <Medal size={24} />}
              </div>
              <div>
                <h4 className="font-bold text-white uppercase leading-tight truncate max-w-37.5 sm:max-w-xs">{race.name}</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-gray-400">{formatDistance(race.distance)}</p>
                  <span className="text-[10px] text-gray-600 font-bold">•</span>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">{race.date.split('-').reverse().join('/')}</p>
                </div>
              </div>
            </div>
            {race.map_polyline && <div className="w-10 h-10 sm:w-12 sm:h-12 ml-auto mr-2 sm:mr-4 opacity-80 shrink-0 pointer-events-none"><RouteMap polyline={race.map_polyline} /></div>}
            <div className={`flex flex-col items-end shrink-0 pointer-events-none ${!race.map_polyline ? 'ml-auto' : ''}`}>
              <span className="font-black italic text-race-volt">{race.finish_time || '--:--'}</span>
              <span className="text-[10px] text-gray-500 font-bold uppercase">{race.pace ? `${race.pace} /km` : ''}</span>
            </div>
          </div>
        )) : <div className="text-center p-8 border border-dashed border-white/10 rounded-2xl text-gray-500 text-sm italic">Nenhum registro encontrado. A pista te espera!</div>}
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
              <button onClick={() => router.push('/')} className="p-2 bg-race-card rounded-xl border border-white/5 text-gray-400 hover:text-white"><ChevronLeft size={24} /></button>
              <h1 className="text-xl font-black uppercase italic tracking-tighter">Meu <span className="text-race-volt">Perfil</span></h1>
            </div>

            <div className="flex items-center gap-2">
              {isStravaConnected && (
                <button onClick={syncStravaActivities} disabled={isSyncing} className="p-2 bg-race-volt/10 text-race-volt border border-race-volt/20 rounded-xl hover:bg-race-volt hover:text-black transition-all disabled:opacity-50"><RefreshCw size={20} className={isSyncing ? 'animate-spin' : ''} /></button>
              )}
              <button onClick={isStravaConnected ? undefined : handleConnectStrava} disabled={isStravaConnected} className={`flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${isStravaConnected ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-orange-600 text-white hover:bg-orange-500 active:scale-95 shadow-lg shadow-orange-600/20'}`}>
                <Image src="/strava-icon.png" alt="Strava" width={14} height={14} className={isStravaConnected ? 'opacity-50 grayscale' : ''} />
                {isStravaConnected ? 'Conectado' : 'Conectar Strava'}
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center mb-8 relative">
            <div className="absolute top-10 w-40 h-40 bg-race-volt/10 blur-[80px] rounded-full pointer-events-none"></div>

            <div className="relative flex flex-col items-center z-10">

              <input 
                type="file" 
                accept="image/*" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleAvatarUpload} 
                disabled={uploadingAvatar} 
              />

              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-28 h-28 rounded-full border-4 border-background p-1 mb-2 shadow-2xl shadow-race-volt/10 bg-race-volt/5 relative z-10 flex flex-col items-center justify-center group cursor-pointer overflow-visible transition-transform hover:scale-105"
              >
                <div className="w-full h-full rounded-full overflow-hidden relative flex items-center justify-center bg-background border border-white/5">
                  {profile?.avatar_url ? (
                     <Image src={profile.avatar_url} alt="Meu Avatar" fill className="object-cover" />
                  ) : (
                     <span className="text-4xl font-black italic text-race-volt uppercase">{profile?.username?.substring(0, 2) || '??'}</span>
                  )}
                  
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
                     {uploadingAvatar ? (
                        <RefreshCw size={20} className="text-race-volt animate-spin" />
                     ) : (
                        <>
                          <Camera size={20} className="text-white mb-1" />
                          <span className="text-[8px] font-bold text-white uppercase tracking-widest">Trocar</span>
                        </>
                     )}
                  </div>
                </div>

                <div className="absolute -bottom-3 bg-race-volt text-black border border-black px-3 py-0.5 rounded-full text-[10px] font-black uppercase italic shadow-lg z-30">
                  Nível {xpSystem.currentLevel}
                </div>
              </div>
            </div>

            {isEditing ? (
              <div className="flex flex-col items-center gap-3 mt-6">
                <input 
                  type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} 
                  className="bg-background border border-race-volt text-white rounded-lg px-3 py-1 text-center font-bold uppercase outline-none w-48 text-2xl mb-1" autoFocus 
                />
                <div className="flex gap-2 w-full max-w-sm mb-2">
                  <button type="button" onClick={() => setNewGender('M')} className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-colors ${newGender === 'M' ? 'bg-race-volt text-black' : 'text-gray-500 bg-white/5'}`}>Masculino</button>
                  <button type="button" onClick={() => setNewGender('F')} className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-colors ${newGender === 'F' ? 'bg-race-volt text-black' : 'text-gray-500 bg-white/5'}`}>Feminino</button>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleSaveUsernameAndGender} disabled={isSaving} className="bg-race-volt text-black p-2 rounded-lg hover:scale-105 disabled:opacity-50 transition-transform"><Check size={20} strokeWidth={3} /></button>
                  <button onClick={() => { setIsEditing(false); setNewUsername(profile?.username || ''); setNewGender(profile?.gender || 'M'); }} className="bg-red-500/20 text-red-500 p-2 rounded-lg hover:bg-red-500 hover:text-white transition-colors"><X size={20} strokeWidth={3} /></button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 mt-4 relative group cursor-pointer" onClick={() => setIsEditing(true)}>
                <h2 className="text-3xl font-black text-white uppercase tracking-tight">{profile?.username}</h2>
                <div className="absolute top-1/2 -right-6 -translate-y-1/2"><Edit2 size={16} className="text-gray-500 group-hover:text-race-volt transition-colors" /></div>
              </div>
            )}

            <div className="flex items-center justify-center mt-2 w-full">
              <span className="text-race-volt font-bold text-[11px] tracking-widest uppercase mr-2 text-center">
                {xpSystem.patentData.name}
              </span>
              <div className="flex items-center gap-1.5 justify-center">
                <div className="relative group cursor-pointer hover:scale-110 transition-transform" onClick={() => setSelectedInsignia({ src: xpSystem.patentData.insignia, title: `Patente Atual: ${xpSystem.patentData.name}` })}>
                  <Image src={xpSystem.patentData.insignia} alt="Nível Insignia" width={28} height={28} className="relative shrink-0" />
                </div>
                {(profile?.is_owner || profile?.is_pioneer) && (
                  <div className="flex items-center gap-1.5 border-l border-white/10 pl-2 ml-1">
                    {profile?.is_owner && (
                      <div className="relative group cursor-pointer hover:scale-110 transition-transform" onClick={() => setSelectedInsignia({ src: "/insignias/insignia_ceo_dev.png", title: "CEO & Desenvolvedor" })}>
                        <Image src="/insignias/insignia_ceo_dev.png" alt="Jones CEO/Dev" width={28} height={28} className="relative shrink-0" />
                      </div>
                    )}
                    {profile?.is_pioneer && (
                      <div className="relative group cursor-pointer hover:scale-110 transition-transform" onClick={() => setSelectedInsignia({ src: profile.gender === 'F' ? '/insignias/insignia_pioneira.png' : '/insignias/insignia_pioneiro.png', title: "Atleta Pioneiro" })}>
                        <Image src={profile.gender === 'F' ? '/insignias/insignia_pioneira.png' : '/insignias/insignia_pioneiro.png'} alt="Pioneiro" width={28} height={28} className="relative shrink-0" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="w-full max-w-md mt-6 relative z-10">
              <div className="flex justify-between items-end mb-1 px-1">
                <span className="text-[10px] font-black text-white">{Math.round(xpSystem.tempXp)} XP</span>
                <span className="text-[10px] font-black text-race-volt text-opacity-80">Meta: {Math.round(xpSystem.xpNeededForNext)} XP</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden relative shadow-inner">
                <div className="h-full bg-race-volt rounded-full transition-all duration-1000 ease-out relative" style={{ width: `${xpSystem.levelProgressPercent}%` }}>
                  <div className="absolute right-0 top-0 bottom-0 w-10 bg-linear-to-r from-transparent to-white/50 blur-[1px]"></div>
                </div>
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
                      <MapPin size={14} className="shrink-0 mt-0.5" /> 
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
              <h3 className="text-xs font-bold uppercase text-gray-500 tracking-widest flex items-center gap-2"><Target size={16} className="text-race-volt" /> Meta de {currentMonthName}</h3>
              {isEditingGoal ? (
                <div className="flex items-center gap-1">
                  <input type="number" value={newGoal} onChange={(e) => setNewGoal(e.target.value)} className="w-14 bg-background border border-race-volt rounded p-1 text-white text-xs text-center outline-none" autoFocus />
                  <button onClick={handleSaveGoal} className="text-race-volt bg-race-volt/20 p-1 rounded hover:bg-race-volt hover:text-black"><Check size={14} /></button>
                  <button onClick={() => setIsEditingGoal(false)} className="text-red-500 bg-red-500/20 p-1 rounded hover:bg-red-500 hover:text-white"><X size={14} /></button>
                </div>
              ) : (
                <button onClick={() => setIsEditingGoal(true)} className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1 hover:text-race-volt transition-colors">Editar <Edit2 size={10} /></button>
              )}
            </div>
            
            <div className="relative z-10">
              <div className="flex items-end gap-1 mb-2">
                <span className="text-3xl font-black italic leading-none">{currentMonthKm}</span>
                <span className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-1">/ {currentGoal} KM</span>
              </div>
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden mt-3 relative">
                <div className="h-full bg-race-volt rounded-full transition-all duration-1000 ease-out relative" style={{ width: `${progressPercent}%` }}>
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

          {/* ================= RECORDES PESSOAIS (PRs) ================= */}
          <div className="mb-10 animate-in slide-in-from-bottom-4 fade-in duration-500">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xs font-bold uppercase text-gray-500 tracking-widest flex items-center gap-2">
                <Crown size={16} className="text-race-volt" /> Recordes Pessoais
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-race-card border border-white/5 rounded-2xl p-4 flex flex-col relative overflow-hidden group hover:border-race-volt/30 transition-colors">
                <div className="absolute -right-2.5 -top-2.5 opacity-5 text-race-volt group-hover:scale-110 transition-transform"><Zap size={60} /></div>
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1 relative z-10">Melhor 5K</span>
                <div className="relative z-10">
                  {personalRecords.fastest5k ? (
                    <>
                      <span className="text-2xl font-black italic text-white leading-none block mb-1">{personalRecords.fastest5k.finish_time}</span>
                      <span className="text-[10px] text-gray-400 font-bold uppercase">{personalRecords.fastest5k.pace} /km</span>
                    </>
                  ) : (
                    <span className="text-sm font-bold text-gray-600 italic">--:--</span>
                  )}
                </div>
              </div>

              <div className="bg-race-card border border-white/5 rounded-2xl p-4 flex flex-col relative overflow-hidden group hover:border-race-volt/30 transition-colors">
                <div className="absolute -right-2.5 -top-2.5 opacity-5 text-race-volt group-hover:scale-110 transition-transform"><Zap size={60} /></div>
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1 relative z-10">Melhor 10K</span>
                <div className="relative z-10">
                  {personalRecords.fastest10k ? (
                    <>
                      <span className="text-2xl font-black italic text-white leading-none block mb-1">{personalRecords.fastest10k.finish_time}</span>
                      <span className="text-[10px] text-gray-400 font-bold uppercase">{personalRecords.fastest10k.pace} /km</span>
                    </>
                  ) : (
                    <span className="text-sm font-bold text-gray-600 italic">--:--</span>
                  )}
                </div>
              </div>

              <div className="bg-race-card border border-white/5 rounded-2xl p-4 flex flex-col relative overflow-hidden group hover:border-race-volt/30 transition-colors">
                <div className="absolute -right-2.5 -top-2.5 opacity-5 text-race-volt group-hover:scale-110 transition-transform"><Route size={60} /></div>
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1 relative z-10">Maior Longão</span>
                <div className="relative z-10">
                  {personalRecords.longestRun ? (
                    <>
                      <span className="text-2xl font-black italic text-white leading-none block mb-1">{formatDistance(personalRecords.longestRun.distance)}</span>
                      <span className="text-[10px] text-gray-400 font-bold uppercase">{personalRecords.longestRun.finish_time}</span>
                    </>
                  ) : (
                    <span className="text-sm font-bold text-gray-600 italic">--:--</span>
                  )}
                </div>
              </div>

              <div className="bg-race-card border border-white/5 rounded-2xl p-4 flex flex-col relative overflow-hidden group hover:border-race-volt/30 transition-colors">
                <div className="absolute -right-2.5 -top-2.5 opacity-5 text-race-volt group-hover:scale-110 transition-transform"><Flame size={60} /></div>
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1 relative z-10">Melhor Pace</span>
                <div className="relative z-10">
                  {personalRecords.bestPace ? (
                    <>
                      <span className="text-2xl font-black italic text-white leading-none block mb-1">{personalRecords.bestPace.pace} <span className="text-[10px] font-bold text-gray-500 uppercase not-italic">/km</span></span>
                      <span className="text-[10px] text-gray-400 font-bold uppercase">{formatDistance(personalRecords.bestPace.distance)}</span>
                    </>
                  ) : (
                    <span className="text-sm font-bold text-gray-600 italic">--:--</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ================= GALERIA DE CONQUISTAS DESBLOQUEADAS ================= */}
          {earnedBadgesToDisplay.length > 0 && (
            <div className="mb-10 animate-in slide-in-from-bottom-4 fade-in duration-500 delay-150">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xs font-bold uppercase text-gray-500 tracking-widest flex items-center gap-2">
                  <Medal size={16} className="text-race-volt" /> Conquistas Desbloqueadas
                </h3>
              </div>
              
              <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide snap-x">
                {earnedBadgesToDisplay.map(badge => (
                  <div 
                    key={badge.id} 
                    className={`snap-center min-w-28 w-28 bg-race-card border ${badge.border} rounded-2xl p-3 flex flex-col items-center text-center gap-2 relative overflow-hidden group shrink-0 shadow-lg`}
                  >
                    
                    <div className={`absolute inset-0 ${badge.bg} opacity-10 group-hover:opacity-30 transition-opacity`}></div>
                    
                    <div className={`relative z-10 w-12 h-12 flex items-center justify-center group-hover:scale-110 transition-transform drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]`}>
                      <Image 
                        src={badge.imagePath} 
                        alt={badge.name} 
                        width={48} 
                        height={48} 
                        className="object-contain"
                      />
                    </div>
                    
                    <div className="relative z-10 flex flex-col items-center w-full mt-1">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${badge.color} leading-tight mb-1 w-full`}>{badge.name}</span>
                      <span className="text-[7px] text-gray-500 font-medium leading-tight">{badge.desc}</span>
                    </div>
                    
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-10 bg-race-card border border-white/5 rounded-3xl p-5 pt-8">
            <div className="flex justify-between items-start mb-10">
              <h3 className="text-xs font-bold uppercase text-gray-500 tracking-widest flex items-center gap-2">
                <BarChart3 size={16} className="text-race-volt" /> Volume (6 meses)
              </h3>
            </div>
            
            {maxKm > 0 && chartPoints.length >= 2 ? (
              <div className="h-40 relative">
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#d1ff00" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#d1ff00" stopOpacity="0.01" />
                    </linearGradient>
                    <filter id="glow"><feGaussianBlur stdDeviation="2" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                  </defs>
                  <line x1="0" y1={chartHeight * 0.5} x2={chartWidth} y2={chartHeight * 0.5} stroke="white" strokeOpacity="0.05" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="4,4" />
                  <line x1="0" y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke="white" strokeOpacity="0.1" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                  <path d={areaPath} fill="url(#areaGradient)" className="transition-all duration-500 ease-out" />
                  <path d={linePath} fill="none" stroke="#d1ff00" strokeWidth="3" vectorEffect="non-scaling-stroke" filter="url(#glow)" className="transition-all duration-500 ease-out" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {pointsCoords.map((coord, index) => {
                  let textPositionClass = "-translate-x-1/2 left-1/2"; 
                  if (index === pointsCoords.length - 1) textPositionClass = "-translate-x-[100%] left-0 pr-2"; 
                  else if (index === 0) textPositionClass = "translate-x-0 left-0 pl-2"; 
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
            <h3 className="text-[10px] font-bold uppercase text-gray-500 tracking-widest flex items-center gap-1.5"><Activity size={12} className="text-race-volt" /> Pastas de Atividades</h3>
            <AddRaceModal /> 
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setViewMode('provas')} className="bg-linear-to-br from-race-card to-background border border-white/5 hover:border-race-volt/50 rounded-3xl p-5 flex flex-col items-start gap-4 transition-all group relative overflow-hidden">
              <div className="absolute right-0 top-0 w-20 h-20 bg-race-volt/5 blur-2xl rounded-full"></div>
              <div className="w-10 h-10 rounded-full bg-race-volt/10 flex items-center justify-center text-race-volt group-hover:scale-110 transition-transform relative z-10"><Medal size={20} /></div>
              <div className="text-left w-full relative z-10 leading-none">
                <h4 className="text-2xl font-black italic text-white mb-1">{listProvas.length}</h4>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Provas Oficiais</p>
              </div>
              <div className="w-full flex items-center justify-between mt-2 pt-4 border-t border-white/5 relative z-10">
                <span className="text-[9px] text-gray-400 uppercase tracking-widest truncate max-w-[80%]">{listProvas.length > 0 ? listProvas[0].name : 'Nenhuma Prova'}</span>
                <ChevronRight size={12} className="text-race-volt" />
              </div>
            </button>

            <button onClick={() => setViewMode('treinos')} className="bg-linear-to-br from-race-card to-background border border-white/5 hover:border-race-volt/50 rounded-3xl p-5 flex flex-col items-start gap-4 transition-all group relative overflow-hidden">
              <div className="absolute right-0 top-0 w-20 h-20 bg-race-volt/5 blur-2xl rounded-full"></div>
              <div className="w-10 h-10 rounded-full bg-race-volt/10 flex items-center justify-center text-race-volt group-hover:scale-110 transition-transform relative z-10"><Activity size={20} /></div>
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

      {selectedInsignia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setSelectedInsignia(null)}>
          <div className="flex flex-col items-center gap-4 bg-race-card border border-white/10 p-8 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] relative max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedInsignia(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white bg-white/5 p-1.5 rounded-full transition-colors"><X size={20} /></button>
            <h3 className="text-race-volt font-black uppercase tracking-widest text-sm text-center mt-2">{selectedInsignia.title}</h3>
            <div className="relative w-48 h-48 my-4 drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">
              <Image src={selectedInsignia.src} alt={selectedInsignia.title} fill className="object-contain drop-shadow-2xl" />
            </div>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Insígnia Oficial</p>
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