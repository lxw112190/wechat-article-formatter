import { useState } from "react";
import { AppView } from "./components";
import {
  useArticleHistory,
  useArticleLibrary,
  useArticlePresentation,
  useAutoSave,
  useBackup,
  useClipboard,
  useImageAssets,
  useMarkdownEditor,
  useSyncScroll,
} from "./hooks";

export default function App() {
  const [appError, setAppError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const history = useArticleHistory({ onStorageError: setAppError });
  const library = useArticleLibrary({
    history: history.history,
    recordVersion: history.recordVersion,
    removeArticleHistory: history.removeArticleHistory,
    replaceHistory: history.replaceHistory,
    onError: setAppError,
  });
  const editor = useMarkdownEditor({ markdown: library.markdown, setMarkdown: library.setMarkdown });
  const images = useImageAssets({
    activeId: library.activeId,
    setMarkdown: library.setMarkdown,
    insertBlock: editor.insertBlock,
    replaceImageInputRef: editor.replaceImageInputRef,
    setDragActive: editor.setDragActive,
    onError: setAppError,
  });
  const presentation = useArticlePresentation({
    title: library.title,
    markdown: library.markdown,
    imageAssets: images.imageAssets,
    assetUrls: images.assetUrls,
    assetLibraryReady: images.assetLibraryReady,
  });
  const scroll = useSyncScroll({ markdown: library.markdown, outline: presentation.outline, textareaRef: editor.textareaRef });
  const clipboard = useClipboard({
    markdown: library.markdown,
    setMarkdown: library.setMarkdown,
    copyHtml: presentation.copyHtml,
    copyPlainText: presentation.copyPlainText,
    preflightErrors: presentation.preflightErrors,
    localImageCount: presentation.localAssets.length,
    addImageFiles: images.addImageFiles,
  });
  const autoSave = useAutoSave({
    activeId: library.activeId,
    title: library.title,
    markdown: library.markdown,
    isDirty: library.isDirty,
    hasUnsavedChanges: library.hasUnsavedChanges,
    onSave: () => library.persistCurrentArticle("自动保存"),
    onSaving: () => library.setSaved("自动保存中…"),
  });
  const backup = useBackup({
    articles: library.getCurrentArticles(),
    history: history.history,
    themeId: presentation.themeId,
    syncScroll: scroll.syncScroll,
    outlineOpen: scroll.outlineOpen,
    replaceLibrary: (articles, versions) => {
      autoSave.cancelAutoSave();
      library.replaceLibrary(articles, versions);
    },
    setThemeId: presentation.setThemeId,
    setSyncScroll: scroll.setSyncScroll,
    setOutlineOpen: scroll.setOutlineOpen,
    refreshAssets: images.refreshAssets,
    validThemeIds: presentation.themes.map((item) => item.id),
    onError: setAppError,
  });
  const currentHistory = history.history
    .filter((version) => version.articleId === library.activeId)
    .sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));

  return (
    <AppView
      appError={appError}
      setAppError={setAppError}
      historyOpen={historyOpen}
      setHistoryOpen={setHistoryOpen}
      history={history}
      library={library}
      presentation={presentation}
      editor={editor}
      images={images}
      scroll={scroll}
      clipboard={clipboard}
      autoSave={autoSave}
      backup={backup}
      currentHistory={currentHistory}
    />
  );
}
