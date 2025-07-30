
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { type EventData, type Candidate, type Response, AnswerType } from './types';
import { ANSWER_DETAILS, CREATE_EVENT_TITLE, EVENT_NAME_LABEL, DESCRIPTION_LABEL, CANDIDATES_LABEL, CREATE_EVENT_BUTTON, SUBMIT_RESPONSE_BUTTON, UPDATE_RESPONSE_BUTTON, YOUR_NAME_LABEL } from './constants';
import { Trash2, Users, ThumbsUp, Clipboard, ClipboardCheck, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Clock, CalendarCheck2, X, Pencil, CalendarDays, Link, CheckCircle, Triangle } from 'lucide-react';

// --- Helper Functions ---
const encodeEventData = (data: EventData): string => {
  try {
    const jsonString = JSON.stringify(data);
    return btoa(encodeURIComponent(jsonString));
  } catch (e) {
    console.error("Failed to encode event data:", e);
    return "";
  }
};

const decodeEventData = (encoded: string): EventData | null => {
  try {
    const jsonString = decodeURIComponent(atob(encoded));
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("Failed to decode event data:", e);
    return null;
  }
};

const formatDateRange = (startIso: string, endIso: string, isAllDay?: boolean): { date: string, time: string, startTime: string, endTime: string } => {
    const startDateObj = new Date(startIso);
    const endDateObj = new Date(endIso);
    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
        return { date: '無効な日付', time: '', startTime: '', endTime: ''};
    }
    const date = startDateObj.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' });
    
    if (isAllDay) {
      return { date, time: '(終日)', startTime: '', endTime: '' };
    }

    const startTime = startDateObj.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
    const endTime = endDateObj.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
    return { date, time: `${startTime} - ${endTime}`, startTime, endTime };
};

// --- Sub-Components ---

const Logo: React.FC = () => (
    <div className="flex items-center gap-2">
      <CalendarCheck2 className="w-7 h-7 text-emerald-500" />
      <span className="text-xl font-bold text-gray-800 tracking-tight">調整くん</span>
    </div>
);

const Header: React.FC = () => (
  <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
    <div className="max-w-screen-2xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
      <Logo />
    </div>
  </header>
);

const Footer: React.FC = () => (
  <footer className="bg-transparent mt-16">
    <div className="max-w-screen-2xl mx-auto py-6 px-4 sm:px-6 lg:px-8 text-center text-gray-500 text-sm">
      <p>&copy; {new Date().getFullYear()} 調整くん. All rights reserved.</p>
    </div>
  </footer>
);

type Interaction =
  | { type: 'idle' }
  | { type: 'drawing'; start: Date; current: Date; dayIndex: number }
  | { type: 'moving'; candidate: Candidate; startY: number; startDayIndex: number; startMouseY: number; dragOffsetMinutes: number }
  | { type: 'resizing'; candidate: Candidate; handle: 'top' | 'bottom' };


