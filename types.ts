export enum AnswerType {
  ATTEND = 'ATTEND',
  MAYBE = 'MAYBE',
  DECLINE = 'DECLINE',
}

export interface Candidate {
  id: string; // Using startDate as a unique key for now
  startDate: string;
  endDate: string;
  isAllDay?: boolean;
}

export interface Response {
  participantName: string;
  answers: Record<string, AnswerType>; // Map from candidate.id to AnswerType
  comment?: string;
}

export interface EventData {
  eventName: string;
  description: string;
  candidates: Candidate[];
  responses: Response[];
}