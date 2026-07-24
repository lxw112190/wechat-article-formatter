export type ThemeHeadingDecoration = "left-bar" | "underline" | "filled" | "pill" | "plain";

export type ThemeHeadingConfig = {
  fontSize: number;
  color: string;
  align: "left" | "center" | "right";
  decoration: ThemeHeadingDecoration;
};

export type ThemeHeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

export type Theme = {
  id: string;
  name: string;
  accent: string;
  accentSoft: string;
  heading: string;
  text: string;
  muted: string;
  border: string;
  codeBg: string;
  fontFamily: "system" | "microsoft-yahei" | "pingfang" | "noto-sans" | "serif" | "songti" | "kaiti" | "fangsong" | "rounded" | "arial";
  bodyFontSize: number;
  bodyLineHeight: number;
  paragraphSpacing: number;
  bodyTextAlign: "left" | "justify";
  letterSpacing: number;
  firstLineIndent: number;
  headings: Record<ThemeHeadingLevel, ThemeHeadingConfig>;
  unorderedListStyle: "disc" | "circle" | "square";
  orderedListStyle: "decimal" | "cjk-ideographic" | "decimal-leading-zero";
  listSpacing: number;
  strongStyle: "color" | "highlight" | "underline";
  linkStyle: "underline" | "bottom-border" | "plain";
  blockquoteStyle: "left-bar" | "card" | "quote";
  codeStyle: "soft" | "dark" | "bordered";
  tableStyle: "soft-header" | "accent-header" | "minimal";
  imageStyle: "rounded" | "square" | "shadow";
  dividerStyle: "solid" | "dashed" | "dotted";
  imageSpacing: number;
  imageCaptionAlign: "left" | "center" | "right";
  imageCaptionSize: number;
  radius: number;
};

export type Article = {
  id: string;
  title: string;
  markdown: string;
  updatedAt: string;
};

export type ArticleVersion = {
  id: string;
  articleId: string;
  title: string;
  markdown: string;
  savedAt: string;
};

export type OutlineItem = {
  level: number;
  text: string;
  position: number;
  line: number;
};

export type PreflightIssue = {
  id: string;
  label: string;
  detail: string;
  status: "pass" | "warning" | "error";
};
