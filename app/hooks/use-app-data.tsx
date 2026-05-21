"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { AppData, defaultAppData, mergeAppData } from "../../lib/app-data";

type AppDataKey = keyof AppData;

type AppDataContextValue = {
  data: AppData;
  loading: boolean;
  error: string | null;
  hasLoaded: boolean;
  refreshData: () => Promise<void>;
  updateSection: <K extends AppDataKey>(key: K, value: AppData[K]) => void;
  updateData: (updater: (current: AppData) => AppData) => void;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);
const publicRoutes = ["/", "/login", "/auth/callback"];
const saveDelay = 600;

function serialize(value: unknown) {
  return JSON.stringify(value);
}

function normalizeTheme(theme: string) {
  if (theme === "Yorug") {
    return "light";
  }

  if (theme === "Tizim") {
    return "system";
  }

  return "dark";
}

function applyTheme(theme: string) {
  const normalized = normalizeTheme(theme);
  const systemTheme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  const resolvedTheme = normalized === "system" ? systemTheme : normalized;

  localStorage.setItem("private-theme", normalized);
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.style.colorScheme = resolvedTheme;
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState<AppData>(defaultAppData);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dataRef = useRef(defaultAppData);
  const hasLoadedRef = useRef(false);
  const pathnameRef = useRef(pathname);
  const loadPromiseRef = useRef<Promise<void> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInFlightRef = useRef(false);
  const lastSavedDataRef = useRef(serialize(defaultAppData));
  const queuedSaveRef = useRef<AppData | null>(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    hasLoadedRef.current = hasLoaded;
  }, [hasLoaded]);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    applyTheme(data.settings.theme);
  }, [data.settings.theme, hasLoaded]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");

    function handleSystemThemeChange() {
      if (normalizeTheme(dataRef.current.settings.theme) === "system") {
        applyTheme("Tizim");
      }
    }

    media.addEventListener("change", handleSystemThemeChange);
    return () => {
      media.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const getToken = useCallback(async () => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("[app-data] getSession failed", sessionError);
      setError("Sessiyani tekshirishda xatolik yuz berdi.");
    }

    if (!session?.access_token) {
      if (!publicRoutes.includes(pathnameRef.current)) {
        router.replace("/login");
      }
      return null;
    }

    return session.access_token;
  }, [router]);

  const loadData = useCallback(async ({ force = false } = {}) => {
    if (hasLoadedRef.current && !force) {
      return;
    }

    if (loadPromiseRef.current && !force) {
      return loadPromiseRef.current;
    }

    let alive = true;

    const request = (async () => {
      setLoading(!hasLoadedRef.current);
      setError(null);

      const token = await getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/app-data", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        if (!alive) {
          return;
        }

        if (!response.ok) {
          console.error("[app-data] load failed", {
            status: response.status,
            body: await response.text(),
          });
          setError("Ma'lumotlarni yuklashda xatolik yuz berdi.");
          return;
        }

        const payload = (await response.json()) as Partial<AppData>;
        const merged = mergeAppData(payload);
        dataRef.current = merged;
        lastSavedDataRef.current = serialize(merged);
        hasLoadedRef.current = true;
        setData(merged);
        setHasLoaded(true);
      } catch (loadError) {
        console.error("[app-data] load exception", loadError);
        setError("Ma'lumotlarni yuklashda xatolik yuz berdi.");
      } finally {
        setLoading(false);
      }
    })();

    loadPromiseRef.current = request.finally(() => {
      loadPromiseRef.current = null;
      alive = false;
    });

    return loadPromiseRef.current;
  }, [getToken]);

  useEffect(() => {
    if (publicRoutes.includes(pathname)) {
      return;
    }

    loadData();
  }, [loadData, pathname]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        dataRef.current = defaultAppData;
        lastSavedDataRef.current = serialize(defaultAppData);
        queuedSaveRef.current = null;
        saveInFlightRef.current = false;
        hasLoadedRef.current = false;
        setData(defaultAppData);
        setHasLoaded(false);
        setLoading(false);
        setError(null);
        return;
      }

      if (event === "SIGNED_IN" && !hasLoadedRef.current) {
        loadData({ force: true });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadData]);

  const saveDataNow = useCallback(
    async (nextData: AppData) => {
      if (saveInFlightRef.current) {
        queuedSaveRef.current = nextData;
        return;
      }

      saveInFlightRef.current = true;
      setError(null);

      try {
        let pendingData: AppData | null = nextData;

        while (pendingData) {
          const dataToSave = pendingData;
          pendingData = null;
          queuedSaveRef.current = null;

          const nextSerialized = serialize(dataToSave);

          if (nextSerialized !== lastSavedDataRef.current) {
            const token = await getToken();

            if (!token) {
              break;
            }

            const response = await fetch("/api/app-data", {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: nextSerialized,
            });

            if (!response.ok) {
              console.error("[app-data] save failed", {
                status: response.status,
                body: await response.text(),
              });
              setError("Ma'lumotlarni saqlashda xatolik yuz berdi.");
            } else {
              lastSavedDataRef.current = nextSerialized;
            }
          }

          pendingData = queuedSaveRef.current;
        }
      } catch (saveError) {
        console.error("[app-data] save exception", saveError);
        setError("Ma'lumotlarni saqlashda xatolik yuz berdi.");
      } finally {
        saveInFlightRef.current = false;
      }
    },
    [getToken],
  );

  const scheduleSave = useCallback(
    (nextData: AppData) => {
      const nextSerialized = serialize(nextData);

      if (nextSerialized === lastSavedDataRef.current) {
        return;
      }

      dataRef.current = nextData;

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        saveDataNow(dataRef.current);
      }, saveDelay);
    },
    [saveDataNow],
  );

  const updateSection = useCallback(
    <K extends AppDataKey>(key: K, value: AppData[K]) => {
      setData((current) => {
        if (serialize(current[key]) === serialize(value)) {
          return current;
        }

        const next = { ...current, [key]: value };
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );

  const updateData = useCallback(
    (updater: (current: AppData) => AppData) => {
      setData((current) => {
        const next = updater(current);

        if (serialize(current) === serialize(next)) {
          return current;
        }

        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );

  const value = useMemo<AppDataContextValue>(() => ({
    data,
    loading,
    error,
    hasLoaded,
    refreshData: () => loadData({ force: true }),
    updateSection,
    updateData,
  }), [data, error, hasLoaded, loadData, loading, updateData, updateSection]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);

  if (!context) {
    throw new Error("useAppData must be used inside AppDataProvider");
  }

  return context;
}
