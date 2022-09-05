import React, {
  createContext,
  HTMLAttributes,
  RefObject,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useMemo,
} from 'react';

import { Participant, Track, TrackPublication } from 'livekit-client';
import { isLocal, participantInfoObserver, setupParticipantMedia } from '@livekit/components-core';
import { mergeProps } from '../utils';

export type ParticipantProps = HTMLAttributes<HTMLDivElement> & {
  participant?: Participant;
};

const ParticipantContext = createContext<Participant | undefined>(undefined);

export const useParticipantContext = () => {
  const participant = useContext(ParticipantContext);
  if (!participant) {
    throw Error('tried to access participant context outside of participant context provider');
  }
  return participant;
};

export const useParticipantMedia = (
  participant: Participant,
  source: Track.Source,
  element?: RefObject<HTMLMediaElement>,
) => {
  const [publication, setPublication] = useState(participant.getTrack(source));
  const [isMuted, setMuted] = useState(publication?.isMuted);
  const [isSubscribed, setSubscribed] = useState(publication?.isSubscribed);
  const [track, setTrack] = useState(publication?.track);

  // TODO: refactor from callback to observable.
  const handleUpdate = useCallback(
    (publication: TrackPublication | undefined) => {
      console.log('setting publication', publication);
      setPublication(publication);
      setMuted(publication?.isMuted);
      setSubscribed(publication?.isSubscribed);
      setTrack(publication?.track);
    },
    [participant, source],
  );

  const { mediaListener, className } = useMemo(() => setupParticipantMedia(source), [source]);

  useEffect(() => {
    return mediaListener(participant, handleUpdate, element?.current);
  }, [participant, source, element]);

  return { publication, isMuted, isSubscribed, track, className };
};

export const useParticipantInfo = (participant: Participant) => {
  const [identity, setIdentity] = useState(participant.identity);
  const [name, setName] = useState(participant.name);
  const [metadata, setMetadata] = useState(participant.metadata);

  const handleUpdate = useCallback(
    (p: Participant) => {
      console.log('participant info update', p);
      setIdentity(p.identity);
      setName(p.name);
      setMetadata(p.metadata);
    },
    [participant],
  );

  useEffect(() => {
    const listener = participantInfoObserver(participant, handleUpdate);
    return listener.unsubscribe();
  });

  return { identity, name, metadata };
};

export const ParticipantView = ({ participant, children, ...htmlProps }: ParticipantProps) => {
  if (!participant) {
    throw Error('need to provide a participant');
  }
  const cameraEl = useRef<HTMLVideoElement>(null);
  const audioEl = useRef<HTMLAudioElement>(null);

  const { className: videoClass, isMuted: videoIsMuted } = useParticipantMedia(
    participant,
    Track.Source.Camera,
    cameraEl,
  );
  const { className: audioClass, isMuted: audioIsMuted } = useParticipantMedia(
    participant,
    Track.Source.Microphone,
    audioEl,
  );

  const mergedProps = useMemo(
    // TODO: move to hook.
    () => mergeProps(htmlProps),

    [videoIsMuted, audioIsMuted, htmlProps],
  );

  return (
    <div
      {...mergedProps}
      style={{ position: 'relative' }}
      data-audio-is-muted={audioIsMuted} // TODO: move data properties into core.
      data-video-is-muted={videoIsMuted}
    >
      <video ref={cameraEl} style={{ width: '100%', height: '100%' }} className={videoClass}>
        <p>child of video</p>
      </video>
      {!isLocal(participant) && <audio ref={audioEl} className={audioClass}></audio>}
      <ParticipantContext.Provider value={participant}>{children}</ParticipantContext.Provider>
    </div>
  );
};

export const ParticipantName = (props: HTMLAttributes<HTMLSpanElement>) => {
  const participant = useParticipantContext();
  const { name, identity } = useParticipantInfo(participant);
  return (
    <span {...props} data-muted={'test'}>
      {name !== '' ? name : identity} {props.children}
    </span>
  );
};