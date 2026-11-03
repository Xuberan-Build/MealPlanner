import { escapeHtml, sanitizeRecipeHtml } from '../safeHtml';
import { formatInstructions } from '../instructionsFormatter';
import { safeRedirectPath } from '../safeRedirect';

describe('sanitizeRecipeHtml', () => {
  test.each([
    ['<img src=x onerror="alert(1)">', ''],
    ['<p onclick="alert(1)">Stir</p>', '<p>Stir</p>'],
    ['<script>alert(1)</script><p>Bake</p>', '<p>Bake</p>'],
    ['<a href="javascript:alert(1)">x</a>', '<a target="_blank" rel="noopener noreferrer nofollow">x</a>'],
    ['<svg><script>alert(1)</script></svg>', ''],
    ['<iframe src="https://evil.test"></iframe>Cook', 'Cook'],
    ['<p style="background:url(x)">Mix</p>', '<p>Mix</p>'],
  ])('removes script from %s', (input, expected) => {
    expect(sanitizeRecipeHtml(input)).toBe(expected);
  });

  test('keeps the formatting the editor produces', () => {
    const html = '<h2>Steps</h2><ol><li><strong>Heat</strong> the <em>oven</em></li></ol><p class="instruction-step">Done<br></p>';
    expect(sanitizeRecipeHtml(html)).toBe(html);
  });

  test('safe links open in a new tab', () => {
    expect(sanitizeRecipeHtml('<a href="https://example.com">site</a>'))
      .toBe('<a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">site</a>');
  });

  test('non-strings give an empty string', () => {
    expect(sanitizeRecipeHtml(null)).toBe('');
    expect(sanitizeRecipeHtml({})).toBe('');
  });
});

test('escapeHtml', () => {
  expect(escapeHtml(`<b>"Tom" & 'Jerry'</b>`)).toBe('&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;');
});

describe('formatInstructions', () => {
  test('plain text stays text: a < b is shown, not parsed', () => {
    expect(formatInstructions('Use 1 < 2 cups & stir')).toBe('<p class="instruction-step">Use 1 &lt; 2 cups &amp; stir</p>');
  });

  test('still bolds temperatures and times', () => {
    expect(formatInstructions('Bake at 350°F for 20 minutes.')).toContain('<strong>350°F</strong>');
    expect(formatInstructions('Bake at 350°F for 20 minutes.')).toContain('<strong>20 minutes</strong>');
  });

  test('HTML input is cleaned', () => {
    expect(formatInstructions('<p>Mix</p><img src=x onerror=alert(1)>')).toBe('<p>Mix</p>');
  });
});

describe('safeRedirectPath', () => {
  test.each([
    ['/recipe-book', '/recipe-book'],
    ['/shopping-list?id=1#top', '/shopping-list?id=1#top'],
    ['  /profile ', '/profile'],
  ])('keeps in-app path %s', (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });

  test.each([
    // eslint-disable-next-line no-script-url -- the dangerous value under test
    'https://evil.test', '//evil.test', '/\\evil.test', 'javascript:alert(1)', 'evil.test',
    '/\tevil', '', null, undefined, 42,
  ])('refuses %p', (input) => {
    expect(safeRedirectPath(input)).toBeNull();
  });
});
