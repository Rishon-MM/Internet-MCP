/**
 * Markdown post-processing utilities.
 *
 * Cleans up raw Markdown output from Turndown to produce
 * consistent, readable content for LLM consumption.
 */

/**
 * Cleans and normalizes Markdown content.
 *
 * Applied after HTML → Markdown conversion:
 * - Collapses excessive blank lines (max 2 consecutive)
 * - Normalizes heading spacing
 * - Removes empty links
 * - Trims leading/trailing whitespace
 * - Removes zero-width characters
 */
export function cleanMarkdown(raw: string): string {
  let md = raw;

  // Remove zero-width characters
  md = md.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');

  // Remove empty links: [](url) or [  ](url)
  md = md.replace(/\[\s*\]\([^)]*\)/g, '');

  // Remove links with no href: [text]()
  md = md.replace(/\[([^\]]+)\]\(\s*\)/g, '$1');

  // Collapse 3+ consecutive blank lines into 2
  md = md.replace(/\n{3,}/g, '\n\n');

  // Ensure headings have a blank line before them (except at start)
  md = md.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2');

  // Ensure headings have a blank line after them
  md = md.replace(/(#{1,6}\s[^\n]+)\n([^\n#])/g, '$1\n\n$2');

  // Clean up trailing whitespace on each line
  md = md.replace(/[ \t]+$/gm, '');

  // Trim overall
  md = md.trim();

  return md;
}

/**
 * Truncates Markdown content to a maximum character length.
 *
 * Breaks at paragraph boundaries when possible to avoid
 * cutting content mid-sentence.
 */
export function truncateMarkdown(markdown: string, maxLength: number): string {
  if (markdown.length <= maxLength) {
    return markdown;
  }

  const truncated = markdown.slice(0, maxLength);

  // Try to break at a paragraph boundary (double newline)
  const lastParagraph = truncated.lastIndexOf('\n\n');
  if (lastParagraph > maxLength * 0.7) {
    return truncated.slice(0, lastParagraph) + '\n\n---\n*Content truncated*';
  }

  // Fall back to sentence boundary
  const lastSentence = truncated.lastIndexOf('. ');
  if (lastSentence > maxLength * 0.8) {
    return truncated.slice(0, lastSentence + 1) + '\n\n---\n*Content truncated*';
  }

  return truncated + '\n\n---\n*Content truncated*';
}
