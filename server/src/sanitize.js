import sanitizeHtml from 'sanitize-html';

// Allow-list matches exactly what the editor can produce.
const OPTIONS = {
  allowedTags: [
    'h1', 'h2', 'h3', 'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre',
    'blockquote', 'ul', 'ol', 'li', 'hr',
  ],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
};

export function cleanHtml(html) {
  return sanitizeHtml(String(html ?? ''), OPTIONS);
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
