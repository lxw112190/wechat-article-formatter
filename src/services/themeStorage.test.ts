import { describe, expect, it } from "vitest";
import { themes } from "../themes/themes";
import { normalizeCustomThemes, normalizeTheme, parseThemeFile, serializeTheme, themeFileFormat, themeFileVersion } from "./themeStorage";

describe("custom theme files", () => {
  it("round-trips every visual setting while assigning a safe local id", () => {
    const source = {
      ...themes[1],
      id: "custom-source",
      name: "团队墨蓝",
      headings: {
        ...themes[1].headings,
        h2: { ...themes[1].headings.h2, decoration: "pill" as const },
      },
      tableStyle: "minimal" as const,
      bodyFontSize: 18,
    };
    const content = serializeTheme(source, new Date("2026-07-24T00:00:00.000Z"));
    const payload = JSON.parse(content);
    expect(payload.format).toBe(themeFileFormat);
    expect(payload.version).toBe(themeFileVersion);

    const restored = parseThemeFile(content, "custom-imported");
    expect(restored.id).toBe("custom-imported");
    expect(restored.name).toBe("团队墨蓝（导入）");
    expect(restored.headings.h2.decoration).toBe("pill");
    expect(restored.tableStyle).toBe("minimal");
    expect(restored.bodyFontSize).toBe(18);
  });

  it("normalizes invalid values and clamps numeric ranges", () => {
    const normalized = normalizeTheme({
      ...themes[0],
      accent: "red",
      bodyFontSize: 100,
      bodyLineHeight: 0,
      headings: { ...themes[0].headings, h2: { ...themes[0].headings.h2, decoration: "unknown" } },
    });
    expect(normalized.accent).toBe(themes[0].accent);
    expect(normalized.bodyFontSize).toBe(20);
    expect(normalized.bodyLineHeight).toBe(1.4);
    expect(normalized.headings.h2.decoration).toBe(themes[0].headings.h2.decoration);
  });

  it("migrates V1 theme files with legacy heading fields", () => {
    const legacyTheme: Record<string, unknown> = {
      ...themes[0],
      id: "legacy-theme",
      name: "旧版主题",
      fontFamily: "microsoft-yahei",
      h1Size: 31,
      h2Size: 23,
      h3Size: 19,
      h1Align: "center",
      h2Style: "underline",
      heading: "#123456",
    };
    delete legacyTheme.headings;
    const restored = parseThemeFile(
      JSON.stringify({ format: themeFileFormat, version: 1, exportedAt: "2026-07-24T00:00:00.000Z", theme: legacyTheme }),
      "custom-migrated",
    );
    expect(restored.fontFamily).toBe("microsoft-yahei");
    expect(restored.headings.h1).toMatchObject({ fontSize: 31, align: "center", color: "#123456" });
    expect(restored.headings.h2).toMatchObject({ fontSize: 23, decoration: "underline", color: "#123456" });
    expect(restored.headings.h3.fontSize).toBe(19);
  });

  it("keeps only unique custom themes and enforces the library limit", () => {
    const values = Array.from({ length: 55 }, (_, index) => ({ ...themes[0], id: `custom-${index}`, name: `主题 ${index}` }));
    values.push({ ...themes[0], id: "wechat", name: "伪装内置主题" });
    values.push(values[0]);
    const normalized = normalizeCustomThemes(values);
    expect(normalized).toHaveLength(50);
    expect(normalized.every((theme) => theme.id.startsWith("custom-"))).toBe(true);
    expect(new Set(normalized.map((theme) => theme.id)).size).toBe(50);
  });

  it("rejects unknown and newer theme files", () => {
    expect(() => parseThemeFile("{}")).toThrow("无法识别主题文件格式");
    expect(() => parseThemeFile(JSON.stringify({ format: themeFileFormat, version: themeFileVersion + 1, theme: themes[0] }))).toThrow(
      "高于当前支持",
    );
  });
});
