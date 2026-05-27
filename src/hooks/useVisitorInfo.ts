import { useEffect, useState } from "react";

export interface VisitorInfo {
  ip: string;
  city?: string;
  region?: string;
  country?: string;
  isp?: string;
  lat?: number;
  lon?: number;
  risk: number;
  proxy: "yes" | "no";
  type?: string;
}

interface State {
  data: VisitorInfo | null;
  loading: boolean;
  error: boolean;
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(tid);
  }
}

async function fetchIpInfo(): Promise<Partial<VisitorInfo>> {
  try {
    const response = await fetchWithTimeout("https://ipapi.co/json/", 5000);
    const json = await response.json();
    if (json && json.ip) {
      return {
        ip: json.ip,
        city: json.city || "",
        region: json.region || "",
        country: json.country_name || "",
        isp: json.org || "",
        lat: typeof json.latitude === "number" ? json.latitude : undefined,
        lon: typeof json.longitude === "number" ? json.longitude : undefined,
      };
    }
  } catch {
    // fallback below
  }

  try {
    const response = await fetchWithTimeout("https://ipwho.is/", 5000);
    const json = await response.json();
    if (json && json.ip) {
      return {
        ip: json.ip,
        city: json.city || "",
        region: json.region || "",
        country: json.country || "",
        isp: json.connection?.org || json.connection?.isp || "",
        lat: typeof json.latitude === "number" ? json.latitude : undefined,
        lon: typeof json.longitude === "number" ? json.longitude : undefined,
      };
    }
  } catch {
    // give up
  }

  return { ip: "UNKNOWN" };
}

async function fetchRisk(ip: string): Promise<{
  risk: number;
  proxy: "yes" | "no";
  type: string;
}> {
  try {
    const response = await fetchWithTimeout(
      `https://proxycheck.io/v2/${ip}?risk=1&vpn=1`,
      4000
    );
    const json = await response.json();
    const info = (json && json[ip]) || {};
    return {
      risk: parseInt(info.risk, 10) || 0,
      proxy: info.proxy === "yes" ? "yes" : "no",
      type: info.type || "",
    };
  } catch {
    return { risk: 0, proxy: "no", type: "" };
  }
}

export function useVisitorInfo(enabled: boolean): State {
  const [state, setState] = useState<State>({
    data: null,
    loading: enabled,
    error: false,
  });

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, loading: false, error: false });
      return;
    }

    let cancelled = false;

    (async () => {
      setState({ data: null, loading: true, error: false });
      try {
        const base = await fetchIpInfo();
        let merged: VisitorInfo = {
          ip: base.ip || "UNKNOWN",
          city: base.city,
          region: base.region,
          country: base.country,
          isp: base.isp,
          lat: base.lat,
          lon: base.lon,
          risk: 0,
          proxy: "no",
          type: "",
        };

        if (merged.ip && merged.ip !== "UNKNOWN") {
          const risk = await fetchRisk(merged.ip);
          merged = { ...merged, ...risk };
        }

        if (!cancelled) {
          setState({ data: merged, loading: false, error: false });
        }
      } catch {
        if (!cancelled) {
          setState({
            data: { ip: "UNKNOWN", risk: 0, proxy: "no", type: "" },
            loading: false,
            error: true,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return state;
}
