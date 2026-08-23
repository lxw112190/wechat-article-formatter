import type { Dispatch, SetStateAction } from "react";
import type { useArticleHistory } from "../hooks/useArticleHistory";
import type { useArticleLibrary } from "../hooks/useArticleLibrary";
import type { useArticlePresentation } from "../hooks/useArticlePresentation";
import type { useAutoSave } from "../hooks/useAutoSave";
import type { useBackup } from "../hooks/useBackup";
import type { useClipboard } from "../hooks/useClipboard";
import type { useImageAssets } from "../hooks/useImageAssets";
import type { useMarkdownEditor } from "../hooks/useMarkdownEditor";
import type { useSyncScroll } from "../hooks/useSyncScroll";
import type { useStorageManager } from "../hooks/useStorageManager";
import type { ArticleVersion } from "../types";
import { ArticleEditor } from "./ArticleEditor";
import { ArticleSidebar } from "./ArticleSidebar";
import { HeaderToolbar } from "./HeaderToolbar";
import { HistoryDialog } from "./HistoryDialog";
import { PhonePreview } from "./PhonePreview";
import { PublishPanel } from "./PublishPanel";
import { StatusMessage } from "./StatusMessage";
import { StorageDialog } from "./StorageDialog";
import { StorageRecoveryDialog } from "./StorageRecoveryDialog";
import { TrashDialog } from "./TrashDialog";
import { WordExportDialog } from "./WordExportDialog";

type AppViewProps = {
  appError: string;
  setAppError: Dispatch<SetStateAction<string>>;
  historyOpen: boolean;
  setHistoryOpen: Dispatch<SetStateAction<boolean>>;
  trashOpen: boolean;
  setTrashOpen: Dispatch<SetStateAction<boolean>>;
  history: ReturnType<typeof useArticleHistory>;
  library: ReturnType<typeof useArticleLibrary>;
  presentation: ReturnType<typeof useArticlePresentation>;
  editor: ReturnType<typeof useMarkdownEditor>;
  images: ReturnType<typeof useImageAssets>;
  scroll: ReturnType<typeof useSyncScroll>;
  clipboard: ReturnType<typeof useClipboard>;
  autoSave: ReturnType<typeof useAutoSave>;
  backup: ReturnType<typeof useBackup>;
  storage: ReturnType<typeof useStorageManager>;
  currentHistory: ArticleVersion[];
};

