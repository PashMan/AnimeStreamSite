import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../services/db';
import { RealtimeChannel } from '@supabase/supabase-js';

const activeRoomsCount: Record<string, number> = {};

interface SyncState {
  isPlaying: boolean;
  time: number;
  episode?: string;
  kodikVideo?: any;
  nativeAudioTrack?: number;
}

export const usePlayerSync = (
  roomId: string | null, 
  iframeRef: React.RefObject<HTMLIFrameElement>,
  nativeVideoRef: React.RefObject<HTMLVideoElement>,
  isCustomPlayer: boolean
) => {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const clientIdRef = useRef(Math.random().toString(36).substring(2, 9));
  const [role, setRole] = useState<'host' | 'viewer' | null>(null);
  const roleRef = useRef<'host' | 'viewer' | null>(null);
  const [usersCount, setUsersCount] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const lastTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  const viewerKodikHashRef = useRef<string | null>(null);
  const hostStateRef = useRef<SyncState>({ isPlaying: false, time: 0 });
  const ignoreNextEventRef = useRef(false);
  
  const navigate = useNavigate();
  const params = useParams();
  const id = params.id;
  const starParam = params['*'];
  const episode = starParam?.startsWith('episode/') ? starParam.split('episode/')[1]?.split('/')[0] : undefined;

  const currentContextRef = useRef({ id, episode, isCustomPlayer });
  useEffect(() => {
    currentContextRef.current = { id, episode, isCustomPlayer };
  }, [id, episode, isCustomPlayer]);

  const lastStateUpdateStrRef = useRef<string>('');
  const updateTimeoutRef = useRef<any>(null);
  const pendingStateUpdatesRef = useRef<Partial<SyncState>>({});

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  const updateHostState = async (state: Partial<SyncState>) => {
    if (roleRef.current !== 'host' || !channelRef.current || !isSubscribed) return;
    
    // Accumulate pending state updates
    pendingStateUpdatesRef.current = { ...pendingStateUpdatesRef.current, ...state };

    if (updateTimeoutRef.current) return;

    updateTimeoutRef.current = setTimeout(async () => {
      updateTimeoutRef.current = null;
      if (roleRef.current !== 'host' || !channelRef.current || !isSubscribed) return;

      const currentEpisodeStr = document.location.pathname.split('/episode/')[1]?.split('/')[0] || episode;
      
      const newState = {
        isPlaying: isPlayingRef.current,
        time: lastTimeRef.current,
        episode: currentEpisodeStr,
        kodikVideo: hostStateRef.current.kodikVideo,
        nativeAudioTrack: hostStateRef.current.nativeAudioTrack,
        ...pendingStateUpdatesRef.current
      };
      
      // Clear pending
      pendingStateUpdatesRef.current = {};
      
      // Strict equality check to avoid tracking duplicated states
      const stateStr = JSON.stringify(newState);
      if (stateStr === lastStateUpdateStrRef.current) {
        return; 
      }
      lastStateUpdateStrRef.current = stateStr;

      // Update local ref immediately 
      hostStateRef.current = { ...hostStateRef.current, ...newState };

      console.log('[SYNC] Host updating presence state:', newState);
      try {
        await channelRef.current.track({
          client_id: clientIdRef.current,
          joined_at: (channelRef.current as any).joinedAt || Date.now(),
          state: newState
        });
      } catch (e: any) {
        console.warn('[SYNC] Error tracking state:', e.message);
      }
    }, 400); // Wait 400ms to batch rapid events
  };

  useEffect(() => {
    if (!roomId || !supabase) return;

    activeRoomsCount[roomId] = (activeRoomsCount[roomId] || 0) + 1;

    const myId = clientIdRef.current;
    const joinedAt = Date.now();
    console.log(`[SYNC] Connecting to room: ${roomId} as client: ${myId}`);

    // Find existing channel or create a new one
    let channel: RealtimeChannel = supabase.getChannels().find((c: any) => c.topic === `realtime:room:${roomId}` || c.topic === `room:${roomId}`) as RealtimeChannel;
    
    if (!channel) {
      channel = supabase.channel(`room:${roomId}`, {
        config: {
          presence: { key: myId },
        },
      });
    }

    (channel as any).joinedAt = joinedAt;
    channelRef.current = channel;

    const handlePresenceSync = () => {
      if (!channel) return;
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
              Math.abs(hState.time - hostStateRef.current.time) > 5 ||
              hState.kodikVideo?.hash !== hostStateRef.current.kodikVideo?.hash) {
            console.log('[SYNC] Syncing from host presence:', hState);
            const force = hState.kodikVideo?.hash !== hostStateRef.current.kodikVideo?.hash;
            hostStateRef.current = hState;
            syncToPlayer(hState, force);
          }
        }
      }
    };

    // Before re-subscribing, check if it's already bound
    const cState = (channel as any).state;
    if (cState !== 'SUBSCRIBED' && cState !== 'JOINED') {
      channel
        .on('presence', { event: 'sync' }, handlePresenceSync)
        .subscribe(async (status: string) => {
          console.log(`[SYNC] Channel status: ${status}`);
          if (status === 'SUBSCRIBED') {
            setIsSubscribed(true);
            const currentEpisodeStr = document.location.pathname.split('/episode/')[1]?.split('/')[0] || episode;
            try {
              await channel.track({
                client_id: myId,
                joined_at: joinedAt,
                state: { isPlaying: false, time: 0, episode: currentEpisodeStr }
              });
            } catch (e: any) {
              console.warn("Failed to initially track presence:", e.message);
            }
          }
        });
    } else {
       // Already subscribed (e.g. from Strict Mode), just apply listeners and trigger sync
       setIsSubscribed(true);
       channel.on('presence', { event: 'sync' }, handlePresenceSync);
       handlePresenceSync(); // trigger manually once
       
       // Re-track presence because unmount might have untracked it
       const currentEpisodeStr = document.location.pathname.split('/episode/')[1]?.split('/')[0] || episode;
       channel.track({
         client_id: myId,
         joined_at: joinedAt,
         state: { isPlaying: false, time: 0, episode: currentEpisodeStr }
       }).catch((e: any) => console.warn("Failed to implicitly track presence:", e.message));
    }

    return () => {
      console.log(`[SYNC] Cleanup called for room: ${roomId}`);
      activeRoomsCount[roomId] = Math.max(0, (activeRoomsCount[roomId] || 0) - 1);
      
      // Only remove if this was a true unmount of the page, but in React 18 
      // strict mode this removes the channel prematurely.
      // So we leave it to be picked up by the next mount instantly, or it naturally 
      // times out when the component actually unmounts.
      // We will actually just untrack presence so we don't pollute.
      if (channelRef.current) {
         channelRef.current.untrack().catch(() => {});
         // Delay channel removal slightly to allow strict-mode to reconnect instead of killing the socket
         const c = channelRef.current;
         setTimeout(() => {
           if (activeRoomsCount[roomId] === 0) {
             supabase.removeChannel(c).catch(() => {});
           }
         }, 1000);
      }
      setIsSubscribed(false);
    };
  }, [roomId]);

  // Periodic sync from host
  useEffect(() => {
    if (role !== 'host' || !isSubscribed) return;
    const interval = setInterval(() => updateHostState({}), 5000);
    return () => clearInterval(interval);
  }, [role, isSubscribed, episode]);

  // Listen to native video events
  useEffect(() => {
    if (!roomId || !isCustomPlayer) return;
    let boundVideo: any = null;

    const handlePlay = () => {
      isPlayingRef.current = true;
      if (roleRef.current === 'host') updateHostState({ isPlaying: true });
    };
    const handlePause = () => {
      isPlayingRef.current = false;
      if (roleRef.current === 'host') updateHostState({ isPlaying: false });
    };
    const handleSeeked = () => {
      if (boundVideo) lastTimeRef.current = boundVideo.currentTime;
      if (roleRef.current === 'host' && boundVideo) updateHostState({ time: boundVideo.currentTime });
    };
    const handleTimeUpdate = () => {
      if (boundVideo) lastTimeRef.current = boundVideo.currentTime;
    };
    const handleAudioTrackChange = (e: any) => {
      if (roleRef.current === 'host') {
        const trackId = e.detail;
        console.log('[SYNC] Host changed audio track to:', trackId);
        updateHostState({ nativeAudioTrack: trackId });
      }
    };

    const attachListeners = (video: any) => {
      if (!video) return;
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('seeked', handleSeeked);
      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('audiotrackchange', handleAudioTrackChange);
    };

    const detachListeners = (video: any) => {
      if (!video) return;
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('audiotrackchange', handleAudioTrackChange);
    };

    // Poll to check if ref changed
    const interval = setInterval(() => {
      const currentVideo = nativeVideoRef.current;
      if (currentVideo !== boundVideo) {
        detachListeners(boundVideo);
        boundVideo = currentVideo;
        attachListeners(boundVideo);
      }
    }, 500);

    return () => {
      clearInterval(interval);
      detachListeners(boundVideo);
    };
  }, [roomId, isCustomPlayer, role]);

  // Listen to iframe messages
  useEffect(() => {
    if (!roomId || !iframeRef.current || isCustomPlayer) return;

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
          syncToPlayer(hostStateRef.current, true);
        }
      }

      if (data.key === 'kodik_player_current_episode' || data.key === 'kodik_player_video_change') {
         const v = data.value || {};
         const tempTrans = typeof v.translation === 'object' ? v.translation?.id : v.translation;
         const tempSeason = typeof v.season === 'object' ? undefined : v.season;
         const tempEpisode = typeof v.episode === 'object' ? undefined : v.episode;
         viewerKodikHashRef.current = v.hash || `${tempTrans}-${tempSeason}-${tempEpisode}`;
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
        if (data.key === 'kodik_player_current_episode' || data.key === 'kodik_player_video_change') {
           // Kodik's video change event can contain huge arrays of seasons and episodes
           // We must trim it to only the essentials (hash, translation, episode number) 
           // to prevent Supabase Realtime presence state size limits from dropping the connection.
           const v = data.value || {};
           const cleanTrans = typeof v.translation === 'object' ? v.translation?.id : v.translation;
           const cleanSeason = typeof v.season === 'object' ? undefined : v.season;
           const cleanEp = typeof v.episode === 'object' ? undefined : v.episode;
           const cleanKodikVideo = {
             hash: v.hash ? String(v.hash).substring(0, 100) : `${cleanTrans}-${cleanSeason}-${cleanEp}`,
             translation: cleanTrans,
             season: cleanSeason,
             episode: cleanEp,
           };
           updateHostState({ kodikVideo: cleanKodikVideo });
        }
        
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
    const { id: refId, isCustomPlayer: refIsCustomPlayer } = currentContextRef.current;
    const currentEpisodeStr = document.location.pathname.split('/episode/')[1]?.split('/')[0] || episode;
    
    if (state.episode && state.episode !== currentEpisodeStr) {
      console.log(`[SYNC] Episode mismatch: ${state.episode} vs ${currentEpisodeStr}. Navigating...`);
      navigate(`/anime/${refId}/episode/${state.episode}?room=${roomId}`);
      return;
    }

    if (refIsCustomPlayer) {
      if (!nativeVideoRef.current) {
        console.warn('[SYNC] Cannot sync: native video ref not ready');
        return;
      }
      const video = nativeVideoRef.current as HTMLVideoElement;

      console.log(`[SYNC] Viewer syncing to NATIVE player${force ? ' (forced)' : ''}:`, state);

      if (state.nativeAudioTrack !== undefined) {
         const art = (video as any).art;
         if (art?.hls && art.hls.audioTrack !== state.nativeAudioTrack) {
            console.log(`[SYNC] Viewer changing native audio track to ${state.nativeAudioTrack}`);
            art.hls.audioTrack = state.nativeAudioTrack;
         }
      }

      if (force || state.isPlaying !== isPlayingRef.current) {
        isPlayingRef.current = state.isPlaying;
        if (state.isPlaying) {
          const playPromise = video.play();
          if (playPromise) {
            playPromise.catch((e: any) => {
               console.warn('[SYNC] Play prevented by browser:', e);
               video.muted = true;
               video.play().catch(console.error);
            });
          }
        } else {
          video.pause();
        }
      }

      const timeDiff = Math.abs(state.time - video.currentTime);
      if (force || timeDiff > 3) {
        console.log(`[SYNC] Seeking native player to ${state.time} (diff: ${timeDiff.toFixed(1)}s)`);
        video.currentTime = state.time;
      }
      return;
    }

    if (!iframeRef.current || !iframeRef.current.contentWindow) {
      console.warn('[SYNC] Cannot sync: iframe not ready');
      return;
    }
    const target = iframeRef.current.contentWindow;

    console.log(`[SYNC] Viewer syncing to player${force ? ' (forced)' : ''}:`, state);

    if (state.kodikVideo) {
      if (viewerKodikHashRef.current !== state.kodikVideo.hash) {
         console.log('[SYNC] Translation/video changed, sending change_video API');
         viewerKodikHashRef.current = state.kodikVideo.hash;
         
         target.postMessage({ key: 'kodik_player_api', value: { method: 'change_video', autoplay: true, ...state.kodikVideo } }, '*');
         
         // If we changed video, we should delay play/seek slightly to let it load
         setTimeout(() => {
           if (state.isPlaying) {
             target.postMessage({ key: 'kodik_player_api', value: { method: 'play' } }, '*');
           }
           if (state.time > 0) {
             console.log(`[SYNC] Delayed seek after video change to ${state.time}`);
             target.postMessage({ key: 'kodik_player_api', value: { method: 'seek', seconds: state.time } }, '*');
             target.postMessage({ key: 'kodik_player_api', value: { method: 'seek', time: state.time } }, '*');
           }
         }, 1000);
      }
    }

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

  const [exposedHostState, setExposedHostState] = useState<SyncState>({ isPlaying: false, time: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      setExposedHostState({ ...hostStateRef.current });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return { role, usersCount, myId: clientIdRef.current, sync, hostState: exposedHostState };
};
