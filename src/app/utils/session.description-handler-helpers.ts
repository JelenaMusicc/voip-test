import { Web } from 'sip.js';

export function isSessionDescriptionHandler(
  sessionDescriptionHandler: unknown
): sessionDescriptionHandler is Web.SessionDescriptionHandler {
  return sessionDescriptionHandler instanceof Web.SessionDescriptionHandler;
}

export function createMediaStream(
  sessionDescriptionHandler: Web.SessionDescriptionHandler
): MediaStream | null {
  const receivers = sessionDescriptionHandler.peerConnection?.getReceivers();
  if (!receivers?.length) {
    return null;
  }
  const mediaStream = receivers.reduce((stream, receiver) => {
    const track = receiver.track;
    if (track) {
      stream.addTrack(track);
    }
    return stream;
  }, new MediaStream());

  return mediaStream;
}
