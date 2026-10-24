import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import GlutenCheck, { verdictLook } from './GlutenCheck';
import AppNav from './AppNav';
import { AuthContext } from '../context/AuthContext';
import { isPhone, compressPhoto, toWav } from '../utils/media';
import { todayString } from '../utils/dates';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../utils/media', () => ({ isPhone: jest.fn(), compressPhoto: jest.fn(), toWav: jest.fn() }));
// the polling itself is tested in utils/checkJob.test.js
jest.mock('../utils/checkJob', () => ({
  ...jest.requireActual('../utils/checkJob'),
  runCheck: async (start) => (await start()).data
}));

const usage = { restaurant: { limit: 3, remaining: 3 }, menu: { limit: 10, remaining: 10 }, voice: { limit: 20, remaining: 20 }, restaurant_by_name: true };

const dish = (name, verdict, extra = {}) => ({
  name, description: null, section: null, verdict, gluten_chance: { likely_gluten: 90, ask: 40, low_risk: 5, unknown: null }[verdict],
  reason: `${name} reason`, sources: [], questions: [], cautions: [], recipes: null, basis: 'ai', ...extra
});

const restaurantResult = {
  restaurant: { name: 'Sunny Thai', location: 'Pasadena, CA', menu_url: 'https://sunny.example/menu' },
  score: { total: 4, counts: { likely_gluten: 1, unknown: 0, ask: 1, low_risk: 2 }, ingredient_score: 50, cross_contact_cap: 40, overall_score: 40, capped: true },
  cross_contact: {
    level: 'high', summary: 'Shared fryer reported.', gf_menu: 'yes', dedicated_fryer: 'no',
    findings: [{ text: 'A diner reports a shared fryer.', tone: 'bad', source_url: 'https://fmgf.example/sunny' }]
  },
  dishes: [
    dish('Pad Thai', 'likely_gluten', {
      sources: ['soy sauce'], questions: ['Do you use tamari?'],
      recipes: { checked: 9, with_gluten: 6, percent: 67, examples: [{ title: 'Easy Pad Thai', url: 'https://r.example/1', gluten: ['soy sauce'] }] }
    }),
    dish('Green Curry', 'ask'),
    dish('Mango Sticky Rice', 'low_risk'),
    dish('Grilled Fish', 'low_risk')
  ],
  sources: [{ url: 'https://sunny.example/menu', label: 'Menu' }, { url: 'https://fmgf.example/sunny', label: 'Gluten-free info' }],
  disclaimer: 'Guidance only, not medical advice.',
  remaining: 2
};

function setup({ phone = false, user = { id: 1, name: 'Alice Smith', celiac_mode: true, celiac_strict: false }, usageData = usage } = {}) {
  isPhone.mockReturnValue(phone);
  axios.get.mockImplementation((url) => (url.startsWith('/api/gluten/usage')
    ? Promise.resolve({ data: usageData })
    : Promise.reject(new Error(`unexpected GET ${url}`))));
  return render(
    <AuthContext.Provider value={{ user, loading: false }}>
      <MemoryRouter><GlutenCheck /></MemoryRouter>
    </AuthContext.Provider>
  );
}

beforeEach(() => {
  jest.resetAllMocks();
  window.scrollTo = jest.fn();
});

