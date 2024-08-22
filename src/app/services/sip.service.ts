import { Inject, Injectable, Renderer2 } from '@angular/core';
import { BehaviorSubject, Observable, distinctUntilChanged } from 'rxjs';
import { Invitation, Session, SessionState, UserAgent } from 'sip.js';
import {
  ManagedSession as _ManagedSession,
  ManagedSession,
  SessionManager,
  SessionManagerDelegate,
  SessionManagerOptions,
} from 'sip.js/lib/platform/web';
import {
  createMediaStream,
  isSessionDescriptionHandler,
} from '../utils/session.description-handler-helpers';
import { VoipStatus } from '../utils/user-agent-helpers';
import { DOCUMENT } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class SipService extends SessionManager {
  private _status = new BehaviorSubject<VoipStatus>(VoipStatus.INITIAL);
  public status$: Observable<VoipStatus> = this._status.pipe(
    distinctUntilChanged()
  );
  override managedSessions: ManagedSession[] = [];
  private audioElement!: HTMLAudioElement;
  private renderer!: Renderer2;

  constructor(@Inject(DOCUMENT) private document: Document) {
    const server = 'wss://td-pbx1.i-taxi.rs:8089/ws';

    const sessionManagerOptions: SessionManagerOptions = {
      userAgentOptions: {
        uri: UserAgent.makeURI('sip:201@td-pbx1.i-taxi.rs'),
        userAgentString: 'CTS:ERP:haloTaxiRu',
        displayName: '201@haloTaxiRu',
        transportOptions: {
          wsServers: server,
          connectionTimeout: 5,
          traceSip: true,
          traceWs: true,
          autoReconnect: true,
          maxReconnectionAttempts: 10,
          reconnectionTimeout: 4,
          keepAliveInterval: 1,
          keepAliveDebounce: 10,
          log: {
            level: 'debug',
            connector: (
              level: string,
              category: string,
              label: string,
              content: string
            ) => {
              console.log(`${level} | ${category} | ${label} | ${content}`);
            },
          },
        },
        hackViaTcp: true,
        hackIpInContact: true,
        sessionDescriptionHandlerFactoryOptions: {
          constraints: {
            audio: true,
            video: false,
          },
        },

        contactParams: {
          tratransport: 'ws',
        },
        authorizationUsername: '201',
        authorizationPassword: '944130cfedf682e9302cf06ee33cde37',
      },
      delegate: {
        onCallReceived: (session) => this.onIncomingCall(session),
      } as SessionManagerDelegate,
      media: {
        constraints: {
          audio: true,
          video: false,
        },
      },
    };
    super(server, sessionManagerOptions);
    this.initializeUserAgent();
    this.createAudioElement();
  }

  private initializeUserAgent() {
    if (this._status.value > VoipStatus.INITIAL) {
      console.log('[VOIP:UA] User agent exists, aborting init');
      return;
    }
    this._status.next(VoipStatus.INITIALIZING);
    this.createAudioElement();

    this.userAgent.stateChange.addListener(() => {
      if (this.userAgent.state === 'Started') {
        this._status.next(VoipStatus.INITIALIZED);
      }
    });

    this.userAgent.transport.stateChange.addListener(() => {
      switch (this.userAgent.transport.state) {
        case 'Connected':
          this._status.next(VoipStatus.CONNECTED);
          break;
        case 'Disconnected':
          this._status.next(VoipStatus.DISCONNECTED);
          break;
      }
    });

    this.connect().catch((error) => {
      console.error('Failed to connect SIP:', error);
    });
  }

  private createAudioElement(): HTMLAudioElement {
    this.audioElement = new Audio();
    this.audioElement.src = 'assets/ringtone.mp3';
    if (!!this.audioElement) {
      return this.audioElement;
    }

    this.audioElement = this.renderer.createElement('audio');
    this.renderer.appendChild(this.document.body, this.audioElement);

    return this.audioElement;
  }

  public playRingtone(): void {
    if (this.audioElement) {
      this.audioElement.play().catch((error) => {
        console.error('Failed to play ringtone', error);
      });
    }
  }

  public stopRingtone(): void {
    if (this.audioElement) {
      this.audioElement.pause();
    }
  }

  private onTrackAdded(session: Session | Invitation): void {
    const sessionDescriptionHandler = session.sessionDescriptionHandler;

    if (isSessionDescriptionHandler(sessionDescriptionHandler)) {
      const remoteStream = createMediaStream(sessionDescriptionHandler);
      if (remoteStream) {
        this.assignStream(remoteStream, this.audioElement);
      } else {
        console.error('Failed to create media stream');
      }
    } else {
      console.error(
        'Session description handler is not of type Web.SessionDescriptionHandler'
      );
    }
  }

  private assignStream(stream: MediaStream, element: HTMLAudioElement): void {
    element.autoplay = true;
    element.srcObject = stream;

    const play = async (event?: string) => {
      if (!element.paused) {
        console.log('Audio is already playing or paused.');
        return;
      }

      try {
        await element.play();
      } catch (error) {
        console.log('[VOIP:Stream] Failed to play media', event, error);
      }
    };

    play();

    stream.onaddtrack = (): void => {
      element.load();
      play('on add track');
    };

    stream.onremovetrack = (): void => {
      element.load();
      play('on remove track');
    };
  }

  private onIncomingCall(session: Session): void {
    console.log('Incoming call from', session.remoteIdentity.uri.toString());
    this.playRingtone();

    session.stateChange.addListener((newState) => {
      console.log(`Call state changed: ${newState}`);
      if (newState === SessionState.Established) {
        console.log('Call established');
        this.onTrackAdded(session);
      } else if (newState === SessionState.Terminated) {
        console.log('Call terminated');
        this.stopRingtone();
      } else if (
        newState === SessionState.Initial ||
        newState === SessionState.Establishing
      ) {
        console.log('Call is being established');
      } else {
        console.log(`Unexpected state: ${newState}`);
      }
    });
  }

  public start(): void {
    this.register()
      .then(() => {
        this._status.next(VoipStatus.REGISTERED);
      })
      .catch((error) => {
        console.error('Failed to register SIP:', error);
        this._status.next(VoipStatus.DISCONNECTED);
      });
  }

  public async stop(): Promise<void> {
    await this.unregister();
    await this.disconnect();
  }

  public answerCall(index: number): void {
    var s = this.managedSessions[index];
    if (s?.session) {
      try {
        this.answer(s.session);
      } catch (error) {
        console.error('Failed to answer call:', error);
      }
    }
  }

  public declineCall(index: number): void {
    var s = this.managedSessions[index];
    if (s?.session) {
      try {
        this.decline(s.session);
      } catch (error) {
        console.error('Failed to decline call:', error);
      }
    }
  }

  public holdCall(index: number): void {
    var s = this.managedSessions[index];
    if (s?.session) {
      try {
        this.hold(s?.session);
      } catch (error) {
        console.error('Failed to hold call:', error);
      }
    }
  }

  public unholdCall(index: number): void {
    var s = this.managedSessions[index];
    if (s?.session) {
      try {
        this.unhold(s?.session);
      } catch (error) {
        console.error('Failed to unhold call:', error);
      }
    }
  }

  public terminateCall(index: number): void {
    var s = this.managedSessions[index];
    if (s?.session) {
      try {
        this.hangup(s?.session);
      } catch (error) {
        console.error('Failed to terminate call:', error);
      }
    }
  }
}
