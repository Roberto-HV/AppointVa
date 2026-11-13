import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAuthStore } from "./authStore";
import { queryClient } from "../lib/queryClient";

vi.mock("../lib/queryClient", () => ({
  queryClient: { clear: vi.fn() },
}));

const usuarioMock = {
  id: "usr-1",
  email: "test@example.com",
  nombreCompleto: "Test User",
  rol: "admin",
  negocioId: "neg-1",
  fotoUrl: null as string | null,
};

beforeEach(() => {
  useAuthStore.setState({ token: null, refreshToken: null, usuario: null });
  localStorage.clear();
  vi.clearAllMocks();
});

describe("useAuthStore — estado inicial", () => {
  it("token es null", () => {
    expect(useAuthStore.getState().token).toBeNull();
  });

  it("refreshToken es null", () => {
    expect(useAuthStore.getState().refreshToken).toBeNull();
  });

  it("usuario es null", () => {
    expect(useAuthStore.getState().usuario).toBeNull();
  });

  it("estaAutenticado devuelve false", () => {
    expect(useAuthStore.getState().estaAutenticado()).toBe(false);
  });
});

describe("useAuthStore — iniciarSesion", () => {
  it("establece token, refreshToken y usuario", () => {
    useAuthStore.getState().iniciarSesion("tok-123", "refresh-abc", usuarioMock);

    const state = useAuthStore.getState();
    expect(state.token).toBe("tok-123");
    expect(state.refreshToken).toBe("refresh-abc");
    expect(state.usuario).toEqual(usuarioMock);
  });

  it("estaAutenticado devuelve true tras iniciar sesión", () => {
    useAuthStore.getState().iniciarSesion("tok-123", "refresh-abc", usuarioMock);
    expect(useAuthStore.getState().estaAutenticado()).toBe(true);
  });

  it("sobreescribe una sesión anterior", () => {
    useAuthStore.getState().iniciarSesion("tok-old", "refresh-old", usuarioMock);
    const nuevoUsuario = { ...usuarioMock, id: "usr-2", email: "otro@example.com" };
    useAuthStore.getState().iniciarSesion("tok-new", "refresh-new", nuevoUsuario);

    const state = useAuthStore.getState();
    expect(state.token).toBe("tok-new");
    expect(state.usuario?.email).toBe("otro@example.com");
  });
});

// El aviso de confirmación lleva el teléfono y los datos de la clienta, y su
// botón abre WhatsApp sin consultar al servidor. Vive fuera del árbol de rutas,
// así que sobrevive a un cambio de sesión que no recarga la página.
describe("useAuthStore — los avisos no cruzan de una sesión a otra", () => {
  async function conUnAviso() {
    const { useToastStore } = await import("./toastStore");
    useToastStore.getState().toast("Cita confirmada", "exito", {
      accion: { etiqueta: "Avisar por WhatsApp", onClick: vi.fn() },
    });
    expect(useToastStore.getState().toasts).toHaveLength(1);
    return useToastStore;
  }

  // El servidor manda el MISMO id del dueño y solo cambia el rol a Kiosco, así
  // que comparar cuentas no alcanza: hay que mirar también el rol.
  const kioscoMock = { ...usuarioMock, rol: "Kiosco" };

  it("entrar a modo recepción los descarta: la pantalla queda a la vista de cualquiera", async () => {
    useAuthStore.getState().iniciarSesion("tok-123", "refresh-abc", usuarioMock);
    const useToastStore = await conUnAviso();

    useAuthStore.getState().iniciarSesionKiosco("tok-kiosco", kioscoMock);

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("entrar a recepción desde otra pestaña también los descarta", async () => {
    useAuthStore.getState().iniciarSesion("tok-123", "refresh-abc", usuarioMock);
    const useToastStore = await conUnAviso();

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "appointva-auth",
        storageArea: localStorage,
        newValue: JSON.stringify({ state: { token: "tok-kiosco", usuario: kioscoMock } }),
      }),
    );

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("una renovación de token en otra pestaña NO los descarta", async () => {
    useAuthStore.getState().iniciarSesion("tok-123", "refresh-abc", usuarioMock);
    const useToastStore = await conUnAviso();

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "appointva-auth",
        storageArea: localStorage,
        newValue: JSON.stringify({ state: { token: "tok-renovado", usuario: usuarioMock } }),
      }),
    );

    expect(useToastStore.getState().toasts).toHaveLength(1);
    useToastStore.setState({ toasts: [] });
  });

  it("entrar con otra cuenta los descarta: no hereda nada de quien usó el equipo antes", async () => {
    // Con sesión previa de otra persona, que es el caso real: dos empleadas que
    // se turnan el mismo equipo.
    useAuthStore.getState().iniciarSesion("tok-123", "refresh-abc", usuarioMock);
    const useToastStore = await conUnAviso();

    useAuthStore
      .getState()
      .iniciarSesion("tok-456", "refresh-def", { ...usuarioMock, id: "usr-2", email: "otra@test.com" });

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("renovar el token NO los descarta: es la misma persona a media tarea", async () => {
    // El interceptor llama a iniciarSesion en cada 401, y confirmar una cita
    // dispara refetches justo mientras el aviso está en pantalla: borrarlo ahí
    // le quitaría de las manos el único mensaje que esa clienta iba a recibir.
    useAuthStore.getState().iniciarSesion("tok-viejo", "refresh-viejo", usuarioMock);
    const useToastStore = await conUnAviso();

    useAuthStore.getState().iniciarSesion("tok-nuevo", "refresh-nuevo", usuarioMock);

    expect(useToastStore.getState().toasts).toHaveLength(1);
    useToastStore.setState({ toasts: [] });
  });
});

