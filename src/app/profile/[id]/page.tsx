'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Medal, TrendingUp, Route, FileText, UserMinus } from 'lucide-react';

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

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const profileId = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [completedRaces, setCompletedRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchPublicProfile() {
      if (!profileId) return;

      const { data: p } = await supabase.from('profiles').select('*').eq('id', profileId).single();
      const { data: r } = await supabase
        .from('races')
        .select('*')
        .eq('user_id', profileId)
        .eq('status', 'Concluído')
        .order('date', { ascending: false });

      if (isMounted) {
        if (p) setProfile(p);
        if (r) setCompletedRaces(r);
        setLoading(false);
      }
    }

    fetchPublicProfile();
    return () => { isMounted = false; };
  }, [profileId]);

  const handleRemoveFriend = async () => {
    if (!confirm(`Tem certeza que deseja remover ${profile?.username} do seu Pelotão?`)) return;
    setRemoving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      // Deleta a amizade independentemente de quem enviou o convite
      const { error } = await supabase
        .from('friendships')
        .delete()
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${profileId}),and(sender_id.eq.${profileId},receiver_id.eq.${user.id})`);

      if (error) throw error;
      
      alert(`${profile?.username} foi removido do Pelotão.`);
      router.push('/'); // Volta para a home
    } catch (error) {
      console.error(error);
      alert('Erro ao remover do Pelotão.');
      setRemoving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-race-volt font-bold uppercase animate-pulse">Carregando Atleta...</div>;
  }

  if (!profile) {
    return <div className="min-h-screen bg-background flex flex-col items-center justify-center text-white font-bold uppercase"><p>Atleta não encontrado</p><button onClick={() => router.push('/')} className="mt-4 text-race-volt">Voltar</button></div>;
  }

  const totalKm = completedRaces.reduce((acc, race) => {
    const km = parseFloat(race.distance.replace(/[^\d.]/g, '')) || 0;
    return acc + km;
  }, 0);

  return (
    <main className="min-h-screen bg-background text-foreground p-6 font-sans">
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => router.back()} className="p-2 bg-race-card rounded-xl border border-white/5 text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={24} />
        </button>

        {/* BOTÃO DE REMOVER AMIGO AQUI 👇 */}
        <button 
          onClick={handleRemoveFriend}
          disabled={removing}
          className="flex items-center gap-1.5 p-2 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
        >
          <UserMinus size={14} strokeWidth={2.5} />
          {removing ? 'Removendo...' : 'Remover'}
        </button>
      </div>

      <div className="flex flex-col items-center mb-10">
        <div className="w-24 h-24 rounded-full border-4 border-white/10 p-1 mb-4">
          <div className="w-full h-full bg-race-card rounded-full flex items-center justify-center text-3xl text-white font-black uppercase">
            {profile.username.substring(0, 2)}
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white uppercase">{profile.username}</h2>
        <p className="text-gray-500 font-medium text-sm tracking-widest uppercase mt-1">Atleta Pelotão</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-10">
        <div className="bg-race-card border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center gap-2">
          <TrendingUp className="text-gray-400" size={24} />
          <span className="text-3xl font-black italic">{completedRaces.length}</span>
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Provas</span>
        </div>
        <div className="bg-race-card border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center gap-2">
          <Route className="text-gray-400" size={24} />
          <span className="text-3xl font-black italic">{totalKm}</span>
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Km Rodados</span>
        </div>
      </div>

      <h3 className="text-xs font-bold uppercase text-gray-500 tracking-widest mb-4">Galeria de {profile.username}</h3>
      
      <div className="flex flex-col gap-4">
        {completedRaces.length > 0 ? (
          completedRaces.map((race) => (
            <div key={race.id} className="bg-race-card border border-white/5 p-4 rounded-2xl flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-white/5 p-3 rounded-full text-gray-400 shrink-0">
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
                      className="mt-2 inline-flex items-center gap-1.5 text-[10px] uppercase font-bold text-gray-400 bg-white/5 px-2 py-1 rounded hover:text-white transition-colors"
                    >
                      <FileText size={10} /> Ver Certificado
                    </a>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="font-black italic text-white">{race.finish_time || '--:--'}</span>
                <span className="text-[10px] text-gray-500 font-bold uppercase">{race.pace ? `${race.pace} /km` : ''}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center p-8 border border-dashed border-white/10 rounded-2xl text-gray-500 text-sm italic">
            Nenhuma prova registrada por este atleta ainda.
          </div>
        )}
      </div>
    </main>
  );
}