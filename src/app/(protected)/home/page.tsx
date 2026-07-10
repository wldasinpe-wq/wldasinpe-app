import { auth } from '@/auth';
import { Page } from '@/components/PageLayout';
import { WithdrawCompletionNotice } from '@/components/WithdrawCompletionNotice';
import { WldBalanceInline, WldBalancePill } from '@/components/WldBalanceDisplay';
import { HomeWithdrawCta } from '@/components/HomeWithdrawCta';
import { TopBar } from '@worldcoin/mini-apps-ui-kit-react';
import { Suspense } from 'react';
import { formatCurrency } from '@/constants/exchange';
import { getExchangeQuote } from '@/lib/exchange/get-quote';

export default async function Home() {
  await auth();
  const quote = await getExchangeQuote();

  return (
    <>
      <Page.Header className="p-0">
        <TopBar endAdornment={<WldBalancePill />} />
      </Page.Header>
      <Page.Main className="flex flex-col items-center justify-center gap-8 px-6 py-12">
        <Suspense fallback={null}>
          <WithdrawCompletionNotice />
        </Suspense>

        {/* Hero Section */}
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Retirá tus WLD
          </h1>
          <p className="text-sm text-gray-600 leading-relaxed">
            Convertí tus Worldcoins a colones costarricenses y recibí el dinero en tu cuenta SINPE Móvil
          </p>
        </div>

        {/* Exchange Rate Info */}
        <div className="w-full max-w-md border border-gray-300 p-6" style={{ background: 'var(--white-ridivi)' }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-gray-900">Tasa de cambio actual</span>
            <span className="text-xs font-medium text-green-700 bg-green-50 px-3 py-1 border border-green-200 rounded-full flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              EN VIVO
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-900 font-semibold text-lg">1 WLD</span>
            <span className="text-gray-900 font-bold text-2xl">
              {formatCurrency.CRC(quote.wldToCrc)}
            </span>
          </div>
        </div>

        {/* CTA */}
        <div className="flex w-full max-w-md flex-col items-center gap-3">
          <WldBalanceInline />
          <HomeWithdrawCta />
        </div>

        {/* Info */}
        <div className="text-center text-xs text-gray-500 max-w-md space-y-1 border-t border-gray-200 pt-6">
          <p>Comisión fija: {formatCurrency.CRC(quote.flatFeeCrc)} por transacción</p>
          <p>Monto mínimo: 0.1 WLD</p>
        </div>
      </Page.Main>
    </>
  );
}
