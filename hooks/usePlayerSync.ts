import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../services/db';
import { RealtimeChannel } from '@supabase/supabase-js';

interface SyncState {
  isPlaying: boolean;
  time: number;
  episode?: string;
}

export const usePlayerSync = (roomId: string | null, iframeRef: React.RefObject<HTMLIFrameElement>) => {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const clientIdRef = useRef(Math.random().toString(36).substring(7));
  const [role, setRole] = useState<'host' | 'viewer' | null>(null);
  const roleRef = useRef<'host' | 'viewer' | null>(null);
  const [usersCount, setUsersCount] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const lastTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  const hostStateRef = useRef<SyncState>({ isPlaying: false, time: 0 });
  const ignoreNextEventRef = useRef(false);
  
  const navigate = useNavigate();
  const { id, episode } = useParams();

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  const updateHostState = async (state: Partial<SyncState>) => {
    if (roleRef.current !== 'host' || !channelRef.current || !isSubscribed) return;
    
    console.log('[SYNC] Host updating presence state:', { isPlaying: isPlayingRef.current, time: lastTimeRef.current, ...state });
    // Update our presence with the new player state
    await channelRef.current.track({
      client_id: clientIdRef.current,
      joined_at: (channelRef.current as any).joinedAt || Date.now(),
      state: {
        isPlaying: isPlayingRef.current,
        time: lastTimeRef.current,
        episode,
        ...state
      }
    });
  };

  useEffect(() => {
    if (!roomId || !supabase) return;

    const myId = clientIdRef.current;
    const joinedAt = Date.now();
    console.log(`[SYNC] Connecting to room: ${roomId} as client: ${myId}`);

    const channel = supabase.channel(`room:${roomId}`, {
      config: {
        presence: { key: 'user' },
      },
    });

    (channel as any).joinedAt = joinedAt;
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const presences = Object.values(state).flat() as any[];
        setUsersCount(presences.length);

        if (presences.length > 0) {
          const sorted = presences.sort((a, b) => 
            (a.joined_at || 0) - (b.joined_at || 0) || 
            (a.client_id || '').localeCompare(b.client_id || '')
          );
          
          const host = sorted[0];
          const isHost = host?.client_id === myId;
          const newRole = isHost ? 'host' : 'viewer';
          
          if (roleRef.current !== newRole) {
            console.log(`[SYNC] Role assigned: ${newRole}. Host is: ${host?.client_id}`);
            setRole(newRole);
          }

          // If we are viewer, sync from host's presence data
          if (newRole === 'viewer' && host?.state) {
            const hState = host.state as SyncState;
            // Only sync if state is different enough
            if (hState.episode !== hostStateRef.current.episode || 
                hState.isPlaying !== hostStateRef.current.isPlaying || 
                Math.abs(hState.time - hostStateRef.current.time) > 5) {
              console.log('[SYNC] Syncing from host presence:', hState);
              hostStateRef.current = hState;
              syncToPlayer(hState);
            }
          }
        }
      })
      .subscribe(async (status: string) => {
        console.log(`[SYNC] Channel status: ${status}`);
        if (status === 'SUBSCRIBED') {
          setIsSubscribed(true);
          await channel.track({
            client_id: myId,
            joined_at: joinedAt,
            state: { isPlaying: false, time: 0, episode }
          });
        }
      });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      setIsSubscribed(false);
      setRole(null);
    };
  }, [roomId]);

  // Periodic sync from host
  useEffect(() => {
    if (role !== 'host' || !isSubscribed) return;
    const interval = setInterval(() => updateHostState({}), 5000);
    return () => clearInterval(interval);
  }, [role, isSubscribed, episode]);

  // Listen to iframe messages
  useEffect(() => {
    if (!roomId || !iframeRef.current) return;

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data) return;

      // Log all player messages for debugging
      if (data.key && data.key.startsWith('kodik_player')) {
        // console.log('[SYNC] Player message:', data.key, data.value);
      }

      // Kodik Player Ready
      if (data.key === 'kodik_player_ready') {
        console.log('[SYNC] Player ready event received');
        if (roleRef.current === 'viewer' && hostStateRef.current) {
          console.log('[SYNC] Viewer player ready, syncing to host state');
          syncToPlayer(hostStateRef.current);
        }
      }

      // Update local time state for both host and viewer to calculate diffs correctly
      if (data.key === 'kodik_player_time_update') {
        const newTime = data.value;
        const jump = Math.abs(newTime - lastTimeRef.current);
        lastTimeRef.current = newTime;
        
        if (roleRef.current === 'host' && jump > 2) {
          console.log('[SYNC] Host seek detected, syncing immediately');
          updateHostState({ time: newTime });
        }
      } else if (data.key === 'kodik_player_api' && data.value?.kodik_player_time_update) {
        const newTime = data.value.kodik_player_time_update;
        const jump = Math.abs(newTime - lastTimeRef.current);
        lastTimeRef.current = newTime;
        
        if (roleRef.current === 'host' && jump > 2) {
          console.log('[SYNC] Host seek detected (via api), syncing immediately');
          updateHostState({ time: newTime });
        }
      }

      // Update local play state for both roles to avoid redundant commands
      if (data.key === 'kodik_player_play') {
        isPlayingRef.current = true;
      } else if (data.key === 'kodik_player_pause') {
        isPlayingRef.current = false;
      }

      if (roleRef.current === 'host') {
        // Kodik events
        if (data.key === 'kodik_player_play') {
          updateHostState({ isPlaying: true });
        } else if (data.key === 'kodik_player_pause') {
          updateHostState({ isPlaying: false });
        } else if (data.key === 'kodik_player_api') {
          const value = data.value;
          if (value.kodik_player_play) {
            isPlayingRef.current = true;
            updateHostState({ isPlaying: true });
          } else if (value.kodik_player_pause) {
            isPlayingRef.current = false;
            updateHostState({ isPlaying: false });
          }
        }
        
        // PlayerJS / Generic events
        try {
          let parsed = typeof data === 'string' ? JSON.parse(data) : data;
          if (parsed.event === 'play' || parsed.method === 'play') {
            isPlayingRef.current = true;
            updateHostState({ isPlaying: true });
          } else if (parsed.event === 'pause' || parsed.method === 'pause') {
            isPlayingRef.current = false;
            updateHostState({ isPlaying: false });
          } else if (parsed.event === 'timeupdate' || parsed.event === 'time') {
            lastTimeRef.current = parsed.value || parsed.time || 0;
          }
        } catch (e) {}
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [roomId, iframeRef, role, episode, isSubscribed]);

  const syncToPlayer = (state: SyncState, force = false) => {
    if (state.episode && state.episode !== episode) {
      console.log(`[SYNC] Episode mismatch: ${state.episode} vs ${episode}. Navigating...`);
      navigate(`/anime/${id}/${state.episode}?room=${roomId}`);
      return;
    }
    if (!iframeRef.current || !iframeRef.current.contentWindow) {
      console.warn('[SYNC] Cannot sync: iframe not ready');
      return;
    }
    const target = iframeRef.current.contentWindow;

    console.log(`[SYNC] Viewer syncing to player${force ? ' (forced)' : ''}:`, state);

    // Sync Play/Pause
    if (force || state.isPlaying !== isPlayingRef.current) {
      isPlayingRef.current = state.isPlaying;
      const cmd = state.isPlaying ? 'play' : 'pause';
      
      console.log(`[SYNC] Sending ${cmd} to player`);
      
      // Kodik API v2
      target.postMessage({ key: 'kodik_player_api', value: { method: cmd } }, '*');
      target.postMessage(JSON.stringify({ key: 'kodik_player_api', value: { method: cmd } }), '*');
      // Kodik API v1 (Legacy)
      target.postMessage({ key: `kodik_player_${cmd}` }, '*');
      target.postMessage(JSON.stringify({ key: `kodik_player_${cmd}` }), '*');
      
      // PlayerJS / Generic
      target.postMessage(JSON.stringify({ event: cmd }), '*');
      target.postMessage({ method: cmd }, '*');
    }
    
    // Sync Time
    const timeDiff = Math.abs(state.time - lastTimeRef.current);
    if (force || timeDiff > 3) {
      console.log(`[SYNC] Seeking player to ${state.time} (diff: ${timeDiff.toFixed(1)}s)`);
      
      // Kodik API v2
      target.postMessage({ key: 'kodik_player_api', value: { method: 'seek', seconds: state.time } }, '*');
      target.postMessage({ key: 'kodik_player_api', value: { method: 'seek', time: state.time } }, '*');
      target.postMessage(JSON.stringify({ key: 'kodik_player_api', value: { method: 'seek', seconds: state.time } }), '*');
      
      // Kodik API v1 (Legacy)
      target.postMessage({ key: 'kodik_player_seek', value: state.time }, '*');
      target.postMessage(JSON.stringify({ key: 'kodik_player_seek', value: state.time }), '*');
      
      // PlayerJS / Generic
      target.postMessage(JSON.stringify({ event: 'seek', value: state.time }), '*');
      target.postMessage({ method: 'seek', value: state.time }, '*');
      
      // We don't update lastTimeRef.current here, we wait for the player to report its new time
      // This allows retrying if the seek fails.
    }
  };

  const sync = () => {
    if (roleRef.current === 'viewer' && hostStateRef.current) {
      console.log('[SYNC] Manual sync triggered');
      syncToPlayer(hostStateRef.current, true);
    }
  };

  return { role, usersCount, myId: clientIdRef.current, sync };
};
