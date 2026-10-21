import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, CalendarDays, XCircle } from 'lucide-react';
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
  const botonRef = useRef<HTMLButtonElement>(null);

  function handleOpen() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (noLeidas > 0) marcarLeidas.mutate();
  }

  // Panel tipo disclosure: se cierra al tocar o enfocar fuera, y con Escape
  // (el foco vuelve a la campana). Antes solo escuchaba `mousedown`.
  useEffect(() => {
    if (!open) return;
    const fuera = (t: EventTarget | null) => !!containerRef.current && !containerRef.current.contains(t as Node);
    const onPointer = (e: PointerEvent) => { if (fuera(e.target)) setOpen(false); };
    const onFocus = (e: FocusEvent) => { if (fuera(e.target)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      botonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const abrirCita = (citaId: string) => {
    setOpen(false);
    navigate(`/dashboard/citas/${citaId}`);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={botonRef}
        onClick={handleOpen}
        aria-expanded={open}
        aria-controls="panel-notificaciones"
        className="relative inline-flex items-center justify-center w-11 h-11 lg:w-9 lg:h-9 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={
          notifError ? 'Notificaciones, no se pudieron cargar'
          : noLeidas > 0 ? `Notificaciones, ${noLeidas} sin leer`
          : 'Notificaciones'
        }
      >
        <Bell className={`w-5 h-5 ${notifError ? 'text-amber-600 dark:text-amber-400' : ''}`} aria-hidden="true" />
        {noLeidas > 0 && !notifError && (
          <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 px-0.5 items-center justify-center rounded-full bg-red-700 text-[10px] font-bold text-white" aria-hidden="true">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
        {notifError && (
          <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div
          id="panel-notificaciones"
          role="region"
          aria-label="Notificaciones"
          className="absolute right-0 top-12 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800"
        >
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Notificaciones
            </span>
          </div>

          {notifError && notificaciones.length === 0 ? (
            <div className="py-8 text-center text-sm text-red-700 dark:text-red-400" role="alert">
              No se pudieron cargar las notificaciones.
            </div>
          ) : notificaciones.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Sin notificaciones
            </div>
          ) : (
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-700">
              {notificaciones.map(n => {
                const Icono = n.tipo === 'NuevaCita' ? CalendarDays : XCircle;
                const contenido = (
                  <>
                    <Icono size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{n.titulo}</span>
                      <span className="block truncate text-xs text-muted-foreground">{n.descripcion}</span>
                      <span className="block text-xs text-muted-foreground">{tiempoRelativo(n.fechaCreacion)}</span>
                    </span>
                  </>
                );
                return (
                  <li key={n.id} className="flex items-start gap-1 pr-2 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    {/* Con cita: botón que abre el detalle (antes era un <li> con onClick, sin foco). */}
                    {n.citaId ? (
                      <button
                        type="button"
                        onClick={() => abrirCita(n.citaId!)}
                        className="flex flex-1 min-w-0 items-start gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      >
                        {contenido}
                      </button>
                    ) : (
                      <div className="flex flex-1 min-w-0 items-start gap-3 px-4 py-3">{contenido}</div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (eliminando === n.id) return;
                        setEliminando(n.id);
                        eliminar.mutate(n.id);
                      }}
                      disabled={eliminando === n.id}
                      className="mt-1 shrink-0 w-11 h-11 lg:w-9 lg:h-9 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Eliminar notificación: ${n.titulo}`}
                    >
                      <X size={15} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
