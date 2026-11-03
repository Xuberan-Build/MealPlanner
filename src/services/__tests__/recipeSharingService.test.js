import { shareRecipeWithUser } from '../recipeSharingService';

jest.mock('../../firebase', () => ({ app: {}, auth: { currentUser: { uid: 'me', email: 'me@x.co' } } }));
jest.mock('firebase/functions', () => ({ getFunctions: jest.fn(), httpsCallable: jest.fn() }));

const { getFunctions, httpsCallable } = require('firebase/functions');
const firebase = require('../../firebase');

let call;
beforeEach(() => {
  call = jest.fn().mockResolvedValue({ data: { recipientName: 'Sam' } });
  getFunctions.mockReturnValue({ name: 'functions' });
  httpsCallable.mockReturnValue(call);
  firebase.auth.currentUser = { uid: 'me', email: 'me@x.co' };
});

test('shares through the shareRecipe function by recipe id and email', async () => {
  const result = await shareRecipeWithUser({ id: 'r1', title: 'Soup', userId: 'me' }, ' sam@x.co ');
  expect(httpsCallable).toHaveBeenCalledWith({ name: 'functions' }, 'shareRecipe');
  expect(call).toHaveBeenCalledWith({ recipeId: 'r1', recipientEmail: 'sam@x.co' });
  expect(result).toEqual({ success: true, message: 'Recipe successfully shared with Sam!', recipientName: 'Sam' });
});

test('checks sign-in, self-sharing and unsaved recipes before calling the server', async () => {
  await expect(shareRecipeWithUser({ id: 'r1' }, 'ME@x.co')).rejects.toThrow('yourself');
  await expect(shareRecipeWithUser({ title: 'Draft' }, 'sam@x.co')).rejects.toThrow('Save the recipe');
  firebase.auth.currentUser = null;
  await expect(shareRecipeWithUser({ id: 'r1' }, 'sam@x.co')).rejects.toThrow('logged in');
  expect(call).not.toHaveBeenCalled();
});

test('shows the server message for expected errors and a generic one otherwise', async () => {
  call.mockRejectedValueOnce(Object.assign(new Error('No Savor Meals account uses that email.'), { code: 'functions/not-found' }));
  await expect(shareRecipeWithUser({ id: 'r1' }, 'x@x.co')).rejects.toThrow('No Savor Meals account uses that email.');
  call.mockRejectedValueOnce(Object.assign(new Error('INTERNAL stack'), { code: 'functions/internal' }));
  await expect(shareRecipeWithUser({ id: 'r1' }, 'x@x.co')).rejects.toThrow('Could not share the recipe. Please try again.');
});
