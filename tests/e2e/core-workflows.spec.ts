import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    localStorage.clear();
    indexedDB.deleteDatabase("wechat-publisher-assets");
  });
  await page.reload();
});

test("new article auto-saves and survives reload", async ({ page }) => {
  await page.getByTitle("新建文章").click();
  await page.getByLabel("标题").fill("自动保存测试");
  await page.locator("textarea.markdownInput").fill("# 自动保存测试\n\n这段内容应当在刷新后保留。");
  await expect(page.getByText("✓ 已保存")).toBeVisible({ timeout: 5_000 });
  await page.reload();
  await expect(page.getByLabel("标题")).toHaveValue("自动保存测试");
  await expect(page.locator("textarea.markdownInput")).toContainText("刷新后保留");
});

test("article can be restored from trash", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  const title = await page.getByLabel("标题").inputValue();
  await page.getByRole("button", { name: "移入回收站" }).click();
  await page.getByTitle("打开回收站").click();
  await expect(page.getByRole("dialog", { name: "回收站" })).toContainText(title);
  await page.getByRole("button", { name: "恢复", exact: true }).click();
  await expect(page.getByLabel("标题")).toHaveValue(title);
});

test("custom theme is saved and survives reload", async ({ page }) => {
  await page.getByRole("button", { name: "基于当前创建" }).click();
  await page.getByLabel("主题名称").fill("端到端主题");
  await page.getByRole("button", { name: "保存并使用" }).click();
  await expect(page.getByText("端到端主题", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("端到端主题", { exact: true })).toBeVisible();
});

test("theme file can be exported and imported", async ({ page }) => {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出当前" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  await page.getByLabel("选择主题文件").setInputFiles(path!);
  await expect(page.getByText(/已导入主题/)).toBeVisible();
});

test("complete ZIP backup restores the article library", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByLabel("标题").fill("备份恢复测试");
  await page.locator("textarea.markdownInput").fill("# 备份恢复测试\n\nZIP 应恢复这段内容。");
  await page
    .getByRole("button", { name: /立即保存|自动保存中|已自动保存|已保存/ })
    .first()
    .click();
  await page.getByRole("button", { name: "导出 Word", exact: true }).first().click();
  await page.getByRole("button", { name: "正式报告" }).click();
  await page.getByLabel("关闭 Word 导出设置").click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "完整备份 ZIP", exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  await page.getByLabel("标题").fill("已被修改");
  await page.getByRole("button", { name: "导出 Word", exact: true }).first().click();
  await page.getByRole("button", { name: "紧凑打印" }).click();
  await page.getByLabel("关闭 Word 导出设置").click();
  await page.getByLabel("选择完整备份 ZIP").setInputFiles(path!);
  await expect(page.getByLabel("标题")).toHaveValue("备份恢复测试", { timeout: 10_000 });
  await page.getByRole("button", { name: "导出 Word", exact: true }).first().click();
  await expect(page.getByLabel("生成可点击文章目录")).toBeChecked();
  await page.getByLabel("关闭 Word 导出设置").click();
});

test("Word export downloads a docx file", async ({ page }) => {
  await page.getByLabel("标题").fill("Word 导出测试");
  await page.locator("textarea.markdownInput").fill("# Word 导出测试\n\n**正文**\n\n[项目](https://github.com/demo)");
  await page.getByRole("button", { name: "导出 Word", exact: true }).first().click();
  await expect(page.getByRole("dialog", { name: "Word 导出设置" })).toBeVisible();
  await page.getByRole("button", { name: "正式报告" }).click();
  await expect(page.getByLabel("生成可点击文章目录")).toBeChecked();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 .docx" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.docx$/);
  expect((await download.createReadStream()) !== null).toBe(true);
  await page.getByRole("button", { name: "导出 Word", exact: true }).first().click();
  const htmlDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 Word 兼容 HTML" }).click();
  const htmlDownload = await htmlDownloadPromise;
  expect(htmlDownload.suggestedFilename()).toMatch(/Word兼容版\.html$/);
});