const WeeklyTimePicker: React.FC<{
  candidates: Candidate[];
  onAddCandidate: (newCandidate: { startDate: Date; endDate: Date; isAllDay?: boolean }) => void;
  onUpdateCandidate: (updatedCandidate: Candidate) => void;
  onRemoveCandidate: (candidateId: string) => void;
  onInteractionEnd: () => void;
}> = ({ candidates, onAddCandidate, onUpdateCandidate, onRemoveCandidate, onInteractionEnd }) => {
    const HOUR_HEIGHT = 72; // 1 hour = 48px
    const SNAP_MINUTES = 15;
    const MIN_DURATION_MINUTES = 30;

    const [viewDate, setViewDate] = useState(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
    });
    const [weekDays, setWeekDays] = useState<Date[]>([]);
    const gridRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [interaction, setInteraction] = useState<Interaction>({ type: 'idle' });

    useEffect(() => {
        const startDay = new Date(viewDate);
        startDay.setHours(0, 0, 0, 0);
        
        const days = Array.from({ length: 7 }).map((_, i) => {
            const day = new Date(startDay);
            day.setDate(startDay.getDate() + i);
            return day;
        });
        setWeekDays(days);
    }, [viewDate]);
    
    useEffect(() => {
        if (scrollContainerRef.current && weekDays.length > 0) {
            // Default scroll to 9 AM
            scrollContainerRef.current.scrollTop = 9 * HOUR_HEIGHT;
        }
    }, [weekDays, HOUR_HEIGHT]);

    const timeToY = (date: Date): number => {
        const minutes = date.getHours() * 60 + date.getMinutes();
        return (minutes / 60) * HOUR_HEIGHT;
    };

    const yAndDayToDate = (y: number, dayIndex: number, snap: boolean = true): Date => {
        const day = weekDays[dayIndex];
        if (!day) return new Date();

        const totalMinutes = (y / HOUR_HEIGHT) * 60;
        const snappedMinutes = snap ? Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES : totalMinutes;
        const hours = Math.min(23, Math.floor(snappedMinutes / 60));
        const minutes = snappedMinutes % 60;

        const newDate = new Date(day);
        newDate.setHours(hours, minutes, 0, 0);
        return newDate;
    };
    
    const handleAllDayToggle = (day: Date) => {
        const existingCandidate = candidates.find(c =>
            c.isAllDay && new Date(c.startDate).toDateString() === day.toDateString()
        );

        if (existingCandidate) {
            onRemoveCandidate(existingCandidate.id);
        } else {
            const startDate = new Date(day);
            startDate.setHours(0, 0, 0, 0);
            
            const endDate = new Date(day);
            endDate.setHours(23, 59, 59, 999);

            onAddCandidate({
                startDate,
                endDate,
                isAllDay: true
            });
        }
        onInteractionEnd();
    };


    const handleInteractionStart = (e: React.MouseEvent, type: 'drawing' | 'move' | 'resize-top' | 'resize-bottom', candidate?: Candidate) => {
        e.preventDefault();
        e.stopPropagation();

        if (!gridRef.current) return;
        const rect = gridRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const dayIndex = Math.floor(x / (rect.width / 7));
        
        if (type === 'drawing') {
            const startDate = yAndDayToDate(y, dayIndex);
            setInteraction({ type: 'drawing', start: startDate, current: startDate, dayIndex });
        } else if (candidate) {
            if (type.startsWith('resize')) {
                setInteraction({ type: 'resizing', candidate, handle: type === 'resize-top' ? 'top' : 'bottom' });
            } else {
                const startDate = new Date(candidate.startDate);
                const clickDate = yAndDayToDate(y, dayIndex, false);
                const dragOffsetMinutes = (clickDate.getHours() * 60 + clickDate.getMinutes()) - (startDate.getHours() * 60 + startDate.getMinutes());
                setInteraction({ type: 'moving', candidate, startY: y, startDayIndex: dayIndex, startMouseY: e.clientY, dragOffsetMinutes });
            }
        }
    };
    
    const handleMouseMove = (e: React.MouseEvent) => {
        if (interaction.type === 'idle' || !gridRef.current) return;
        e.preventDefault();

        const rect = gridRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const x = e.clientX - rect.left;
        
        switch (interaction.type) {
            case 'drawing': {
                const dayIndex = interaction.dayIndex;
                const currentDate = yAndDayToDate(y, dayIndex);
                setInteraction({ ...interaction, current: currentDate });
                break;
            }
            case 'resizing': {
                const candidateDay = new Date(interaction.candidate.startDate);
                candidateDay.setHours(0,0,0,0);
                const dayIndex = weekDays.findIndex(d => d.getTime() === candidateDay.getTime());
                if (dayIndex === -1) break;

                const newDate = yAndDayToDate(y, dayIndex);
                let { startDate, endDate } = { startDate: new Date(interaction.candidate.startDate), endDate: new Date(interaction.candidate.endDate) };

                if (interaction.handle === 'top') {
                    if (endDate.getTime() - newDate.getTime() > MIN_DURATION_MINUTES * 60 * 1000) {
                        startDate = newDate;
                    }
                } else {
                    if (newDate.getTime() - startDate.getTime() > MIN_DURATION_MINUTES * 60 * 1000) {
                        endDate = newDate;
                    }
                }
                onUpdateCandidate({ ...interaction.candidate, startDate: startDate.toISOString(), endDate: endDate.toISOString() });
                break;
            }
            case 'moving': {
                const dayIndex = Math.max(0, Math.min(6, Math.floor(x / (rect.width / 7))));
                const targetTime = yAndDayToDate(y, dayIndex, false);
                targetTime.setMinutes(targetTime.getMinutes() - interaction.dragOffsetMinutes);
                
                const snappedDate = yAndDayToDate(timeToY(targetTime), dayIndex);

                const originalDuration = new Date(interaction.candidate.endDate).getTime() - new Date(interaction.candidate.startDate).getTime();
                const newEndDate = new Date(snappedDate.getTime() + originalDuration);
                onUpdateCandidate({ ...interaction.candidate, startDate: snappedDate.toISOString(), endDate: newEndDate.toISOString() });
                break;
            }
        }
    };

    const handleMouseUp = () => {
        if (interaction.type === 'drawing') {
            const { start, current } = interaction;
            const dragDurationMs = Math.abs(current.getTime() - start.getTime());
            
            let finalStartDate: Date, finalEndDate: Date;
            if (dragDurationMs < 10 * 60 * 1000) {
                finalStartDate = start;
                finalEndDate = new Date(start);
                finalEndDate.setMinutes(start.getMinutes() + 30);
            } else {
                finalStartDate = start < current ? start : current;
                finalEndDate = start > current ? start : current;
            }

            if (finalEndDate.getTime() - finalStartDate.getTime() >= MIN_DURATION_MINUTES * 60 * 1000) {
                onAddCandidate({ startDate: finalStartDate, endDate: finalEndDate });
            }
        }
        
        if(interaction.type !== 'idle') {
            onInteractionEnd();
        }
        setInteraction({ type: 'idle' });
    };

    const renderSelectionBox = () => {
        if (interaction.type !== 'drawing') return null;
        const { start, current, dayIndex } = interaction;
        const startY = timeToY(start);
        const currentY = timeToY(current);
        
        const top = Math.min(startY, currentY);
        const height = Math.abs(startY - currentY);
        if (height < 5) return null;

        return (
            <div
                className="absolute bg-blue-500/20 border-2 border-dashed border-blue-500 rounded-lg z-20 pointer-events-none"
                style={{ top: `${top}px`, height: `${height}px`, left: `${(dayIndex / 7) * 100}%`, width: `${(1 / 7) * 100}%` }}
            />
        );
    };

    const getMonthYearTitle = (days: Date[]): string => {
        if (days.length < 7) return '';
        const displayDate = days[3]; 
        return `${displayDate.getFullYear()}年 ${displayDate.getMonth() + 1}月`;
    };

    const navigateByWeek = (weeks: number) => setViewDate(d => { const n = new Date(d); n.setDate(n.getDate() + 7 * weeks); return n; });
    const navigateByMonth = (months: number) => setViewDate(d => { const n = new Date(d); n.setMonth(n.getMonth() + months); return n; });

    const today = new Date();
    today.setHours(0,0,0,0);

    return (
        <div className="bg-white border border-gray-200 rounded-xl select-none p-4 sm:p-6" onMouseLeave={handleMouseUp}>
            <div className="max-w-screen-2xl mx-auto">
                {/* Navigation */}
                <div className="flex items-center mb-4">
                    <div className="w-16 flex-shrink-0" /> {/* Left Spacer */}
                    <div className="flex-1 flex items-center justify-between relative">
                        {/* Left Buttons */}
                        <div className="flex items-center gap-1">
                            <button type="button" onClick={() => { const today = new Date(); today.setHours(0,0,0,0); setViewDate(today);}} className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-100 transition">今日</button>
                            <button type="button" onClick={() => navigateByMonth(-1)} className="p-2 rounded-full hover:bg-gray-100" aria-label="前の月"><ChevronsLeft size={20} className="text-gray-500" /></button>
                            <button type="button" onClick={() => navigateByWeek(-1)} className="p-2 rounded-full hover:bg-gray-100" aria-label="前の週"><ChevronLeft size={20} className="text-gray-500" /></button>
                        </div>
                        
                        {/* Centered Title */}
                        <h3 className="absolute left-1/2 -translate-x-1/2 text-lg font-bold text-gray-800 whitespace-nowrap">{getMonthYearTitle(weekDays)}</h3>

                        {/* Right Buttons */}
                        <div className="flex items-center gap-1">
                            <button type="button" onClick={() => navigateByWeek(1)} className="p-2 rounded-full hover:bg-gray-100" aria-label="次の週"><ChevronRight size={20} className="text-gray-500" /></button>
                            <button type="button" onClick={() => navigateByMonth(1)} className="p-2 rounded-full hover:bg-gray-100" aria-label="次の月"><ChevronsRight size={20} className="text-gray-500" /></button>
                        </div>
                    </div>
                    <div className="w-16 flex-shrink-0" /> {/* Right Spacer */}
                </div>
                {/* Date Header */}
                <div className="flex pr-[15px]">
                    <div className="w-16 flex-shrink-0 pr-8" /> {/* Left Spacer */}
                    <div className="flex-1 grid grid-cols-7 text-center">
                        {weekDays.map(day => {
                            const isToday = day.getTime() === today.getTime();
                            const isSelectedAsAllDay = candidates.some(c =>
                                c.isAllDay && new Date(c.startDate).toDateString() === day.toDateString()
                            );
                            return (
                                <button
                                    type="button"
                                    key={day.toISOString()}
                                    onClick={() => handleAllDayToggle(day)}
                                    className={`py-2 rounded-lg transition-colors ${
                                        isSelectedAsAllDay
                                            ? 'bg-blue-200 ring-2 ring-blue-500'
                                            : isToday ? 'bg-emerald-100' : 'hover:bg-gray-100'
                                    }`}
                                >
                                    <span className={`text-sm ${isToday ? 'text-emerald-700' : 'text-gray-500'}`}>{day.toLocaleDateString('ja-JP', { weekday: 'short' })}</span>
                                    <h4 className={`mt-1 text-xl font-bold ${isToday ? 'text-emerald-700' : 'text-gray-700'}`}>{day.getDate()}</h4>
                                </button>
                            );
                        })}
                    </div>
                    <div className="w-16 flex-shrink-0" /> {/* Right Spacer */}
                </div>
            </div>

            {/* Scrollable Timeline Container */}
            <div
                ref={scrollContainerRef}
                className="overflow-y-scroll relative custom-scrollbar max-w-screen-2xl mx-auto"
                style={{ height: `${12 * HOUR_HEIGHT}px` }} // 12 hours visible (e.g., 9am to 9pm)
            >
                {/* Timeline */}
                <div className="flex overflow-hidden pt-2" style={{ height: `${HOUR_HEIGHT * 24}px` }}>
                    <div className="relative z-30 w-16 flex-shrink-0 text-right pr-8">
                        {Array.from({ length: 24 }).map((_, hour) => (
                            <div key={hour} className="relative" style={{ height: `${HOUR_HEIGHT}px` }}>
                                <span className="text-xs text-gray-400 absolute -top-2">{hour > 0 ? `${hour}:00` : ''}</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex-1 relative z-0" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
                        <div ref={gridRef} className="absolute inset-0 grid grid-cols-7" onMouseDown={(e) => handleInteractionStart(e, 'drawing')}>
                            {Array.from({ length: 7 }).map((_, i) => (
                                <div key={i} className="h-full border-l border-gray-100 hover:bg-gray-50 transition-colors">
                                    {Array.from({ length: 24 }).map((_, j) => (
                                        <div key={j} style={{ height: `${HOUR_HEIGHT}px` }} className="border-t border-gray-100" />
                                    ))}
                                </div>
                            ))}
                        </div>
                        
                        {candidates.filter(c => !c.isAllDay).map(candidate => {
                            const startDate = new Date(candidate.startDate);
                            const endDate = new Date(candidate.endDate);
                            if (!weekDays.length) return null;
                            
                            const candidateDay = new Date(startDate);
                            candidateDay.setHours(0,0,0,0);
                            const dayIndex = weekDays.findIndex(d => d.getTime() === candidateDay.getTime());

                            if(dayIndex === -1) return null;

                            const top = timeToY(startDate);
                            const height = timeToY(endDate) - top;

                            return (
                                <div
                                    key={candidate.id}
                                    onMouseDown={(e) => handleInteractionStart(e, 'move', candidate)}
                                    className="group absolute bg-blue-500/30 border border-blue-500 rounded-lg p-1 z-10 overflow-hidden cursor-move transition-colors"
                                    style={{ top: `${top}px`, height: `${Math.max(height, 10)}px`, left: `calc(${(dayIndex / 7) * 100}% + 2px)`, width: `calc(${(1 / 7) * 100}% - 4px)` }}>
                                    <div className="text-xs font-bold text-blue-800 select-none pointer-events-none h-full flex items-center justify-center">
                                        <div className="flex items-center gap-1 whitespace-nowrap">
                                            <span>{formatDateRange(candidate.startDate, candidate.endDate).startTime}</span>
                                            <span>-</span>
                                            <span>{formatDateRange(candidate.startDate, candidate.endDate).endTime}</span>
                                        </div>
                                    </div>
                                    <div className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize" onMouseDown={(e) => handleInteractionStart(e, 'resize-top', candidate)} />
                                    <div className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize" onMouseDown={(e) => handleInteractionStart(e, 'resize-bottom', candidate)} />
                                    <button type="button" onClick={(e) => { e.stopPropagation(); onRemoveCandidate(candidate.id); }} className="absolute top-0.5 right-0.5 p-0.5 bg-blue-500 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all z-20">
                                        <X size={10} />
                                    </button>
                                </div>
                            );
                        })}
                        {renderSelectionBox()}
                    </div>
                    <div className="w-16 flex-shrink-0" /> {/* Right Spacer */}
                </div>
            </div>
        </div>
    );
};

const WelcomeGuide: React.FC = () => (
    <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200/80 text-center h-full flex flex-col justify-center">
        <div className="mx-auto mb-6">
            <svg width="120" height="120" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 7V3M16 7V3M7 11H17M5 21H19C20.1046 21 21 20.1046 21 19V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7V19C3 20.1046 3.89543 21 5 21Z" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10.5 15.5L12 17L14.5 14" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        </div>
        <h3 className="text-2xl font-bold text-gray-800 mb-4">カンタン3ステップで日程調整！</h3>
        <ul className="space-y-4 text-left mx-auto">
            <li className="flex items-center gap-3">
                <Pencil className="w-6 h-6 text-emerald-500"/>
                <div><span className="font-bold">Step 1:</span> イベント名を入力しよう</div>
            </li>
            <li className="flex items-center gap-3">
                <CalendarDays className="w-6 h-6 text-emerald-500"/>
                <div><span className="font-bold">Step 2:</span> カレンダーをドラッグして候補日を選ぼう</div>
            </li>
            <li className="flex items-center gap-3">
                <Link className="w-6 h-6 text-emerald-500"/>
                <div><span className="font-bold">Step 3:</span> 作成ボタンを押してURLを共有！</div>
            </li>
        </ul>
    </div>
);

const SelectedCandidatesPanel: React.FC<{
    candidates: Candidate[];
    onRemoveCandidate: (id: string) => void;
}> = ({ candidates, onRemoveCandidate }) => {
    return (
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-200/80 h-full">
            <div className="flex items-center gap-3 mb-4">
                 <CheckCircle className="w-7 h-7 text-emerald-500" />
                 <h3 className="text-xl font-bold text-gray-800">選択中の候補日時 ({candidates.length})</h3>
            </div>
            <div className="flex flex-wrap gap-3">
                {candidates.map(c => {
                    const { date, time } = formatDateRange(c.startDate, c.endDate, c.isAllDay);
                    return (
                        <div key={c.id} className="bg-emerald-100 text-emerald-800 text-sm font-semibold px-3 py-2 rounded-full flex items-center gap-2 transition-all animate-in fade-in">
                            <span>{date} {time}</span>
                            <button onClick={() => onRemoveCandidate(c.id)} className="bg-emerald-200 hover:bg-red-200 hover:text-red-700 text-emerald-600 rounded-full p-0.5 transition-colors">
                                <X size={14} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const CreateEventPage: React.FC = () => {
  const navigate = useNavigate();
  const [eventName, setEventName] = useState('');
  const [description, setDescription] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  const handleAddCandidate = useCallback((newSelection: { startDate: Date; endDate: Date; isAllDay?: boolean }) => {
    setCandidates(prev => {
        if (prev.length >= 20) {
            alert('候補日時は20個まで設定できます。');
            return prev;
        }
        const newCandidate: Candidate = {
            id: crypto.randomUUID(),
            startDate: newSelection.startDate.toISOString(),
            endDate: newSelection.endDate.toISOString(),
            isAllDay: newSelection.isAllDay || false,
        };
        const newCandidates = [...prev, newCandidate];
        newCandidates.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        return newCandidates;
    });
  }, []);

  const handleUpdateCandidate = useCallback((updatedCandidate: Candidate) => {
      setCandidates(prev => prev.map(c => c.id === updatedCandidate.id ? updatedCandidate : c));
  }, []);

  const handleInteractionEnd = useCallback(() => {
    setCandidates(prev => {
        const sorted = [...prev];
        sorted.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        return sorted;
    });
  }, []);

  const handleRemoveCandidate = useCallback((candidateIdToRemove: string) => {
    setCandidates(prev => prev.filter(c => c.id !== candidateIdToRemove));
  }, []);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName.trim() || candidates.length === 0) {
      alert('イベント名と少なくとも1つの候補日時を選択してください。');
      return;
    }

    const eventData: EventData = {
      eventName,
      description,
      candidates,
      responses: [],
    };

    const encodedData = encodeEventData(eventData);
    if (encodedData) {
      navigate(`/event/${encodedData}`);
    } else {
      alert('イベントの作成に失敗しました。');
    }
  };

  return (
    <div className="max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-[65%] w-full">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">{CREATE_EVENT_TITLE}</h2>
            <form onSubmit={handleSubmit} className="space-y-10">
              <div className="space-y-8">
                <div>
                  <label htmlFor="event-name" className="block text-lg font-bold text-gray-800 mb-2">{EVENT_NAME_LABEL} <span className="text-red-500">*</span></label>
                  <input
                    type="text" id="event-name" value={eventName} onChange={(e) => setEventName(e.target.value)} required maxLength={100}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition shadow-sm text-base"
                    placeholder="例：新年会、プロジェクトミーティング"
                  />
                </div>
                <div>
                  <label htmlFor="description" className="block text-lg font-bold text-gray-800 mb-2">{DESCRIPTION_LABEL}</label>
                  <textarea
                    id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={500}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition shadow-sm text-base"
                    placeholder="お店のURLや補足事項など"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-lg font-bold text-gray-800 mb-2">{CANDIDATES_LABEL} <span className="text-red-500">*</span></label>
                <p className="text-sm text-gray-600 mb-4">下のカレンダーでドラッグして時間を選択するか、クリックして30分の枠を作成します。</p>
                <WeeklyTimePicker
                    candidates={candidates} onAddCandidate={handleAddCandidate} onUpdateCandidate={handleUpdateCandidate}
                    onRemoveCandidate={handleRemoveCandidate} onInteractionEnd={handleInteractionEnd}
                />
              </div>

              <div className="text-center">
                <button type="submit" className="w-full sm:w-auto inline-flex justify-center items-center px-14 py-4 border border-transparent text-lg font-bold rounded-full shadow-lg text-white cta-gradient hover:shadow-xl hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-all disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed disabled:transform-none" disabled={!eventName || candidates.length === 0}>
                  {CREATE_EVENT_BUTTON}
                </button>
              </div>
            </form>
        </div>

        <div className="lg:w-[35%] w-full lg:sticky top-24 self-start">
            {candidates.length === 0 ? (
                <WelcomeGuide />
            ) : (
                <SelectedCandidatesPanel candidates={candidates} onRemoveCandidate={handleRemoveCandidate} />
            )}
        </div>
      </div>
    </div>
  );
};


const EventPage: React.FC = () => {
    const { data } = useParams<{ data: string }>();
    const navigate = useNavigate();
    const [event, setEvent] = useState<EventData | null>(null);
    const [participantName, setParticipantName] = useState('');
    const [comment, setComment] = useState('');
    const [currentAnswers, setCurrentAnswers] = useState<Record<string, AnswerType>>({});
    const [isUpdating, setIsUpdating] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (data) {
            const decodedData = decodeEventData(data);
            if (decodedData) {
                setEvent(decodedData);
                const initialAnswers: Record<string, AnswerType> = {};
                decodedData.candidates.forEach(c => {
                    initialAnswers[c.id] = AnswerType.MAYBE;
                });
                setCurrentAnswers(initialAnswers);
            } else { navigate('/'); }
        }
    }, [data, navigate]);
    
    useEffect(() => {
        if (participantName && event) {
            const existingResponse = event.responses.find(r => r.participantName === participantName);
            if (existingResponse) {
                const fullAnswers: Record<string, AnswerType> = {};
                 event.candidates.forEach(c => {
                    fullAnswers[c.id] = existingResponse.answers[c.id] || AnswerType.MAYBE;
                });
                setCurrentAnswers(fullAnswers);
                setComment(existingResponse.comment || '');
                setIsUpdating(true);
            } else {
                const initialAnswers: Record<string, AnswerType> = {};
                event.candidates.forEach(c => { initialAnswers[c.id] = AnswerType.MAYBE; });
                setCurrentAnswers(initialAnswers);
                setComment('');
                setIsUpdating(false);
            }
        }
    }, [participantName, event]);
    
    const handleCopyUrl = () => {
        navigator.clipboard.writeText(window.location.href).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleAnswerChange = (candidateId: string, answer: AnswerType) => {
        setCurrentAnswers(prev => ({ ...prev, [candidateId]: answer }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!participantName.trim()) { alert('名前を入力してください。'); return; }
        if (!event) return;

        const newResponse: Response = { 
            participantName: participantName.trim(), 
            answers: currentAnswers,
            comment: comment.trim(),
        };
        let newResponses: Response[];

        if (isUpdating || event.responses.some(r => r.participantName === participantName.trim())) {
            newResponses = event.responses.map(r => r.participantName === participantName.trim() ? newResponse : r);
        } else {
            newResponses = [...event.responses, newResponse];
        }
        
        const updatedEventData = { ...event, responses: newResponses };
        const encodedData = encodeEventData(updatedEventData);
        navigate(`/event/${encodedData}`, { replace: true });
        setEvent(updatedEventData);
    };

    const summary = useMemo(() => {
        if (!event) return { totals: {}, bestCandidates: [] };

        const totals: Record<string, Record<AnswerType, number>> = {};
        event.candidates.forEach(c => {
            totals[c.id] = { [AnswerType.ATTEND]: 0, [AnswerType.MAYBE]: 0, [AnswerType.DECLINE]: 0 };
        });

        event.responses.forEach(res => {
            Object.entries(res.answers).forEach(([id, ans]) => {
                if (totals[id]?.[ans as AnswerType] !== undefined) {
                    totals[id][ans as AnswerType]++;
                }
            });
        });

        let bestCandidates: string[] = [];
        if (event.candidates.length > 0) {
            const candidatesWithScores = event.candidates.map(c => ({
                id: c.id,
                attendCount: totals[c.id]?.[AnswerType.ATTEND] ?? 0,
                maybeCount: totals[c.id]?.[AnswerType.MAYBE] ?? 0,
            }));

            // Sort candidates: primary by attend (desc), secondary by maybe (desc)
            candidatesWithScores.sort((a, b) => {
                if (b.attendCount !== a.attendCount) {
                    return b.attendCount - a.attendCount;
                }
                return b.maybeCount - a.maybeCount;
            });
            
            const topCandidate = candidatesWithScores[0];

            // Highlight only if the top candidate has at least one "ATTEND" vote.
            if (topCandidate && topCandidate.attendCount > 0) {
                bestCandidates = candidatesWithScores
                    .filter(c => c.attendCount === topCandidate.attendCount && c.maybeCount === topCandidate.maybeCount)
                    .map(c => c.id);
            }
        }
        
        return { totals, bestCandidates };
    }, [event]);

    if (!event) return <div className="text-center py-20">読み込み中...</div>;

    const formatCandidateRowDate = (candidate: Candidate) => {
        const startDate = new Date(candidate.startDate);
        const endDate = new Date(candidate.endDate);
        const month = startDate.getMonth() + 1;
        const day = startDate.getDate();
        const weekday = ['日', '月', '火', '水', '木', '金', '土'][startDate.getDay()];
        
        if (candidate.isAllDay) {
            return `${month}/${day}(${weekday}) 終日`;
        }

        const startTime = startDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
        const endTime = endDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
        return `${month}/${day}(${weekday}) ${startTime}~${endTime}`;
    }
    
    const getAnswerIcon = (answer: AnswerType) => {
        if (answer === AnswerType.ATTEND) {
            return <div className="mx-auto w-6 h-6 rounded-full border-[5px] border-emerald-500" />;
        }
        if (answer === AnswerType.MAYBE) {
            return (
                <svg className="w-6 h-6 mx-auto text-emerald-200 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2L1 21h22L12 2z" />
                </svg>
            );
        }
        if (answer === AnswerType.DECLINE) {
            return <X size={24} className="mx-auto text-gray-300 stroke-[4]" />;
        }
        return null;
    };

    return (
        <div className="max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-200/80">
                <h2 className="text-3xl font-bold text-gray-900">{event.eventName}</h2>
                {event.description && <p className="mt-4 text-gray-700 whitespace-pre-wrap">{event.description}</p>}
                <div className="mt-6 flex items-center gap-4 flex-wrap">
                     <button onClick={handleCopyUrl} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors">
                         {copied ? <ClipboardCheck size={20} className="text-emerald-500" /> : <Clipboard size={20} />}
                         {copied ? 'URLをコピーしました!' : 'URLをコピーして共有'}
                     </button>
                    <button
                        onClick={() => navigate('/')}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <ChevronLeft size={16} />
                        イベント作成画面に戻る
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-200/80 overflow-hidden">
                <div className="overflow-x-auto relative">
                    <table className="min-w-full text-sm text-center">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="sticky left-0 z-20 bg-gray-100 px-4 py-3 font-semibold text-gray-700 w-48 text-left">日程</th>
                                {Object.values(ANSWER_DETAILS).map(detail => (
                                    <th key={detail.label} className="px-4 py-3 font-semibold text-gray-700 w-16">
                                        <span className={`text-lg`}>{detail.icon}</span>
                                    </th>
                                ))}
                                {event.responses.map(res => (
                                    <th key={res.participantName} className="px-4 py-3 font-semibold text-amber-800 w-28 whitespace-nowrap">
                                        {res.participantName}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {event.candidates.length === 0 && (
                                <tr><td colSpan={4 + event.responses.length} className="px-6 py-12 text-center text-gray-500">候補日時がありません。</td></tr>
                            )}
                            {event.candidates.map(candidate => {
                                const isBest = summary.bestCandidates.includes(candidate.id);
                                return (
                                    <tr key={candidate.id} className={isBest ? 'bg-emerald-50' : ''}>
                                        <td className={`sticky left-0 z-10 px-4 py-3 font-semibold text-gray-800 whitespace-nowrap text-left ${isBest ? 'bg-emerald-50' : 'bg-white'}`}>
                                            {formatCandidateRowDate(candidate)}
                                        </td>
                                        {Object.keys(ANSWER_DETAILS).map(answerType => (
                                           <td key={answerType} className="px-4 py-3 text-gray-600">
                                               {summary.totals[candidate.id]?.[answerType as AnswerType] || 0}人
                                           </td>
                                        ))}
                                        {event.responses.map(response => {
                                            const answer = response.answers[candidate.id] || AnswerType.MAYBE;
                                            return (
                                                <td key={response.participantName} className="px-4 py-3">
                                                    {getAnswerIcon(answer)}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                            <tr className="bg-gray-50 border-t-2">
                                <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 font-semibold text-gray-700 text-left align-top">
                                    コメント
                                </th>
                                <td colSpan={3}></td>
                                {event.responses.map(res => (
                                    <td key={res.participantName} className="px-4 py-3 text-center text-xs text-gray-700 align-top whitespace-pre-wrap">
                                        {res.comment}
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-200/80">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">{isUpdating ? '回答を編集する' : '出欠を入力する'}</h3>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="participant-name" className="block text-base font-bold text-gray-800 mb-2">{YOUR_NAME_LABEL}</label>
                        <input
                            type="text" id="participant-name" value={participantName} onChange={(e) => setParticipantName(e.target.value)}
                            required maxLength={50}
                            className="w-full bg-white sm:max-w-xs px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
                            placeholder="例：山田 太郎"
                        />
                    </div>
                    <div className="overflow-x-auto -mb-2">
                        <div className="flex space-x-6 pb-2 min-w-max">
                        {event.candidates.map(c => {
                            const { date, time } = formatDateRange(c.startDate, c.endDate, c.isAllDay);
                            return (
                                <div key={c.id} className="flex-shrink-0 w-48">
                                    <div className="font-semibold text-center text-gray-700">{date}</div>
                                    <div className="font-bold text-base text-center text-gray-900 mb-3">{time}</div>
                                    <fieldset className="mt-2 space-y-2">
                                        <legend className="sr-only">回答 for {date} {time}</legend>
                                        {(Object.keys(ANSWER_DETAILS) as AnswerType[]).map(answerType => (
                                            <label key={answerType} className={`flex items-center gap-3 cursor-pointer p-3 rounded-lg border transition-all ${currentAnswers[c.id] === answerType ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/50' : 'border-gray-300 hover:bg-gray-100'}`}>
                                                <input
                                                    type="radio" name={`answer-${c.id}`} value={answerType} checked={currentAnswers[c.id] === answerType}
                                                    onChange={() => handleAnswerChange(c.id, answerType)} className="sr-only"
                                                />
                                                <span className={`text-xl font-medium ${ANSWER_DETAILS[answerType].symbolColor}`}>{ANSWER_DETAILS[answerType].icon}</span>
                                                <span className={`text-base font-medium ${currentAnswers[c.id] === answerType ? 'text-gray-800' : 'text-gray-700'}`}>{ANSWER_DETAILS[answerType].label}</span>
                                            </label>
                                        ))}
                                    </fieldset>
                                </div>
                            );
                        })}
                        </div>
                    </div>

                    <div>
                      <label htmlFor="participant-comment" className="block text-base font-bold text-gray-800 mb-2">コメント (任意)</label>
                      <textarea
                        id="participant-comment"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={3}
                        maxLength={500}
                        className="w-full bg-white px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
                        placeholder="遅れて参加します、など"
                      />
                    </div>

                    <div className="text-center pt-4">
                         <button type="submit" className="w-full sm:w-auto inline-flex justify-center items-center px-10 py-3 border border-transparent text-base font-bold rounded-full shadow-md text-white bg-emerald-500 hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed" disabled={!participantName.trim()}>
                           {isUpdating ? UPDATE_RESPONSE_BUTTON : SUBMIT_RESPONSE_BUTTON}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

function App() {
  return (
    <>
      <style>{`
        /* ブラウザによるオートフィル時の背景色を無効化 */
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px white inset !important; /* 背景を白で塗りつぶす */
          -webkit-text-fill-color: #1f2937 !important; /* テキストの色を濃いグレーに指定 (tailwindのtext-gray-800相当) */
          transition: background-color 5000s ease-in-out 0s; /* 色が変わるアニメーションを遅延させて無効化 */
        }
      `}</style>
      <div className="min-h-screen bg-gray-50 text-gray-800" style={{lineHeight: 1.7}}>
        <Header />
        <main>
          <HashRouter>
            <Routes>
              <Route path="/" element={<CreateEventPage />} />
              <Route path="/event/:data" element={<EventPage />} />
            </Routes>
          </HashRouter>
        </main>
        <Footer />
      </div>
    </>
  );
}

export default App;
