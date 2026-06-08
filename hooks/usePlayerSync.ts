import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/db';

interface SyncState {
  isPlaying: boolean;
  time: number;
  episode?: string;
  kodikVideo?: any;
  nativeAudioTrack?: number;
}

export interface RoomUser {
  clientId: string;
  name: string;
  avatar: string;
  isMuted: boolean;
  isHost: boolean;
  joinedAt: number;
}

const playRemoteStream = (peerId: string, stream: MediaStream) => {
  let audioEl = document.getElementById(`audio-peer-${peerId}`) as HTMLAudioElement;
  if (!audioEl) {
    audioEl = document.createElement('audio');
    audioEl.id = `audio-peer-${peerId}`;
    audioEl.autoplay = true;
    audioEl.style.display = 'none';
    document.body.appendChild(audioEl);
  }
  audioEl.srcObject = stream;
};

const removeRemoteStream = (peerId: string) => {
  const audioEl = document.getElementById(`audio-peer-${peerId}`);
  if (audioEl) {
    audioEl.remove();
  }
};

export const usePlayerSync = (
  roomId: string | null,
  iframeRef: React.RefObject<HTMLIFrameElement>,
  nativeVideoRef: React.RefObject<HTMLVideoElement>,
  isCustomPlayer: boolean
) => {
  const { user } = useAuth();
  const userName = user?.name || `Аноним_${Math.floor(Math.random() * 900 + 100)}`;
  const userAvatar = user?.avatar || `https://picsum.photos/seed/${userName}/200`;

  const channelRef = useRef<any>(null);
  const clientIdRef = useRef(Math.random().toString(36).substring(2, 9));
  const joinedAtRef = useRef<number>(Date.now());

  const [role, setRole] = useState<'host' | 'viewer' | null>(null);
  const roleRef = useRef<'host' | 'viewer' | null>(null);
  const [usersCount, setUsersCount] = useState(0);
  const [joinedUsers, setJoinedUsers] = useState<RoomUser[]>([]);

  // Voice chat states
  const [isVoiceMuted, setIsVoiceMuted] = useState(true);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  const lastTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  const viewerKodikHashRef = useRef<string | null>(null);
  const hostStateRef = useRef<SyncState>({ isPlaying: false, time: 0 });

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

  // Update voice state initially or on socket load
  const sendVoiceState = (muted: boolean) => {
    if (channelRef.current) {
      channelRef.current.track({
        name: userName,
        avatar: userAvatar,
        isMuted: muted,
        joinedAt: joinedAtRef.current,
      }).catch((err: any) => console.warn('[Presence] track error on voice state:', err));
    }
  };

  const toggleVoiceMute = () => {
    const newMuted = !isVoiceMuted;
    setIsVoiceMuted(newMuted);

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !newMuted;
      });
    }
    sendVoiceState(newMuted);
  };

  // Acquire microphone permission on join
  useEffect(() => {
    if (!roomId) return;
    let isActive = true;

    const requestMic = async () => {
      try {
        console.log('[VoiceChat] Obtaining microphone stream...');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (!isActive) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        localStreamRef.current = stream;
        // set disabled initially matching default mute state
        stream.getAudioTracks().forEach(t => {
          t.enabled = !isVoiceMuted;
        });

        console.log('[VoiceChat] Track success, attaching to peers');
        // Attach stream tracks to existing peer connections if any
        pcsRef.current.forEach((pc) => {
          stream.getTracks().forEach(track => {
            pc.addTrack(track, stream);
          });
        });
      } catch (err: any) {
        console.warn('[VoiceChat] Mic permissions failed:', err.message || err);
        setVoiceError('Разрешите доступ к микрофону для разговора в комнате.');
      }
    };

    requestMic();

    return () => {
      isActive = false;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }
    };
  }, [roomId]);

  // Handle peer connection setup
  const getOrCreatePeerConnection = (peerId: string) => {
    let pc = pcsRef.current.get(peerId);
    if (!pc) {
      console.log(`[WebRTC] Creating peer connection for: ${peerId}`);
      pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      pc.onicecandidate = (event) => {
        if (event.candidate && channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'webrtc-relay',
            payload: {
              senderId: clientIdRef.current,
              targetId: peerId,
              signal: { candidate: event.candidate }
            }
          });
        }
      };

      pc.ontrack = (event) => {
        console.log(`[WebRTC] Received audio track from ${peerId}`);
        if (event.streams && event.streams[0]) {
          playRemoteStream(peerId, event.streams[0]);
        }
      };

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc!.addTrack(track, localStreamRef.current!);
        });
      }

      pcsRef.current.set(peerId, pc);
    }
    return pc;
  };

  const updateHostState = async (state: Partial<SyncState>) => {
    if (roleRef.current !== 'host' || !channelRef.current) return;

    pendingStateUpdatesRef.current = { ...pendingStateUpdatesRef.current, ...state };

    if (updateTimeoutRef.current) return;

    updateTimeoutRef.current = setTimeout(async () => {
      updateTimeoutRef.current = null;
      if (roleRef.current !== 'host' || !channelRef.current) return;

      const currentEpisodeStr = document.location.pathname.split('/episode/')[1]?.split('/')[0] || episode;

      const newState = {
        isPlaying: isPlayingRef.current,
        time: lastTimeRef.current,
        episode: currentEpisodeStr,
        kodikVideo: hostStateRef.current.kodikVideo,
        nativeAudioTrack: hostStateRef.current.nativeAudioTrack,
        ...pendingStateUpdatesRef.current
      };

      pendingStateUpdatesRef.current = {};

      const stateStr = JSON.stringify(newState);
      if (stateStr === lastStateUpdateStrRef.current) {
        return;
      }
      lastStateUpdateStrRef.current = stateStr;
      hostStateRef.current = { ...hostStateRef.current, ...newState };

      console.log('[SYNC] Broadcasting Host state update:', newState);
      channelRef.current.send({
        type: 'broadcast',
        event: 'player-state-update',
        payload: newState
      });
    }, 400);
  };

  // Supabase Channel Connection Management
  useEffect(() => {
    if (!roomId) return;

    const myId = clientIdRef.current;
    console.log(`[SYNC] Connecting to Supabase Realtime channel room_${roomId} as client ${myId}`);

    const channel = supabase.channel(`room_${roomId}`, {
      config: {
        presence: {
          key: myId,
        },
      },
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        console.log('[Presence] Sync event state:', state);

        const presenceUsers: RoomUser[] = [];
        Object.entries(state).forEach(([key, list]) => {
          const val = (list as any[])[0];
          if (val) {
            presenceUsers.push({
              clientId: key,
              name: val.name || 'Аноним',
              avatar: val.avatar || '',
              isMuted: typeof val.isMuted === 'boolean' ? val.isMuted : true,
              joinedAt: val.joinedAt || Date.now(),
              isHost: false, // Computed next
            });
          }
        });

        // Stable sorting by joinedAt
        presenceUsers.sort((a, b) => a.joinedAt - b.joinedAt);

        const mappedUsers = presenceUsers.map((u, index) => ({
          ...u,
          isHost: index === 0,
        }));

        setJoinedUsers(mappedUsers);
        setUsersCount(mappedUsers.length);

        const me = mappedUsers.find((u) => u.clientId === myId);
        const myComputedRole = me?.isHost ? 'host' : 'viewer';
        if (myComputedRole !== roleRef.current) {
          console.log(`[SYNC] Role updated based on stable sorting: ${roleRef.current} -> ${myComputedRole}`);
          setRole(myComputedRole);
        }

        // WebRTC signaling setup for visible peers
        mappedUsers.forEach((item: RoomUser) => {
          if (item.clientId !== myId) {
            const pc = getOrCreatePeerConnection(item.clientId);
            const isInitiator = myId < item.clientId;
            if (isInitiator && pc.connectionState === 'new') {
              console.log(`[WebRTC] Initiating offer connection to ${item.clientId}`);
              pc.createOffer()
                .then((offer) => pc.setLocalDescription(offer))
                .then(() => {
                  channel.send({
                    type: 'broadcast',
                    event: 'webrtc-relay',
                    payload: {
                      senderId: myId,
                      targetId: item.clientId,
                      signal: { sdp: pc.localDescription },
                    },
                  });
                })
                .catch((e) => console.error('[WebRTC] Offer initiation error', e));
            }
          }
        });

        // Cleanup retired connections
        pcsRef.current.forEach((pc, peerId) => {
          const stillInRoom = mappedUsers.some((x: RoomUser) => x.clientId === peerId);
          if (!stillInRoom) {
            console.log(`[WebRTC] Closing peer connection for retired user ${peerId}`);
            pc.close();
            pcsRef.current.delete(peerId);
            removeRemoteStream(peerId);
          }
        });
      })
      .on('broadcast', { event: 'player-state-update' }, ({ payload }: { payload: any }) => {
        if (roleRef.current !== 'viewer') return;
        const hState = payload as SyncState;

        if (hState.episode !== hostStateRef.current.episode ||
            hState.isPlaying !== hostStateRef.current.isPlaying ||
            Math.abs(hState.time - hostStateRef.current.time) > 4 ||
            hState.kodikVideo?.hash !== hostStateRef.current.kodikVideo?.hash) {
          
          console.log('[SYNC] Synced from Host via Supabase broadcast:', hState);
          const force = hState.kodikVideo?.hash !== hostStateRef.current.kodikVideo?.hash;
          hostStateRef.current = hState;
          syncToPlayer(hState, force);
        }
      })
      .on('broadcast', { event: 'webrtc-relay' }, async ({ payload }: { payload: any }) => {
        if (payload.targetId !== myId) return;

        const senderId = payload.senderId;
        const sig = payload.signal;
        const pc = getOrCreatePeerConnection(senderId);

        if (sig.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(sig.sdp));
          if (sig.sdp.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            channel.send({
              type: 'broadcast',
              event: 'webrtc-relay',
              payload: {
                senderId: myId,
                targetId: senderId,
                signal: { sdp: pc.localDescription },
              },
            });
          }
        } else if (sig.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(sig.candidate));
        }
      });

    channel.subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        console.log('[SYNC] Subscribed to Supabase channel, tracking presence...');
        await channel.track({
          name: userName,
          avatar: userAvatar,
          isMuted: isVoiceMuted,
          joinedAt: joinedAtRef.current,
        });
      }
    });

    return () => {
      console.log('[SYNC] Unsubscribing from channel, cleaning connections');
      channel.unsubscribe();
      channelRef.current = null;

      pcsRef.current.forEach((pc, id) => {
        pc.close();
        removeRemoteStream(id);
      });
      pcsRef.current.clear();
    };
  }, [roomId]);

  // Periodic status feedback from host
  useEffect(() => {
    if (role !== 'host') return;
    const interval = setInterval(() => updateHostState({}), 4000);
    return () => clearInterval(interval);
  }, [role, episode]);

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

      if (data.key === 'kodik_player_play') {
        isPlayingRef.current = true;
      } else if (data.key === 'kodik_player_pause') {
        isPlayingRef.current = false;
      }

      if (roleRef.current === 'host') {
        if (data.key === 'kodik_player_current_episode' || data.key === 'kodik_player_video_change') {
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
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [roomId, iframeRef, role, episode]);

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

      target.postMessage({ key: 'kodik_player_api', value: { method: cmd } }, '*');
      target.postMessage(JSON.stringify({ key: 'kodik_player_api', value: { method: cmd } }), '*');
      target.postMessage({ key: `kodik_player_${cmd}` }, '*');
      target.postMessage(JSON.stringify({ key: `kodik_player_${cmd}` }), '*');
    }

    // Sync Time
    const timeDiff = Math.abs(state.time - lastTimeRef.current);
    if (force || timeDiff > 3) {
      console.log(`[SYNC] Seeking player to ${state.time} (diff: ${timeDiff.toFixed(1)}s)`);

      target.postMessage({ key: 'kodik_player_api', value: { method: 'seek', seconds: state.time } }, '*');
      target.postMessage({ key: 'kodik_player_api', value: { method: 'seek', time: state.time } }, '*');
      target.postMessage(JSON.stringify({ key: 'kodik_player_api', value: { method: 'seek', seconds: state.time } }), '*');
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

  return {
    role,
    usersCount,
    myId: clientIdRef.current,
    sync,
    hostState: exposedHostState,
    isVoiceMuted,
    toggleVoiceMute,
    joinedUsers,
    voiceError
  };
};
