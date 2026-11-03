import { callImportFunction } from '../aiImportClient';

jest.mock('../../firebase', () => ({
  app: { options: { projectId: 'demo-project' } },
  auth: { currentUser: { getIdToken: jest.fn() } },
}));

const firebase = require('../../firebase');
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

beforeEach(() => {
  firebase.auth.currentUser = { getIdToken: jest.fn().mockResolvedValue('tok123') };
  global.fetch = jest.fn();
});

test('sends the ID token to the configured project', async () => {
  global.fetch.mockResolvedValue(reply(200, { success: true, recipe: { title: 'Soup' } }));
  const data = await callImportFunction('extractRecipeFromUrl', { url: 'https://x.test' });
  expect(data.recipe.title).toBe('Soup');
  const [url, init] = global.fetch.mock.calls[0];
  expect(url).toBe('https://us-central1-demo-project.cloudfunctions.net/extractRecipeFromUrl');
  expect(init.headers.Authorization).toBe('Bearer tok123');
  expect(JSON.parse(init.body)).toEqual({ url: 'https://x.test' });
});

test('refuses to call when signed out', async () => {
  firebase.auth.currentUser = null;
  await expect(callImportFunction('parseRecipeFromOCR', {})).rejects.toThrow('logged in');
  expect(global.fetch).not.toHaveBeenCalled();
});

test('shows the server message, or a generic one', async () => {
  global.fetch.mockResolvedValueOnce(reply(429, { success: false, error: "You've reached today's recipe import limit." }));
  await expect(callImportFunction('parseRecipeFromOCR', {})).rejects.toThrow("today's recipe import limit");
  global.fetch.mockResolvedValueOnce({ ok: false, status: 502, json: async () => { throw new Error('not json'); } });
  await expect(callImportFunction('parseRecipeFromOCR', {})).rejects.toThrow('Recipe import failed (502)');
  global.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  await expect(callImportFunction('parseRecipeFromOCR', {})).rejects.toThrow('Could not reach');
});
