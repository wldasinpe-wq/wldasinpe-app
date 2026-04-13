'use client';

import type { ExchangeQuote } from '@/lib/exchange/types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type ExchangeRatesContextValue = {
  quote: ExchangeQuote | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

const ExchangeRatesContext = createContext<ExchangeRatesContextValue | null>(
  null
);

export function ExchangeRatesProvider({ children }: { children: ReactNode }) {
  const [quote, setQuote] = useState<ExchangeQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch('/api/exchange-rates', { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as ExchangeQuote;
        if (!cancelled) {
          setQuote(data);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setQuote(null);
          setError('No se pudo cargar la tasa. Intentá de nuevo.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchKey]);

  const value = useMemo(
    () => ({ quote, loading, error, refetch }),
    [quote, loading, error, refetch]
  );

  return (
    <ExchangeRatesContext.Provider value={value}>
      {children}
    </ExchangeRatesContext.Provider>
  );
}

export function useExchangeQuote(): ExchangeRatesContextValue {
  const ctx = useContext(ExchangeRatesContext);
  if (!ctx) {
    throw new Error(
      'useExchangeQuote must be used within ExchangeRatesProvider'
    );
  }
  return ctx;
}
