import {
  CommunicationChannel,
  CommunicationMessageType,
  SendMessagePayload,
  SendMessageResult,
  FeishuGroup,
} from './communication.types';

export interface ICommunicationProvider {
  channel: CommunicationChannel;
  sendMessage(payload: SendMessagePayload): Promise<SendMessageResult>;
  syncChats?(): Promise<FeishuGroup[]>;
}

export interface ICommunicationService {
  send(payload: SendMessagePayload): Promise<SendMessageResult>;
  getGroups(channel?: CommunicationChannel): Promise<FeishuGroup[]>;
  syncGroups(channel?: CommunicationChannel): Promise<FeishuGroup[]>;
}
