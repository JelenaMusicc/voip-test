import { Subject } from 'rxjs';
import { Registerer, RegistererState, TransportState, UserAgent } from 'sip.js';

export enum VoipStatus {
  INITIAL,
  INITIALIZING,
  INITIALIZED,
  REGISTERED,
  UNREGISTERED,
  CONNECTING,
  CONNECTED,
  DISCONNECTING,
  DISCONNECTED,
  DISABLED,
}

export function userAgentEventsToStatus(
  userAgent: UserAgent,
  subject: Subject<VoipStatus>,
  registerer: Registerer,
): void {
  //const registerer = new Registerer(userAgent)
  
  registerer.stateChange.addListener((state) => {
    switch (state) {
      case RegistererState.Registered:
        subject.next(VoipStatus.REGISTERED);
        break;
      case RegistererState.Unregistered:
        subject.next(VoipStatus.UNREGISTERED);
        break;
      case RegistererState.Terminated:
        subject.next(VoipStatus.UNREGISTERED);
        break;
      default:
        break;
    }
  });

  userAgent.transport.stateChange.addListener((state) => {
    switch (state) {
      case TransportState.Connecting:
        subject.next(VoipStatus.CONNECTING);
        break;
      case TransportState.Connected:
        subject.next(VoipStatus.CONNECTED);
        break;
      case TransportState.Disconnecting:
        subject.next(VoipStatus.DISCONNECTING);
        break;
      case TransportState.Disconnected:
        subject.next(VoipStatus.DISCONNECTED);
        break;
      default:
        break;
    }
  });
}
