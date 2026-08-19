import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificacionesApi, type NotificacionDto } from '../../api/notificaciones';

function tiempoRelativo(fechaIso: string): string {
  const utcStr = fechaIso.endsWith('Z') ? fechaIso : fechaIso + 'Z';
  const diff = Date.now() - new Date(utcStr).getTime();
  const minutos = Math.floor(diff / 60_000);
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  return new Date(utcStr).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

export function NotificacionesBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: notificaciones = [], isError: notifError } = useQuery<NotificacionDto[]>({
    queryKey: ['notificaciones'],
    queryFn: notificacionesApi.listar,
    refetchInterval: 30_000,
  });

  const marcarLeidas = useMutation({
    mutationFn: notificacionesApi.marcarLeidas,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notificaciones'] }),
  });

  const [eliminando, setEliminando] = useState<string | null>(null);

  const eliminar = useMutation({
    mutationFn: notificacionesApi.eliminar,
    onSuccess: () => {
      setEliminando(null);
      qc.invalidateQueries({ queryKey: ['notificaciones'] });
    },
    onError: () => setEliminando(null),
  });

  const noLeidas = notificaciones.filter(n => !n.leida).length;

  function handleOpen() {
    setOpen(true);
    if (noLeidas > 0) marcarLeidas.mutate();
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors"
        aria-label="Notificaciones"
      >
        <Bell className={`w-5 h-5 ${notifError ? 'text-amber-500' : ''}`} />
        {noLeidas > 0 && !notifError && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
        {notifError && (
          <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-amber-400" title="No se pudieron cargar las notificaciones" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Notificaciones
            </span>
          </div>

          {notificaciones.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              Sin notificaciones
            </div>
          ) : (
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-700">
              {notificaciones.map(n => (
                <li
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 ${n.citaId ? 'cursor-pointer' : ''}`}
                  onClick={() => {
                    if (n.citaId) {
                      setOpen(false);
                      navigate(`/dashboard/citas/${n.citaId}`);
                    }
                  }}
                >
                  <span className="mt-0.5 text-base">
                    {n.tipo === 'NuevaCita' ? '🗓' : '❌'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {n.titulo}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {n.descripcion}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {tiempoRelativo(n.fechaCreacion)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (eliminando === n.id) return;
                      setEliminando(n.id);
                      eliminar.mutate(n.id);
                    }}
                    disabled={eliminando === n.id}
                    className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-slate-300 hover:text-slate-600 hover:bg-slate-100 dark:text-slate-600 dark:hover:text-slate-300 dark:hover:bg-slate-700 disabled:opacity-40 transition"
                    aria-label="Eliminar notificación"
                  >
                    <X size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
