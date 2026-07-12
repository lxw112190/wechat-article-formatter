import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "公众号发布台",
  description: "面向微信公众号的 Markdown 排版、预览和发布前检查工具。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "公众号发布台",
    description: "把文章草稿整理成适合公众号后台粘贴的发布稿。",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "公众号发布台",
    description: "Markdown 编辑、公众号预览、主题排版和发布前检查。",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
