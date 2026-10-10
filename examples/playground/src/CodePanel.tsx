/** A tiny, non-interactive code preview. No syntax highlighter — four colors
 * of plain text is not worth a dependency for this. */
export function CodePanel({ code }: { code: string }) {
  return (
    <div className="pg-code" aria-label="Current configuration">
      <div className="pg-code__bar">
        <span />
        <span />
        <span />
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}