export function AppView(props: AppViewProps) {
  const { library, presentation, editor, images, scroll, clipboard, autoSave, backup, storage } = props;
  return (
    <main className="workspace">
      <HeaderToolbar
        activeId={library.activeId}
        saved={library.saved}
        hasUnsavedChanges={library.hasUnsavedChanges}
        historyCount={props.currentHistory.length}
        markdownMessage={library.markdownMessage}
        libraryMessage={library.libraryMessage}
        backupMessage={backup.backupMessage}
        copied={clipboard.copied}
        onSave={() => {
          autoSave.cancelAutoSave();
          library.persistCurrentArticle("手动保存");
        }}
        onOpenHistory={() => props.setHistoryOpen(true)}
        onImportMarkdown={library.importMarkdown}
        onExportMarkdown={library.exportMarkdown}
        onDeleteArticle={library.deleteArticle}
        onDuplicateArticle={library.duplicateArticle}
        onOpenStorage={storage.openStorageManager}
        onExportLibrary={library.exportLibrary}
        onImportLibrary={library.importLibrary}
        onExportBackup={() => void backup.exportCompleteBackup()}
        onImportBackup={backup.importCompleteBackup}
        onExportHtml={presentation.exportHtml}
        onExportWord={() => presentation.setWordExportOpen(true)}
        wordExporting={presentation.wordExporting}
        onPrint={presentation.printOrSavePdf}
        onCopy={() => void clipboard.copyForWechat()}
      />
      <StatusMessage message={props.appError} onClose={() => props.setAppError("")} />
      <section className="appGrid">
        <ArticleSidebar
          articles={library.visibleArticles}
          activeId={library.activeId}
          searchQuery={library.searchQuery}
          articleSort={library.articleSort}
          totalCount={library.articles.length}
          trashCount={library.trash.length}
          onCreate={library.createArticle}
          onSelect={library.selectArticle}
          onSearch={library.setSearchQuery}
          onSort={library.setArticleSort}
          onTogglePinned={library.togglePinned}
          onOpenTrash={() => props.setTrashOpen(true)}
        />
        <ArticleEditor
          activeId={library.activeId}
          title={library.title}
          markdown={library.markdown}
          setTitle={library.setTitle}
          setMarkdown={library.setMarkdown}
          textareaRef={editor.textareaRef}
          imageInputRef={editor.imageInputRef}
          replaceImageInputRef={editor.replaceImageInputRef}
          formatRef={editor.formatRef}
          dragActive={editor.dragActive}
          setDragActive={editor.setDragActive}
          formatOpen={editor.formatOpen}
          setFormatOpen={editor.setFormatOpen}
          applyFormat={editor.applyFormat}
          storageError={library.storageError}
          isDirty={library.isDirty}
          hasUnsavedChanges={library.hasUnsavedChanges}
          outline={presentation.outline}
          outlineOpen={scroll.outlineOpen}
          activeOutlineIndex={scroll.activeOutlineIndex}
          syncScroll={scroll.syncScroll}
          readMinutes={presentation.readMinutes}
          characterCount={presentation.characterCount}
          headingCount={presentation.outline.length}
          imageCount={presentation.imageCount}
          pasteMessage={clipboard.pasteMessage}
          imageMessage={images.imageMessage}
          imageAssets={images.imageAssets}
          assetUrls={images.assetUrls}
          imageProcessing={images.imageProcessing}
          onToggleOutline={() => scroll.setOutlineOpen((open) => !open)}
          onCloseOutline={() => scroll.setOutlineOpen(false)}
          onToggleSync={() => scroll.setSyncScroll((enabled) => !enabled)}
          onNavigateOutline={scroll.navigateToOutline}
          onUpdateOutline={scroll.updateOutlineFromEditor}
          onPaste={clipboard.handleEditorPaste}
          onDrop={images.handleEditorDrop}
          onEditorScroll={(source) => scroll.syncScrollPosition(source, scroll.previewRef.current)}
          onImageInput={images.handleImageInput}
          onReplaceImageInput={images.handleReplaceImage}
          onUpdateImageAlt={images.updateImageAlt}
          onSaveImageAlt={(id) => void images.saveImageAlt(id)}
          onInsertImage={images.insertExistingImage}
          onDownloadImage={images.downloadImage}
          onRecompressImage={(asset) => void images.recompressImage(asset)}
          onReplaceImage={images.beginReplaceImage}
          onRemoveImage={(asset) => void images.removeImage(asset)}
        />
        <PhonePreview
          previewRef={scroll.previewRef}
          title={library.title}
          bodyHtml={presentation.bodyHtml}
          syncScroll={scroll.syncScroll}
          themeVars={presentation.themeVars}
          onScroll={scroll.handlePreviewScroll}
        />
        <PublishPanel
          title={library.title}
          copied={clipboard.copied}
          fieldCopied={clipboard.fieldCopied}
          themeId={presentation.themeId}
          themes={presentation.themes}
          currentTheme={presentation.theme}
          isCustomTheme={presentation.isCustomTheme}
          themeMessage={presentation.themeMessage}
          preflightIssues={presentation.preflightIssues}
          localImageCount={presentation.localAssets.length}
          onCopyField={(key, value) => void clipboard.copyPlainField(key, value)}
          onPrint={presentation.printOrSavePdf}
          onExportWord={() => presentation.setWordExportOpen(true)}
          wordExporting={presentation.wordExporting}
          onThemeChange={presentation.setThemeId}
          onCreateThemeDraft={presentation.createThemeDraft}
          onEditThemeDraft={presentation.editThemeDraft}
          onSaveTheme={presentation.saveTheme}
          onDeleteTheme={presentation.deleteCurrentTheme}
          onExportTheme={presentation.exportCurrentTheme}
          onImportTheme={presentation.importTheme}
          onCopy={() => void clipboard.copyForWechat()}
        />
      </section>
      <HistoryDialog
        open={props.historyOpen}
        versions={props.currentHistory}
        onClose={() => props.setHistoryOpen(false)}
        onRestore={(version) => {
          autoSave.cancelAutoSave();
          library.restoreVersion(version);
          props.setHistoryOpen(false);
        }}
      />
      <TrashDialog
        open={props.trashOpen}
        articles={library.trash}
        onClose={() => props.setTrashOpen(false)}
        onRestore={(articleId) => {
          library.restoreFromTrash(articleId);
          props.setTrashOpen(false);
        }}
        onDelete={library.permanentlyDeleteArticle}
        onEmpty={library.emptyTrash}
      />
      <StorageDialog
        open={storage.storageOpen}
        busy={storage.storageBusy}
        message={storage.storageMessage}
        snapshot={storage.storageSnapshot}
        articleCount={library.articles.length}
        historyCount={props.history.history.length}
        trashCount={library.trash.length}
        onClose={() => storage.setStorageOpen(false)}
        onRefresh={() => void storage.refreshStorageSnapshot()}
        onPersist={() => void storage.requestPersistentStorage()}
        onCleanup={() => void storage.cleanupUnusedImages()}
        onBackup={() => void backup.exportCompleteBackup()}
      />
      <StorageRecoveryDialog
        libraryRecovery={library.storageRecovery}
        historyRecovery={props.history.storageRecovery}
        onDownloadLibrary={library.downloadCorruptLibrary}
        onRepairLibrary={library.repairCorruptLibrary}
        onDiscardLibrary={library.discardCorruptLibrary}
        onDownloadHistory={props.history.downloadCorruptHistory}
        onRepairHistory={props.history.repairCorruptHistory}
        onDiscardHistory={props.history.discardCorruptHistory}
        onError={props.setAppError}
      />
      <WordExportDialog
        open={presentation.wordExportOpen}
        settings={presentation.wordSettings}
        exporting={presentation.wordExporting}
        htmlExporting={presentation.wordHtmlExporting}
        onChange={presentation.updateWordSettings}
        onClose={() => presentation.setWordExportOpen(false)}
        onExport={presentation.exportWord}
        onExportHtml={presentation.exportWordHtml}
      />
    </main>
  );
}
