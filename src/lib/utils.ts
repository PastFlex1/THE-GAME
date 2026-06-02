import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getEcuadorDate(dateVal: any) {
  if (!dateVal) return '';
  try {
    let d: Date;
    if (typeof dateVal === 'string') d = new Date(dateVal);
    else if (dateVal.seconds) d = new Date(dateVal.seconds * 1000);
    else d = new Date(dateVal);
    const ecDate = new Date(d.getTime() - (5 * 60 * 60 * 1000));
    return ecDate.toISOString().split('T')[0];
  } catch (e) { return ''; }
}
