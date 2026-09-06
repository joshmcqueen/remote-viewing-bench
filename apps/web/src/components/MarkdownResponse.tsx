import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
export function MarkdownResponse({ children }: { children: string }) {
  return (
    <div className="markdown-response">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
