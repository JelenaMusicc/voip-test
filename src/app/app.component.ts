import { Component, OnInit } from '@angular/core';
import { Inviter, Invitation, Session } from 'sip.js';
import { SipService } from './services/sip.service';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faPhone,
  faPhoneSlash,
  faPause,
} from '@fortawesome/free-solid-svg-icons';
import { VoipStatus } from './utils/user-agent-helpers';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  faPhone = faPhone;
  faPhoneSlash = faPhoneSlash;
  faPause = faPause;

  isIncomingCall: boolean = false;

  public status$ = this.sipService.status$;
  public readonly VoipStatus = VoipStatus;
  protected managedSessions = this.sipService.managedSessions;
  constructor(private sipService: SipService) {}

  start() {
    this.sipService.start();
  }
  onAnswerCall(index: number) {
    this.sipService.answerCall(index);
    this.isIncomingCall = false;
  }

  onHoldCall(index: number) {
    this.sipService.holdCall(index);
  }

  onTerminateCall(index: number) {
    this.sipService.terminateCall(index);
    this.isIncomingCall = false;
  }
}
