'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Medal, TrendingUp, Route, Edit2, Check, X, FileText } from 'lucide-react';
import { AddRaceModal } from '../components/AddRaceModal'; 

interface Race {
  id: string;
  name: string;
  distance: string;
  finish_time: string;
  pace: string;
  status: string;
  certificate_url?: string; 
}

interface Profile {
  id: string;
  username: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [completedRaces, setCompletedRaces] = useState<Race[]>([]);
  
  const [isEditing, setIsEditing] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    async function fetchProfileData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      
      // Filtra apenas as corridas do usuário logado
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
        }
        if (r) setCompletedRaces(r);
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
      alert('Nickname atualizado com sucesso!');

    } catch (error) {
      console.error(error);
      alert('Erro ao atualizar Nickname. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const totalKm = completedRaces.reduce((acc, race) => {
    const km = parseFloat(race.distance.replace(/[^\d.]/g, '')) || 0;
    return acc + km;
  }, 0);

  return (
    <main className="min-h-screen bg-background text-foreground p-6 font-sans">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.push('/')} className="p-2 bg-race-card rounded-xl border border-white/5 text-gray-400 hover:text-white">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-black uppercase italic tracking-tighter">
          Meu <span className="text-race-volt">Perfil</span>
        </h1>
      </div>

      <div className="flex flex-col items-center mb-10">
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
            <button onClick={handleSaveUsername} disabled={isSaving} className="bg-race-volt text-black p-1.5 rounded-lg hover:scale-105 disabled:opacity-50 transition-transform">
              <Check size={18} strokeWidth={3} />
            </button>
            <button onClick={() => { setIsEditing(false); setNewUsername(profile?.username || ''); }} className="bg-red-500/20 text-red-500 p-1.5 rounded-lg hover:bg-red-500 hover:text-white transition-colors">
              <X size={18} strokeWidth={3} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-1 relative group cursor-pointer" onClick={() => setIsEditing(true)}>
            <h2 className="text-2xl font-bold text-white uppercase">{profile?.username}</h2>
            <Edit2 size={16} className="text-gray-500 group-hover:text-race-volt transition-colors" />
          </div>
        )}
        
        {/* TEXTO ATUALIZADO AQUI */}
        <p className="text-race-volt font-medium text-sm tracking-widest uppercase mt-1">Atleta Pelotão</p>
      </div>

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
                  <Medal size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-white uppercase leading-tight">{race.name}</h4>
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
            Nenhuma prova registrada. A pista te espera!
          </div>
        )}
      </div>
    </main>
  );
}