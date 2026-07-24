import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { downloadBlob } from "../app/formatters";
import {
  createCustomTheme,
  getThemeFilename,
  loadCustomThemes,
  normalizeCustomThemes,
  normalizeTheme,
  parseThemeFile,
  saveCustomThemes,
  serializeTheme,
} from "../services/themeStorage";
import { defaultTheme, isBuiltInTheme, themes as builtInThemes } from "../themes/themes";
import type { Theme } from "../types";

const selectedThemeStorageKey = "wechat-publisher-theme-id";

function loadSelectedThemeId() {
  try {
    return window.localStorage.getItem(selectedThemeStorageKey) || defaultTheme.id;
  } catch {
    return defaultTheme.id;
  }
}

function loadThemeLibrary() {
  try {
    return loadCustomThemes(window.localStorage);
  } catch {
    return [];
  }
}

export function useThemeLibrary(onError: (message: string) => void) {
  const [customThemes, setCustomThemes] = useState<Theme[]>(loadThemeLibrary);
  const [themeId, setThemeId] = useState(loadSelectedThemeId);
  const [themeMessage, setThemeMessage] = useState("");
  const themes = useMemo(() => [...builtInThemes, ...customThemes], [customThemes]);
  const theme = themes.find((item) => item.id === themeId) ?? defaultTheme;
  const isCustomTheme = !isBuiltInTheme(theme.id);

  useEffect(() => {
    try {
      saveCustomThemes(window.localStorage, customThemes);
    } catch (error) {
      onError(
        error instanceof DOMException && error.name === "QuotaExceededError"
          ? "自定义主题保存失败：浏览器本地存储空间不足。"
          : "自定义主题保存失败：无法写入浏览器本地存储。",
      );
    }
  }, [customThemes, onError]);

  useEffect(() => {
    try {
      window.localStorage.setItem(selectedThemeStorageKey, themeId);
    } catch {
      onError("当前主题选择无法保存到浏览器，下次打开时可能恢复为默认主题。");
    }
  }, [themeId, onError]);

  function showMessage(message: string) {
    setThemeMessage(message);
    window.setTimeout(() => setThemeMessage(""), 2400);
  }

  function createThemeDraft() {
    return createCustomTheme(theme);
  }

  function editThemeDraft() {
    return isCustomTheme ? { ...theme } : createCustomTheme(theme);
  }

  function saveTheme(themeDraft: Theme) {
    const normalized = normalizeTheme(themeDraft, theme);
    const customTheme = normalized.id.startsWith("custom-") ? normalized : createCustomTheme(normalized);
    setCustomThemes((items) => {
      const exists = items.some((item) => item.id === customTheme.id);
      const next = exists ? items.map((item) => (item.id === customTheme.id ? customTheme : item)) : [...items, customTheme];
      return next.slice(-50);
    });
    setThemeId(customTheme.id);
    showMessage("自定义主题已保存");
  }

  function deleteCurrentTheme() {
    if (!isCustomTheme) return;
    setCustomThemes((items) => items.filter((item) => item.id !== theme.id));
    setThemeId(defaultTheme.id);
    showMessage("自定义主题已删除");
  }

  function exportCurrentTheme() {
    downloadBlob(new Blob([serializeTheme(theme)], { type: "application/json;charset=utf-8" }), getThemeFilename(theme));
    showMessage("主题文件已导出");
  }

  async function importTheme(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    onError("");
    try {
      if (file.size > 256 * 1024) throw new Error("主题文件不能超过 256 KB");
      const imported = parseThemeFile(await file.text());
      setCustomThemes((items) => [...items, imported].slice(-50));
      setThemeId(imported.id);
      showMessage(`已导入主题“${imported.name}”`);
    } catch (error) {
      onError(error instanceof Error ? `主题导入失败：${error.message}` : "主题导入失败");
    }
  }

  function replaceCustomThemes(value: Theme[]) {
    const normalized = normalizeCustomThemes(value);
    setCustomThemes(normalized);
  }

  return {
    theme,
    themeId,
    setThemeId,
    themes,
    customThemes,
    isCustomTheme,
    themeMessage,
    createThemeDraft,
    editThemeDraft,
    saveTheme,
    deleteCurrentTheme,
    exportCurrentTheme,
    importTheme,
    replaceCustomThemes,
  };
}
