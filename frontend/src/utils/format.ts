import { theme } from '../styles/theme';

export const getTpoColor = (tpo: string): string => {
  const map: Record<string, string> = {
    '데이트': '#FF6B9D', '직장': '#4A90D9', '캐주얼': '#7EC8A4',
    '운동': '#F5A623', '파티': '#BD10E0', '여행': '#50E3C2',
    '일상': '#9B9B9B', '격식': '#4A4A4A'
  };
  return map[tpo] || theme.colors.primary;
};