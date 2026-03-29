'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Medal, TrendingUp, Route, Edit2, Check, X, FileText, BarChart3, Activity, Target } from 'lucide-react';
import { AddRaceModal } from '../components/AddRaceModal'; 

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
}

interface Profile {
  id: string;
  username: string;
  monthly_goal?: number; 
}

interface ChartPoint {
  label: string;
  year: number;
  monthIndex: number;
  totalKm: number;
  provaKm: number;
  treinoKm: number;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [completedRaces, setCompletedRaces] = useState<Race[]>([]);
  
  // Estados para edição do Nickname
  const [isEditing, setIsEditing] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Estados para edição da Meta Mensal
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [newGoal, setNewGoal] = useState('');

  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    async function fetchProfileData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: p } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      const { data: r } = await supabase
        .from('races')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'Concluído')
        .order('date', { ascending: false });

      if (isMounted) {
        if (p) {
          setProfile(p);
          setNewUsername(p.username); 
          setNewGoal(p.monthly_goal?.toString() || '50'); 
        }
        if (r) {
          setCompletedRaces(r);
        }
      }
    }

    fetchProfileData();
    return () => { isMounted = false; };
  }, [router]);

  const handleSaveUsername = async () => {
    if (!profile || !newUsername.trim() || newUsername === profile.username) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);

    try {
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', newUsername.trim())
        .neq('id', profile.id) 
        .single();

      if (existingUser) {
        alert('Este Nickname já está em uso por outro atleta. Escolha outro!');
        setIsSaving(false);
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ username: newUsername.trim() })
        .eq('id', profile.id);

      if (error) throw error;

      setProfile({ ...profile, username: newUsername.trim() });
      setIsEditing(false);
    } catch (error) {
      console.error(error);
      alert('Erro ao atualizar Nickname.');
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
      const { error } = await supabase
        .from('profiles')
        .update({ monthly_goal: goalVal })
        .eq('id', profile.id);

      if (error) throw error;

      setProfile({ ...profile, monthly_goal: goalVal });
      setIsEditingGoal(false);
    } catch (error) {
      console.error(error);
      alert('Erro ao atualizar a meta.');
    }
  };

  const totalKm = completedRaces.reduce((acc, race) => {
    const km = parseFloat(race.distance.replace(/[^\d.]/g, '')) || 0;
    return acc + km;
  }, 0);

  // MÁGICA DA META MENSAL
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const currentMonthName = new Date().toLocaleString('pt-BR', { month: 'long' });

  const currentMonthKm = useMemo(() => {
    return completedRaces.reduce((acc, race) => {
      if (!race.date) return acc;
      const [y, m] = race.date.split('-');
      if (parseInt(y) === currentYear && parseInt(m) - 1 === currentMonth) {
        return acc + (parseFloat(race.distance.replace(/[^\d.]/g, '')) || 0);
      }
      return acc;
    }, 0);
  }, [completedRaces, currentMonth, currentYear]);

  const currentGoal = profile?.monthly_goal || 50;
  const progressPercent = Math.min((currentMonthKm / currentGoal) * 100, 100);

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
    
    completedRaces.forEach(race => {
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

        if (match.totalKm > highest) highest = match.totalKm;
      }
    });

    return { chartPoints: points, maxKm: highest };
  }, [completedRaces]);

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

  return (
    <main className="min-h-screen bg-background text-foreground p-6 font-sans pb-24">
      {/* HEADER */}
      <div className="flex items-center gap-4 mb-8">
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

      {/* PERFIL INFO */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-24 h-24 rounded-full border-4 border-race-volt p-1 mb-4 shadow-xl shadow-race-volt/20">
          <div className="w-full h-full bg-race-card rounded-full flex items-center justify-center text-3xl text-white font-black uppercase">
            {profile?.username?.substring(0, 2) || 'JV'}
          </div>
        </div>

        {isEditing ? (
          <div className="flex items-center gap-2 mt-1">
            <input 
              type="text" 
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="bg-background border border-race-volt text-white rounded-lg px-3 py-1 text-center font-bold uppercase outline-none w-40"
              autoFocus
            />
            <button 
              onClick={handleSaveUsername} 
              disabled={isSaving} 
              className="bg-race-volt text-black p-1.5 rounded-lg hover:scale-105 disabled:opacity-50 transition-transform"
            >
              <Check size={18} strokeWidth={3} />
            </button>
            <button 
              onClick={() => { setIsEditing(false); setNewUsername(profile?.username || ''); }} 
              className="bg-red-500/20 text-red-500 p-1.5 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
            >
              <X size={18} strokeWidth={3} />
            </button>
          </div>
        ) : (
          <div 
            className="flex items-center gap-2 mt-1 relative group cursor-pointer" 
            onClick={() => setIsEditing(true)}
          >
            <h2 className="text-2xl font-bold text-white uppercase">{profile?.username}</h2>
            <Edit2 size={16} className="text-gray-500 group-hover:text-race-volt transition-colors" />
          </div>
        )}
        
        <p className="text-race-volt font-medium text-sm tracking-widest uppercase mt-1">
          Atleta Pelotão
        </p>
      </div>

      {/* NOVO PAINEL DE META MENSAL */}
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
              {/* ERRO CORRIGIDO AQUI: bg-linear-to-r no lugar de bg-gradient-to-r */}
              <div className="absolute right-0 top-0 bottom-0 w-10 bg-linear-to-r from-transparent to-white/50 blur-[2px]"></div>
            </div>
          </div>
          
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mt-3 text-right">
            {progressPercent >= 100 
              ? <span className="text-race-volt">Meta Atingida! 🔥</span> 
              : `${Math.round(progressPercent)}% Concluído`}
          </p>
        </div>
      </div>

      {/* CARDS DE TOTAIS */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        <div className="bg-race-card border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center gap-2">
          <TrendingUp className="text-race-volt" size={24} />
          <span className="text-3xl font-black italic">{completedRaces.length}</span>
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Registros</span>
        </div>
        <div className="bg-race-card border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center gap-2">
          <Route className="text-race-volt" size={24} />
          <span className="text-3xl font-black italic">{totalKm}</span>
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Km Totais</span>
        </div>
      </div>

      {/* DASHBOARD: GRÁFICO DE EVOLUÇÃO */}
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

              <line 
                x1="0" y1={chartHeight * 0.5} 
                x2={chartWidth} y2={chartHeight * 0.5} 
                stroke="white" strokeOpacity="0.05" strokeWidth="1" 
                vectorEffect="non-scaling-stroke" strokeDasharray="4,4" 
              />
              <line 
                x1="0" y1={chartHeight} 
                x2={chartWidth} y2={chartHeight} 
                stroke="white" strokeOpacity="0.1" strokeWidth="1" 
                vectorEffect="non-scaling-stroke" 
              />

              <path 
                d={areaPath} 
                fill="url(#areaGradient)" 
                className="transition-all duration-500 ease-out"
              />

              <path 
                d={linePath} 
                fill="none" 
                stroke="#d1ff00" 
                strokeWidth="3" 
                vectorEffect="non-scaling-stroke"
                filter="url(#glow)"
                className="transition-all duration-500 ease-out"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            {pointsCoords.map((coord, index) => (
              <div 
                key={index} 
                className="absolute flex flex-col items-center z-10"
                style={{ left: `${coord.percentX}%`, top: `${coord.y}px`, transform: 'translate(-50%, -50%)' }}
              >
                {coord.totalKm > 0 && (
                  <div className="absolute -top-7 flex items-baseline gap-0.5 pointer-events-none">
                    <span className="text-sm font-black text-white">{coord.totalKm}</span>
                    <span className="text-[9px] font-bold text-race-volt">KM</span>
                  </div>
                )}
                
                <div 
                  className={`w-2.5 h-2.5 rounded-full border-2 border-background shadow-[0_0_8px_rgba(209,255,0,0.6)] ${coord.totalKm > 0 ? 'bg-race-volt' : 'bg-transparent border-white/20'}`}
                ></div>
              </div>
            ))}

            <div className="flex justify-between w-full absolute -bottom-6 px-1">
              {chartPoints.map((p, i) => (
                <span key={i} className={`text-[9px] font-bold uppercase tracking-wider ${p.totalKm > 0 ? 'text-gray-300' : 'text-gray-600'}`}>
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 border border-dashed border-white/5 rounded-2xl text-gray-600 italic text-center p-6 text-sm">
            Nenhum volume rodado nos últimos 6 meses.
            A pista te aguarda!
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xs font-bold uppercase text-gray-500 tracking-widest">Galeria de Conquistas</h3>
        <AddRaceModal /> 
      </div>
      
      <div className="flex flex-col gap-4">
        {completedRaces.length > 0 ? (
          completedRaces.map((race) => (
            <div key={race.id} className="bg-race-volt/5 border border-race-volt/20 p-4 rounded-2xl flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-race-volt/20 p-3 rounded-full text-race-volt shrink-0">
                  {race.activity_type === 'treino' ? <Activity size={24} /> : <Medal size={24} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white uppercase leading-tight">{race.name}</h4>
                    {race.activity_type === 'treino' && (
                      <span className="text-[8px] bg-race-volt/20 text-race-volt px-1.5 py-0.5 rounded font-black uppercase tracking-widest">Treino</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{race.distance.toUpperCase()}</p>
                  
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
              <div className="flex flex-col items-end shrink-0">
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
    </main>
  );
}