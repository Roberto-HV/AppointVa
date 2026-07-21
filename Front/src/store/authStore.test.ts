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