describe('restaurant check', () => {
  it('on a computer shows only the restaurant check', async () => {
    setup();
    expect(await screen.findByText('3 new checks left today')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByText('Scan a menu')).not.toBeInTheDocument();
  });

  it('searches by name and shows the two-part score, sources and dishes', async () => {
    axios.post.mockResolvedValue({ status: 200, data: restaurantResult });
    setup();
    fireEvent.change(screen.getByLabelText('Restaurant'), { target: { value: 'Sunny Thai' } });
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Pasadena' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check gluten safety' }));

    const score = await screen.findByRole('region', { name: 'Gluten score' });
    expect(axios.post).toHaveBeenCalledWith('/api/gluten/restaurant', { name: 'Sunny Thai', city: 'Pasadena', local_date: todayString() });
    expect(within(score).getByText('40%')).toBeInTheDocument();
    expect(within(score).getByText('Gluten safety estimate')).toBeInTheDocument();
    expect(within(score).getByText(/capped at 40% because of the high cross-contact risk/)).toBeInTheDocument();
    expect(within(score).getByText('A diner reports a shared fryer.')).toBeInTheDocument();
    expect(within(score).getAllByRole('link', { name: 'Source' })[0]).toHaveAttribute('href', 'https://fmgf.example/sunny');
    expect(within(score).getByText('No', { selector: 'strong' })).toBeInTheDocument(); // no dedicated fryer
    expect(screen.getByText('2 new checks left today')).toBeInTheDocument();

    const list = screen.getByRole('list', { name: 'Dishes' });
    expect(within(list).getAllByText(/reason$/).map((el) => el.textContent)).toEqual([
      'Mango Sticky Rice reason', 'Grilled Fish reason', 'Green Curry reason', 'Pad Thai reason'
    ]);
    expect(within(list).getByText('90% chance of gluten')).toBeInTheDocument();
    expect(within(list).getByText(/published recipes for this dish use a gluten ingredient/)).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: 'Easy Pad Thai' })).toHaveAttribute('href', 'https://r.example/1');
    // computers don't get the voice button
    expect(within(list).queryByRole('button', { name: /Record what the server says/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Likely gluten' }));
    expect(within(screen.getByRole('list', { name: 'Dishes' })).getAllByText(/reason$/).map((el) => el.textContent)).toEqual(['Pad Thai reason']);
  });

  it('uses a menu link when name search is off', async () => {
    axios.post.mockResolvedValue({ status: 200, data: restaurantResult });
    setup({ usageData: { ...usage, restaurant_by_name: false } });
    expect(await screen.findByText(/Searching by name isn’t switched on yet/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Link to the menu'), { target: { value: 'https://sunny.example/menu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check gluten safety' }));
    await screen.findByRole('region', { name: 'Gluten score' });
    expect(axios.post).toHaveBeenCalledWith('/api/gluten/restaurant', { url: 'https://sunny.example/menu', local_date: todayString() });
  });

  it('shows the server’s error', async () => {
    axios.post.mockRejectedValue({ response: { status: 404, data: { error: "We couldn't find a menu for Nowhere." } } });
    setup();
    fireEvent.change(screen.getByLabelText('Restaurant'), { target: { value: 'Nowhere' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check gluten safety' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't find a menu for Nowhere.");
  });

  it('asks for a name before searching', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Check gluten safety' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter the restaurant’s name.');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('Strict mode shows "ask first" dishes as not safe', () => {
    expect(verdictLook('ask', false).label).toBe('Ask first');
    expect(verdictLook('ask', true)).toEqual({ tone: 'expired', label: 'Not safe in Strict mode: ask first' });
    expect(verdictLook('unknown', false).label).toBe('Unknown: assume gluten');
  });
});

describe('on a phone', () => {
  it('scans a menu photo, then records what the server says about a dish', async () => {
    const photo = new Blob(['jpeg'], { type: 'image/jpeg' });
    compressPhoto.mockResolvedValue(photo);
    axios.post.mockResolvedValueOnce({
      status: 200,
      data: {
        restaurant: { name: null },
        score: { total: 2, counts: { likely_gluten: 1, unknown: 0, ask: 1, low_risk: 0 }, ingredient_score: 0 },
        dishes: [dish('Chicken Katsu', 'likely_gluten', { description: 'Panko crusted' }), dish('Miso Soup', 'ask')],
        disclaimer: 'Guidance only.', remaining: 9
      }
    });
    setup({ phone: true });
    fireEvent.click(screen.getByRole('tab', { name: 'Menu photo' }));
    expect(await screen.findByText('10 left today')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Menu photo'), { target: { files: [new File(['x'], 'menu.jpg', { type: 'image/jpeg' })] } });

    const score = await screen.findByRole('region', { name: 'Gluten score' });
    expect(axios.post).toHaveBeenCalledWith(`/api/gluten/menu-photo?local_date=${todayString()}`, photo, { headers: { 'Content-Type': 'image/jpeg' } });
    expect(within(score).getByText('Ingredient score')).toBeInTheDocument();
    expect(within(score).getByText(/cross-contact isn’t rated here/)).toBeInTheDocument();
    expect(screen.getByText('9 left today')).toBeInTheDocument();

    // each dish can go straight to the voice check
    const katsu = screen.getByText('Chicken Katsu').closest('li');
    fireEvent.click(within(katsu).getByRole('button', { name: /Record what the server says/ }));
    expect(screen.getByRole('tab', { name: 'Ask the waiter' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Dish (optional)')).toHaveValue('Chicken Katsu');
  });

  it('records the server, sends a WAV, and shows what was heard', async () => {
    const track = { stop: jest.fn() };
    navigator.mediaDevices = { getUserMedia: jest.fn().mockResolvedValue({ getTracks: () => [track] }) };
    let recorder;
    window.MediaRecorder = jest.fn().mockImplementation(() => {
      recorder = {
        state: 'inactive', mimeType: 'audio/webm',
        start() { this.state = 'recording'; },
        stop() { this.state = 'inactive'; this.ondataavailable({ data: new Blob(['sound']) }); this.onstop(); }
      };
      return recorder;
    });
    const wav = new Blob(['wav'], { type: 'audio/wav' });
    toWav.mockResolvedValue(wav);
    axios.post.mockResolvedValue({
      data: {
        transcript: 'Marinated in soy sauce.', verdict: 'likely_gluten', reason: 'soy sauce: Regular soy sauce is brewed with wheat.',
        ingredients: [{ name: 'soy sauce', gluten_status: 'contains', gluten_reason: 'wheat' }, { name: 'chicken', gluten_status: 'gluten_free' }],
        preparation: [{ text: 'Cooked on the shared grill', risk: 'cross_contact' }],
        typical: null, disclaimer: 'Guidance only.', remaining: 19
      }
    });

    setup({ phone: true });
    fireEvent.click(screen.getByRole('tab', { name: 'Ask the waiter' }));
    fireEvent.change(screen.getByLabelText('Dish (optional)'), { target: { value: 'Teriyaki chicken' } });
    fireEvent.click(screen.getByRole('button', { name: '● Start recording' }));
    fireEvent.click(await screen.findByRole('button', { name: /Stop recording/ }));

    expect(await screen.findByText('Ingredients you heard')).toBeInTheDocument();
    const [url, body, config] = axios.post.mock.calls[0];
    expect(url).toBe(`/api/gluten/voice?local_date=${todayString()}&dish=Teriyaki+chicken`);
    expect(body).toBe(wav);
    expect(config).toEqual({ headers: { 'Content-Type': 'audio/wav' } });
    expect(track.stop).toHaveBeenCalled(); // the microphone is released
    expect(screen.getByText('Likely gluten')).toBeInTheDocument();
    expect(screen.getByText('Contains gluten')).toBeInTheDocument();
    expect(screen.getByText('Cooked on the shared grill')).toBeInTheDocument();
    expect(screen.getByText('19 left today')).toBeInTheDocument();
    delete window.MediaRecorder;
  });

  it('explains when the microphone is blocked', async () => {
    navigator.mediaDevices = { getUserMedia: jest.fn().mockRejectedValue(new Error('NotAllowedError')) };
    window.MediaRecorder = jest.fn();
    setup({ phone: true });
    fireEvent.click(screen.getByRole('tab', { name: 'Ask the waiter' }));
    fireEvent.click(screen.getByRole('button', { name: '● Start recording' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('needs the microphone');
    delete window.MediaRecorder;
  });
});

describe('navigation', () => {
  const nav = (user) => render(
    <AuthContext.Provider value={{ user, loading: false }}><MemoryRouter><AppNav /></MemoryRouter></AuthContext.Provider>
  );

  it('shows Gluten check only in Celiac Mode', () => {
    const { unmount } = nav({ id: 1, name: 'Alice', celiac_mode: false });
    expect(screen.queryByRole('link', { name: 'Gluten check' })).not.toBeInTheDocument();
    unmount();
    nav({ id: 1, name: 'Alice', celiac_mode: true });
    expect(screen.getByRole('link', { name: 'Gluten check' })).toHaveAttribute('href', '/gluten');
  });
});

it('waits for the usage before showing counts', async () => {
  setup();
  await waitFor(() => expect(axios.get).toHaveBeenCalledWith(`/api/gluten/usage?local_date=${todayString()}`));
});
