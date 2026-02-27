import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format currency
export const formatRupiah = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatNumber = (amount: number): string => {
  return new Intl.NumberFormat('id-ID').format(amount);
};

export const formatCurrency = formatRupiah;

// Compact format currency (e.g. 1.5 Jt)
export const formatCompactRupiah = (amount: number): string => {
  if (amount >= 1_000_000_000) {
    return `Rp ${(amount / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}M`;
  }
  if (amount >= 1_000_000) {
    return `Rp ${(amount / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}Jt`;
  }
  if (amount >= 1_000) {
    return `Rp ${(amount / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 0 })}rb`;
  }
  return formatRupiah(amount);
};

// Compact format for numbers (e.g. 1.5k)
export const formatCompactNumber = (amount: number): string => {
  if (amount >= 1_000_000) {
    return (amount / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + 'M';
  }
  if (amount >= 1_000) {
    return (amount / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + 'k';
  }
  return amount.toString();
};

// Format date
export const formatTanggal = (date: Date | string | undefined): string => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date as string);
  if (isNaN(d.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
};

export const formatWaktu = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
};

// Format quantity to Karton (1 Karton = 800 Pcs)
export const formatKarton = (pcs: number): string => {
  const amount = pcs / 800;
  return amount.toLocaleString('id-ID', { 
    maximumFractionDigits: 1,
    minimumFractionDigits: 0 
  }) + 'k';
};

/**
 * Removes "PT.", "CV.", "UD.", etc. prefixes from company name
 */
export const cleanCompanyName = (name: string = ''): string => {
  if (!name) return '';
  return name.replace(/^(PT\.|CV\.|PT|CV|UD\.|UD)\s+/i, '').trim();
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export const toCamelCase = (obj: unknown): any => {
  if (Array.isArray(obj)) {
    return obj.map(v => toCamelCase(v));
  } else if (obj !== null && typeof obj === 'object' && obj.constructor === Object) {
    const constTyped = obj as Record<string, unknown>;
    return Object.keys(constTyped).reduce(
      (result, key) => ({
        ...result,
        [key.replace(/_([a-z])/g, (g) => g[1].toUpperCase())]: toCamelCase(constTyped[key]),
      }),
      {},
    );
  }
  return obj;
};

export const toSnakeCase = (obj: unknown): any => {
  if (Array.isArray(obj)) {
    return obj.map(v => toSnakeCase(v));
  } else if (obj !== null && typeof obj === 'object' && obj.constructor === Object) {
    const constTyped = obj as Record<string, unknown>;
    return Object.keys(constTyped).reduce(
      (result, key) => ({
        ...result,
        [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)]: toSnakeCase(constTyped[key]),
      }),
      {},
    );
  }
  return obj;
};
