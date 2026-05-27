import { useEffect, useMemo, useState } from "react";
import { useVisitorInfo } from "@/hooks/useVisitorInfo";
import { cn } from "@/utils";

const SESSION_KEY = "purcarte.visitor_alert_shown";

interface VisitorAlertProps {
  enabled: boolean;
  autoDismissMs?: number;
}

function formatLocation(city?: string, region?: string, country?: string) {
  return [city, region, country].filter(Boolean).join(" · ") || "Unknown";
}

function formatNetwork(proxy: "yes" | "no", type?: string) {
  if (proxy === "yes") {
    return type ? `Proxy · ${type}` : "Proxy";
  }
  return "Direct";
}

function getRiskTone(risk: number) {
  if (risk >= 60) return "danger";
  if (risk >= 20) return "warn";
  return "safe";
}

export function VisitorAlert({
  enabled,
  autoDismissMs = 8000,
}: VisitorAlertProps) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setActive(false);
      return;
    }

    try {
      setActive(!sessionStorage.getItem(SESSION_KEY));
    } catch {
      setActive(true);
    }
  }, [enabled]);

  const markShown = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // ignore
    }
  };

  if (!enabled || !active) return null;

  return (
    <VisitorAlertInner
      autoDismissMs={autoDismissMs}
      onDismiss={() => {
        markShown();
        setActive(false);
      }}
    />
  );
}

function VisitorAlertInner({
  autoDismissMs,
  onDismiss,
}: {
  autoDismissMs: number;
  onDismiss: () => void;
}) {
  const { data, loading } = useVisitorInfo(true);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const enterTimer = window.setTimeout(() => setVisible(true), 40);
    return () => window.clearTimeout(enterTimer);
  }, []);

  useEffect(() => {
    if (!visible || closing || paused) return;
    const timer = window.setTimeout(() => {
      setClosing(true);
    }, autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [autoDismissMs, closing, paused, visible]);

  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => {
      onDismiss();
    }, 260);
    return () => window.clearTimeout(timer);
  }, [closing, onDismiss]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setClosing(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const display = useMemo(() => {
    const risk = data?.risk ?? 0;
    return {
      ip: data?.ip || (loading ? "Loading..." : "UNKNOWN"),
      location: loading
        ? "Fetching location..."
        : formatLocation(data?.city, data?.region, data?.country),
      isp: loading ? "Resolving provider..." : data?.isp || "Unavailable",
      network: loading
        ? "Checking network..."
        : formatNetwork(data?.proxy ?? "no", data?.type),
      risk,
      riskTone: getRiskTone(risk),
    };
  }, [data, loading]);

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center md:inset-x-auto md:left-auto md:right-4">
      <div
        className={cn(
          "visitor-alert-card purcarte-blur theme-card-style pointer-events-auto w-full max-w-sm overflow-hidden text-sm text-foreground",
          visible && !closing ? "visitor-alert-enter" : "visitor-alert-idle",
          closing && "visitor-alert-exit"
        )}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}>
        <div className="visitor-alert-shimmer" />
        <div className="relative p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-[0.24em] text-(--theme-text-muted-color) uppercase">
                Visitor
              </p>
              <h3 className="mt-1 text-base font-semibold text-foreground">
                Welcome to PurCarte
              </h3>
            </div>
            <button
              type="button"
              aria-label="Close visitor alert"
              className="visitor-alert-close"
              onClick={() => setClosing(true)}>
              ×
            </button>
          </div>

          <div className="grid gap-2.5">
            <InfoRow label="IP" value={display.ip} delayClass="visitor-alert-row-1" />
            <InfoRow
              label="Location"
              value={display.location}
              delayClass="visitor-alert-row-2"
            />
            <InfoRow
              label="Provider"
              value={display.isp}
              delayClass="visitor-alert-row-3"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 visitor-alert-row-4">
            <span className="visitor-alert-badge">{display.network}</span>
            <span
              className={cn(
                "visitor-alert-badge",
                display.riskTone === "safe" && "visitor-alert-badge-safe",
                display.riskTone === "warn" && "visitor-alert-badge-warn",
                display.riskTone === "danger" && "visitor-alert-badge-danger"
              )}>
              Risk {display.risk}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  delayClass,
}: {
  label: string;
  value: string;
  delayClass?: string;
}) {
  return (
    <div
      className={cn(
        "visitor-alert-row flex items-start justify-between gap-3",
        delayClass
      )}>
      <span className="min-w-18 text-[11px] font-medium tracking-[0.18em] text-(--theme-text-muted-color) uppercase">
        {label}
      </span>
      <span className="break-all text-right text-sm font-medium text-foreground/95">
        {value}
      </span>
    </div>
  );
}