describe("useAuthStore — cerrarSesion", () => {
  beforeEach(() => {
    useAuthStore.getState().iniciarSesion("tok-123", "refresh-abc", usuarioMock);
  });

  it("limpia token, refreshToken y usuario", () => {
    useAuthStore.getState().cerrarSesion();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.usuario).toBeNull();
  });

  it("estaAutenticado devuelve false tras cerrar sesión", () => {
    useAuthStore.getState().cerrarSesion();
    expect(useAuthStore.getState().estaAutenticado()).toBe(false);
  });

  it("llama a queryClient.clear()", () => {
    useAuthStore.getState().cerrarSesion();
    expect(queryClient.clear).toHaveBeenCalledOnce();
  });

  it("cierra los avisos: el de confirmación lleva datos de la clienta y se abre sin servidor", async () => {
    // Los avisos viven fuera del árbol de rutas y se verían en la pantalla de
    // login. En una tablet compartida, el siguiente en entrar podría tocarlos.
    const { useToastStore } = await import("./toastStore");
    const abrir = vi.fn();
    useToastStore.getState().toast("Cita confirmada", "exito", {
      accion: { etiqueta: "Avisar por WhatsApp", onClick: abrir },
    });
    expect(useToastStore.getState().toasts).toHaveLength(1);

    useAuthStore.getState().cerrarSesion();

    expect(useToastStore.getState().toasts).toHaveLength(0);
    expect(abrir).not.toHaveBeenCalled();
  });

  it("borra solo la caché `images` del service worker", () => {
    const borrar = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("caches", { delete: borrar });

    useAuthStore.getState().cerrarSesion();

    // Vaciar todo Cache Storage se llevaría el precaché y rompería el offline.
    expect(borrar).toHaveBeenCalledExactlyOnceWith("images");
    vi.unstubAllGlobals();
  });

  it("no lanza cuando Cache Storage no está disponible", () => {
    vi.stubGlobal("caches", {
      delete: () => {
        throw new Error("no disponible en navegación privada");
      },
    });

    expect(() => useAuthStore.getState().cerrarSesion()).not.toThrow();
    expect(useAuthStore.getState().token).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe("useAuthStore — actualizarFoto", () => {
  it("actualiza fotoUrl en el usuario existente", () => {
    useAuthStore.getState().iniciarSesion("tok-123", "refresh-abc", usuarioMock);
    useAuthStore.getState().actualizarFoto("https://cdn.example.com/avatar.jpg");

    expect(useAuthStore.getState().usuario?.fotoUrl).toBe(
      "https://cdn.example.com/avatar.jpg"
    );
  });

  it("conserva los demás campos del usuario", () => {
    useAuthStore.getState().iniciarSesion("tok-123", "refresh-abc", usuarioMock);
    useAuthStore.getState().actualizarFoto("https://cdn.example.com/avatar.jpg");

    const u = useAuthStore.getState().usuario!;
    expect(u.id).toBe(usuarioMock.id);
    expect(u.email).toBe(usuarioMock.email);
    expect(u.nombreCompleto).toBe(usuarioMock.nombreCompleto);
    expect(u.rol).toBe(usuarioMock.rol);
    expect(u.negocioId).toBe(usuarioMock.negocioId);
  });

  it("no lanza cuando usuario es null", () => {
    expect(() =>
      useAuthStore.getState().actualizarFoto("https://cdn.example.com/avatar.jpg")
    ).not.toThrow();
    expect(useAuthStore.getState().usuario).toBeNull();
  });
});

describe("useAuthStore — sesión de kiosco compartida entre pestañas (B9)", () => {
  const usuarioKiosco = { ...usuarioMock, rol: "Kiosco" };
  const guardarEnOtraPestana = (token: string | null, usuario: typeof usuarioMock | null) =>
    localStorage.setItem("appointva-auth", JSON.stringify({
      state: { token, refreshToken: null, usuario }, version: 0,
    }));
  const leerGuardado = () => JSON.parse(localStorage.getItem("appointva-auth") ?? "null")?.state;

  it("un refresh fallido en otra pestaña no borra la sesión de kiosco guardada", async () => {
    // Esta pestaña sigue con la sesión vieja del dueño; otra entró en modo recepción.
    useAuthStore.setState({ token: "tok-dueno", refreshToken: "refresh-revocado", usuario: usuarioMock });
    guardarEnOtraPestana("tok-kiosco", usuarioKiosco);

    useAuthStore.getState().cerrarSesion({ porRefreshFallido: true });
    await Promise.resolve();

    expect(leerGuardado()).toMatchObject({ token: "tok-kiosco", usuario: { rol: "Kiosco" } });
    expect(useAuthStore.getState().token).toBe("tok-kiosco");
    expect(useAuthStore.getState().refreshToken).toBeNull();
    expect(queryClient.clear).toHaveBeenCalledOnce();
  });

  it("un logout explícito cierra la sesión aunque otra pestaña guarde un kiosco", async () => {
    useAuthStore.setState({ token: "tok-dueno", refreshToken: "refresh-abc", usuario: usuarioMock });
    guardarEnOtraPestana("tok-kiosco", usuarioKiosco);

    useAuthStore.getState().cerrarSesion();
    await Promise.resolve();

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().usuario).toBeNull();
    expect(leerGuardado()).toMatchObject({ token: null, usuario: null });
  });

  it("la propia sesión de kiosco sí se cierra (token vencido)", () => {
    useAuthStore.getState().iniciarSesionKiosco("tok-kiosco", usuarioKiosco);

    useAuthStore.getState().cerrarSesion({ porRefreshFallido: true });

    expect(useAuthStore.getState().token).toBeNull();
    expect(leerGuardado()).toMatchObject({ token: null, usuario: null });
  });

  it("se actualiza cuando otra pestaña cambia la sesión guardada", async () => {
    useAuthStore.setState({ token: "tok-dueno", refreshToken: "refresh-abc", usuario: usuarioMock });
    guardarEnOtraPestana("tok-kiosco", usuarioKiosco);

    window.dispatchEvent(new StorageEvent("storage", { key: "appointva-auth", storageArea: localStorage }));
    await Promise.resolve();

    expect(useAuthStore.getState().token).toBe("tok-kiosco");
    expect(useAuthStore.getState().usuario?.rol).toBe("Kiosco");
    expect(useAuthStore.getState().refreshToken).toBeNull();
  });

  it("ignora cambios de otras claves", async () => {
    useAuthStore.setState({ token: "tok-dueno", refreshToken: "refresh-abc", usuario: usuarioMock });
    guardarEnOtraPestana("tok-kiosco", usuarioKiosco);

    window.dispatchEvent(new StorageEvent("storage", { key: "otra-clave", storageArea: localStorage }));
    await Promise.resolve();

    expect(useAuthStore.getState().token).toBe("tok-dueno");
  });
});