test("WeChat copy keeps external URLs and task state", async ({ page, context }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.locator("textarea.markdownInput").fill("[项目](https://github.com/demo)\n\n- [x] 已完成\n- [ ] 待办");
  await page.getByRole("button", { name: "复制正文" }).first().click();
  const clipboard = await page.evaluate(async () => navigator.clipboard.readText());
  expect(clipboard).toContain("https://github.com/demo");
  expect(clipboard).toContain("☑");
  expect(clipboard).toContain("☐");
});

async function writeClipboard(page: import("@playwright/test").Page, text: string, html: string) {
  await page.evaluate(
    async ({ text: value, html: markup }) => {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([value], { type: "text/plain" }),
          "text/html": new Blob([markup], { type: "text/html" }),
        }),
      ]);
    },
    { text, html },
  );
}

test("Markdown clipboard content is pasted byte-for-byte with an HTML wrapper", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const markdown = "## Markdown 粘贴测试\n\n这是 **粗体** 和 `code`。\n\n- [x] 完成\n- [ ] 待办";
  await writeClipboard(page, markdown, `<pre><span>${markdown}</span></pre>`);
  const textarea = page.locator("textarea.markdownInput");
  await textarea.fill("");
  await textarea.click();
  await textarea.press("Control+V");
  await expect(textarea).toHaveValue(markdown);
  await expect(page.locator(".pasteNotice")).toHaveCount(0);
});

test("rich HTML clipboard content is converted with a rich-text message", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await writeClipboard(
    page,
    "这是重要内容，点击项目地址",
    '<p>这是<strong>重要</strong>内容，<a href="https://github.com/demo">项目地址</a></p>',
  );
  const textarea = page.locator("textarea.markdownInput");
  await textarea.fill("");
  await textarea.click();
  await textarea.press("Control+V");
  await expect(textarea).toContainText("这是**重要**内容");
  await expect(textarea).toContainText("[项目地址](https://github.com/demo)");
  await expect(page.getByText("检测到富文本，已转换为 Markdown")).toBeVisible();
});

test("Word clipboard content is converted with a Word-specific message", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await writeClipboard(page, "Word 正文", '<p class="MsoNormal">Word <b>正文</b></p>');
  const textarea = page.locator("textarea.markdownInput");
  await textarea.fill("");
  await textarea.click();
  await textarea.press("Control+V");
  await expect(textarea).toContainText("Word **正文**");
  await expect(page.getByText("已将 Word 内容转换为 Markdown")).toBeVisible();
});

test("copy HTML uses an image ID placeholder instead of Base64", async ({ page, context }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.locator("textarea.markdownInput").fill("# 图片测试\n\n![说明](asset://IMG-E2E-001)");
  await page.getByRole("button", { name: "复制正文" }).first().click();
  const clipboardHtml = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    const html = items.find((item) => item.types.includes("text/html"));
    return html ? await (await html.getType("text/html")).text() : "";
  });
  expect(clipboardHtml).toContain("IMG-E2E-001");
  expect(clipboardHtml).not.toContain("data:image");
});

test("draft search, pin and duplicate keep the library manageable", async ({ page }) => {
  await page.getByTitle("新建文章").click();
  await page.getByLabel("标题").fill("可搜索的产品文章");
  await page.locator("textarea.markdownInput").fill("# 产品文章\n\n包含独特关键词：星河计划。");
  await expect(page.getByText("✓ 已保存")).toBeVisible({ timeout: 5_000 });
  await page.getByLabel("搜索草稿").fill("星河计划");
  await expect(page.locator(".articleItem")).toHaveCount(1);
  await page.getByLabel("置顶文章").click();
  await page.getByLabel("搜索草稿").fill("");
  await expect(page.locator(".articleItem").first()).toContainText("可搜索的产品文章");
  await page.getByRole("button", { name: "复制文章" }).click();
  await expect(page.getByLabel("标题")).toHaveValue("可搜索的产品文章 副本");
});
