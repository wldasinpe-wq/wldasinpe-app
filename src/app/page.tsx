import { Page } from '@/components/PageLayout';
import { AuthButton } from '../components/AuthButton';

export default function Home() {
  return (
    <Page>
      <Page.Main className="flex flex-col items-center justify-between min-h-screen px-6 py-12">
        {/* Top Section */}
        <div className="flex flex-col items-center gap-8 max-w-md w-full pt-8">
          {/* Logo/Branding with animation */}
          <div className="flex flex-col items-center gap-4 text-center animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-linear-to-br from-black/80 to-black flex items-center justify-center shadow-lg">
              <span className="text-3xl font-bold text-white">₡</span>
            </div>
            <h1 className="text-5xl font-bold text-gray-900 tracking-tight">
              WLD a SINPE
            </h1>
            <p className="text-base text-gray-600 leading-relaxed max-w-sm">
              Convertí tus Worldcoins a colones y recibí el dinero al instante en tu SINPE Móvil
            </p>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="w-full max-w-md space-y-4 pb-8">
          <AuthButton />
          <p className="text-xs text-center text-gray-500">
            Procesado por Ridivi • Regulado en Costa Rica
          </p>
        </div>
      </Page.Main>
    </Page>
  );
}
