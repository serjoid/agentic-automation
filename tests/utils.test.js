import { describe, test, expect } from 'vitest';
const {
  escapeHtml,
  renderMarkdown,
  normalizePromptOverrides,
  resolveSystemPrompt,
  SYSTEM_PROMPT_PROFILES,
  DEFAULT_SYSTEM_PROMPT_PROFILE
} = require('../utils.js');

describe('escapeHtml', () => {
  test('should escape special HTML characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(escapeHtml('Hello & Welcome')).toBe('Hello &amp; Welcome');
  });

  test('should stringify non-string inputs', () => {
    expect(escapeHtml(123)).toBe('123');
    expect(escapeHtml(true)).toBe('true');
  });
});

describe('renderMarkdown', () => {
  test('should parse headers', () => {
    expect(renderMarkdown('# Header 1')).toContain('<h1>Header 1</h1>');
    expect(renderMarkdown('## Header 2')).toContain('<h2>Header 2</h2>');
    expect(renderMarkdown('### Header 3')).toContain('<h3>Header 3</h3>');
  });

  test('should parse bold and italic inline styles', () => {
    expect(renderMarkdown('This is **bold** text.')).toContain('<strong>bold</strong>');
    expect(renderMarkdown('This is *italic* text.')).toContain('<em>italic</em>');
    expect(renderMarkdown('This is ***bold italic*** text.')).toContain('<strong><em>bold italic</em></strong>');
  });

  test('should parse inline code and code blocks', () => {
    expect(renderMarkdown('Use `const x = 5;` to define a variable.')).toContain('<code>const x = 5;</code>');
    const block = renderMarkdown('```javascript\nconst x = 10;\nconsole.log(x);\n```');
    expect(block).toContain('<pre><code>const x = 10;<br>console.log(x);</code></pre>');
  });

  test('should parse unordered lists', () => {
    const list = renderMarkdown('- Item A\n- Item B\n• Item C');
    expect(list).toContain('<ul><li>Item A</li><li>Item B</li><li>Item C</li></ul>');
  });

  test('should parse ordered lists', () => {
    const list = renderMarkdown('1. First\n2. Second');
    expect(list).toContain('<ol><li>First</li><li>Second</li></ol>');
  });

  test('should parse markdown links', () => {
    const link = renderMarkdown('[Google](https://google.com)');
    expect(link).toContain('<a href="https://google.com" target="_blank" rel="noopener">Google</a>');
  });

  test('should group paragraphs on double newlines and convert single newlines to br', () => {
    const text = renderMarkdown('Paragraph 1.\nStill paragraph 1.\n\nParagraph 2.');
    expect(text).toBe('<p>Paragraph 1.<br>Still paragraph 1.</p><p>Paragraph 2.</p>');
  });

  test('should escape raw HTML inside markdown to prevent XSS', () => {
    const malicious = renderMarkdown('Click [here](javascript:alert(1)) or see <img src=x onerror=alert(1)>');
    expect(malicious).not.toContain('<img');
    expect(malicious).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});

describe('normalizePromptOverrides', () => {
  test('should return empty object for invalid inputs', () => {
    expect(normalizePromptOverrides(null)).toEqual({});
    expect(normalizePromptOverrides(undefined)).toEqual({});
    expect(normalizePromptOverrides('not an object')).toEqual({});
    expect(normalizePromptOverrides([1, 2, 3])).toEqual({});
  });

  test('should keep only valid profile overrides with string values', () => {
    const input = {
      default: 'Custom default prompt',
      'sei-sip': 'Custom SEI prompt',
      invalid_profile_id: 'Some text',
      'form-filling': 12345 // non-string value
    };
    const output = normalizePromptOverrides(input);
    expect(output).toEqual({
      default: 'Custom default prompt',
      'sei-sip': 'Custom SEI prompt'
    });
  });
});

describe('resolveSystemPrompt', () => {
  test('should return the correct default profile prompt when no overrides are passed', () => {
    const prompt = resolveSystemPrompt(DEFAULT_SYSTEM_PROMPT_PROFILE, {}, null);
    expect(prompt).toBe(SYSTEM_PROMPT_PROFILES[DEFAULT_SYSTEM_PROMPT_PROFILE].prompt);
  });

  test('should fallback to default profile if selected profile is invalid', () => {
    const prompt = resolveSystemPrompt('non-existent-profile', {}, null);
    expect(prompt).toBe(SYSTEM_PROMPT_PROFILES[DEFAULT_SYSTEM_PROMPT_PROFILE].prompt);
  });

  test('should prioritize user overrides if defined', () => {
    const overrides = {
      'sei-sip': 'My custom SEI override prompt text'
    };
    const prompt = resolveSystemPrompt('sei-sip', overrides, null);
    expect(prompt).toBe('My custom SEI override prompt text');
  });

  test('should support legacy prompt for the default profile when override is missing', () => {
    const prompt = resolveSystemPrompt(DEFAULT_SYSTEM_PROMPT_PROFILE, {}, 'Legacy system prompt');
    expect(prompt).toBe('Legacy system prompt');
  });

  test('should ignore legacy prompt if selected profile is not the default profile', () => {
    const prompt = resolveSystemPrompt('data-extraction', {}, 'Legacy system prompt');
    expect(prompt).toBe(SYSTEM_PROMPT_PROFILES['data-extraction'].prompt);
  });
});
