import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTheme } from "./useTheme";

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({ matches }),
  });
}

describe("useTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    mockMatchMedia(false);
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("defaults to light when no stored preference and system is light", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("defaults to dark when system prefers dark and no stored preference", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("reads dark preference from localStorage on init", () => {
    localStorage.setItem("appointva-theme", "dark");
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("localStorage light overrides system dark preference", () => {
    localStorage.setItem("appointva-theme", "light");
    mockMatchMedia(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("toggle switches from light to dark, adds class and persists", () => {
    const { result } = renderHook(() => useTheme());
    act(() => { result.current.toggle(); });
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("appointva-theme")).toBe("dark");
  });

  it("toggle switches from dark to light, removes class and persists", () => {
    localStorage.setItem("appointva-theme", "dark");
    const { result } = renderHook(() => useTheme());
    act(() => { result.current.toggle(); });
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("appointva-theme")).toBe("light");
  });
});
