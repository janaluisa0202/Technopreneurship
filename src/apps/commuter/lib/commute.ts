import type { QueueLevel } from '../types';

export const peso = (value: number,locale='en-PH'): string => new Intl.NumberFormat(locale,{style:'currency',currency:'PHP',minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
export const queueName = (level: QueueLevel): string => level === 'high' ? 'HIGH' : level === 'mid' ? 'MODERATE' : 'LOW';
export const queueEstimate = (level: QueueLevel): string => level === 'high' ? 'Long queue reported' : level === 'mid' ? 'Some waiting reported' : 'Light crowd reported';
export const queueProgress = (level: QueueLevel): number => level === 'high' ? 89 : level === 'mid' ? 58 : 27;
