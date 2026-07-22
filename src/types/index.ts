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
