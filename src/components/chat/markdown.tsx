import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Drop list markers with no content ("1.", "2. **", "-") so no empty list renders. */
export function dropEmptyItems(md: string) {
  return md.split("\n").filter((l) => !/^\s*(\d+[.)]|[-*+\u2022])\s*(\*\*|__|\*|_|&nbsp;|\u00a0)*\s*$/.test(l)).join("\n");
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-3 text-[15px] leading-relaxed [&_a]:text-mm-accent [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-[13px] [&_h1]:font-display [&_h2]:font-display [&_h3]:font-display [&_h1,&_h2,&_h3]:text-lg [&_h1,&_h2,&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:bg-card [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1 [&_li:empty]:hidden [&_ol:empty]:hidden [&_ul:empty]:hidden">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{dropEmptyItems(children)}</ReactMarkdown>
    </div>
  );
}
