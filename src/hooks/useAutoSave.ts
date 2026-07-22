import { useEffect, useRef } from "react";

type UseAutoSaveOptions = {
  activeId: string;
  title: string;
  markdown: string;
  isDirty: boolean;
  hasUnsavedChanges: boolean;
  onSave: () => void;
  onSaving: () => void;
};

export function useAutoSave({ activeId, title, markdown, isDirty, hasUnsavedChanges, onSave, onSaving }: UseAutoSaveOptions) {
  const timerRef = useRef<number | null>(null);
  const saveRef = useRef(onSave);
  const savingRef = useRef(onSaving);

  useEffect(() => {
    saveRef.current = onSave;
    savingRef.current = onSaving;
  }, [onSave, onSaving]);

  function cancelAutoSave() {
    if (!timerRef.current) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  useEffect(() => {
    if (!activeId || !isDirty) return;
    savingRef.current();
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      saveRef.current();
    }, 900);
    return cancelAutoSave;
  }, [activeId, title, markdown, isDirty]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedChanges]);

  return { cancelAutoSave };
}
