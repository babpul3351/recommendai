import dayjs from 'dayjs';

export const pad = (n: number): string => String(n).padStart(2, '0');

export const toDateStr = (d: string | Date): string => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`;
};

export const formatDate = (d: string | Date, WEEKDAYS: string[]): string => {
  const dt = new Date(d);
  return `${dt.getMonth()+1}월 ${dt.getDate()}일 (${WEEKDAYS[dt.getDay()]})`;
};

export const formatTime = (datetime: string | Date): string => {
  const d = new Date(datetime);
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
};

export const getDday = (datetime: string | Date): string => {
  const diff = dayjs(datetime).startOf('day').diff(dayjs().startOf('day'), 'day');
  if (diff === 0) return 'D-Day';
  if (diff > 0)   return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
};