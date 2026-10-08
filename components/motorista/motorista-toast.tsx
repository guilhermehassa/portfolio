"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createMotoristaToast, type ToastSnapshot } from "@/lib/motorista-toast";

const emptySnapshot = () => null;

export function useMotoristaToast() {
  const [controller] = useState(createMotoristaToast);
  const toast = useSyncExternalStore(controller.subscribe, controller.getSnapshot, emptySnapshot);
  useEffect(() => {
    controller.activate();
    return () => controller.dispose();
  }, [controller]);
  return { toast, setNotice: controller.show };
}

export function MotoristaToast({ toast }: { toast: ToastSnapshot | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    // O popover manual fica na camada superior, inclusive sobre dialog.showModal().
    if (typeof element.showPopover === "function") element.showPopover();
    else element.removeAttribute("popover");
    return () => {
      if (typeof element.hidePopover === "function" && element.matches(":popover-open")) element.hidePopover();
    };
  }, [toast?.id]);
  return toast ? <div key={toast.id} ref={ref} popover="manual"
    role={toast.error ? "alert" : "status"} aria-atomic="true"
    className={`motorista-toast motorista-alert${toast.error ? " error" : ""}${toast.closing ? " is-closing" : ""}`}>
    {toast.message}
  </div> : null;
}
