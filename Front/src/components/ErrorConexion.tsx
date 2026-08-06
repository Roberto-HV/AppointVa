import { WifiOff } from 'lucide-react';

interface Props {
  refetch: () => void;
  mensaje?: string;
}

export default function ErrorConexion({ refetch, mensaje }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-4">
        <WifiOff className="w-7 h-7 text-amber-500 dark:text-amber-400" strokeWidth={1.75} />
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
        Sin conexión
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs">
        {mensaje ?? 'No se pudo cargar la información. Revisa tu conexión.'}
      </p>
      <button
        onClick={refetch}
        className="px-5 py-2.5 bg-[#C8A961] hover:bg-[#b8975a] text-white text-sm font-semibold rounded-xl transition-colors"
      >
        Reintentar
      </button>
    </div>
  );
}
