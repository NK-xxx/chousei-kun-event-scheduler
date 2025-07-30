
import { AnswerType } from './types';

export const ANSWER_DETAILS: Record<AnswerType, { label: string; icon: string; color: string; bgColor: string; symbolColor: string; radioColor: string }> = {
  [AnswerType.ATTEND]: {
    label: '参加',
    icon: '○',
    color: 'bg-emerald-500',
    bgColor: 'bg-emerald-50',
    symbolColor: 'text-emerald-600',
    radioColor: 'text-emerald-600'
  },
  [AnswerType.MAYBE]: {
    label: '未定',
    icon: '△',
    color: 'bg-amber-500',
    bgColor: 'bg-amber-50',
    symbolColor: 'text-amber-500',
    radioColor: 'text-amber-600'
  },
  [AnswerType.DECLINE]: {
    label: '不参加',
    icon: '×',
    color: 'bg-rose-500',
    bgColor: 'bg-rose-50',
    symbolColor: 'text-rose-500',
    radioColor: 'text-rose-600'
  },
};

export const APP_TITLE = "調整くん";
export const CREATE_EVENT_TITLE = "新しいイベントを作成";
export const EVENT_NAME_LABEL = "イベント名";
export const DESCRIPTION_LABEL = "イベント詳細 (任意)";
export const CANDIDATES_LABEL = "候補日時";
export const ADD_CANDIDATE_BUTTON = "日時を追加";
export const CREATE_EVENT_BUTTON = "イベントを作成してURLを共有";
export const SUBMIT_RESPONSE_BUTTON = "回答を送信";
export const UPDATE_RESPONSE_BUTTON = "回答を更新";
export const YOUR_NAME_LABEL = "あなたの名前";