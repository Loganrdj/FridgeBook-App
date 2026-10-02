import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route } from 'react-router-dom';
import axios from 'axios';
import { createWorker } from 'tesseract.js';
import ReceiptScan from './ReceiptScan';
import { GlobalContext } from '../context/GlobalState';
import { todayString } from '../utils/dates';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('tesseract.js', () => ({ createWorker: jest.fn() }));

const RECEIPT_TEXT = [
  'WALMART', '1234 MAIN ST', 'GV 2% MLK GAL 007874235187 F 3.48 N', 'BNLS CHKN THGH 022515000000 F 7.92 N',
  'BOUNTY PPR TWL 003700074672 4.97 X', 'TOTAL 16.37', 'VISA CREDIT **** 4821', '10/01/26 18:42'
].join('\n');

const parsed = {
  lines: ['GV 2% MLK GAL', 'BNLS CHKN THGH', 'BOUNTY PPR TWL'],
  remaining: 9,
  items: [
    { name: 'Milk (2%)', quantity: 1, fridge_bool: true, frozen: false, date_expire: '2026-10-09', confident: true, line: 0 },
    { name: 'Chicken thighs', quantity: 2, fridge_bool: true, frozen: false, date_expire: '2026-10-04', confident: false, line: 1 }
  ]
};

let worker;
beforeEach(() => {
  jest.clearAllMocks();
  worker = { recognize: jest.fn().mockResolvedValue({ data: { text: RECEIPT_TEXT } }), terminate: jest.fn().mockResolvedValue() };
  createWorker.mockResolvedValue(worker);
  axios.get.mockResolvedValue({ data: { limit: 10, remaining: 10 } });
  global.URL.createObjectURL = jest.fn(() => 'blob:receipt');
  global.URL.revokeObjectURL = jest.fn();
  // jsdom never loads images, so fake a loaded photo
  global.Image = class { set src(v) { this.width = 1200; this.height = 3000; setTimeout(() => this.onload()); } };
});

function setup(overrides = {}) {
  const value = { addIngredients: jest.fn().mockResolvedValue(2), ...overrides };
  render(
    <GlobalContext.Provider value={value}>
      <MemoryRouter initialEntries={['/scan']}>
        <Route path="/scan" component={ReceiptScan} />
        <Route path="/kitchen" render={() => <p>Kitchen page</p>} />
      </MemoryRouter>
    </GlobalContext.Provider>
  );
  return value;
}

const choosePhoto = () => fireEvent.change(screen.getByLabelText(/Take or choose a photo/), {
  target: { files: [new File(['jpg'], 'receipt.jpg', { type: 'image/jpeg' })] }
});

it('explains privacy and shows scans left', async () => {
  setup();
  expect(await screen.findByText('10 scans left today')).toBeInTheDocument();
  expect(screen.getByText(/Your photo stays on this device/)).toBeInTheDocument();
});

it('reads on the device, sends only item lines, then lets you review', async () => {
  axios.post.mockResolvedValue({ data: parsed });
  setup();
  choosePhoto();
  await screen.findByRole('heading', { name: /Check what we found/ });

  expect(worker.recognize).toHaveBeenCalled();
  expect(worker.terminate).toHaveBeenCalled();
  expect(axios.post).toHaveBeenCalledWith('/api/receipts/parse', { lines: ['GV 2% MLK GAL', 'BNLS CHKN THGH', 'BOUNTY PPR TWL'], local_date: todayString() });
  const sent = JSON.stringify(axios.post.mock.calls[0][1]);
  for (const secret of ['4821', 'VISA', 'MAIN ST', 'TOTAL', '10/01/26', '007874235187']) expect(sent).not.toContain(secret);

  expect(screen.getByDisplayValue('Milk (2%)')).toBeInTheDocument();
  expect(screen.getAllByText('Check this')).toHaveLength(1);
});

it('adds the reviewed items, with edits and exclusions, then goes to the kitchen', async () => {
  axios.post.mockResolvedValue({ data: parsed });
  const { addIngredients } = setup();
  choosePhoto();
  await screen.findByRole('heading', { name: /Check what we found/ });

  fireEvent.change(screen.getByDisplayValue('Chicken thighs'), { target: { value: 'Boneless chicken thighs' } });
  fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Where Boneless chicken thighs goes' })).getByLabelText('Pantry'));
  fireEvent.click(screen.getByLabelText('Include Milk (2%)'));
  fireEvent.click(screen.getByRole('button', { name: 'Add 1 to kitchen' }));

  await screen.findByText('Kitchen page');
  expect(addIngredients).toHaveBeenCalledWith([{ name: 'Boneless chicken thighs', quantity: 2, date_expire: '2026-10-04', fridge_bool: false }]);
});

it('says so when no items can be read, without calling the server', async () => {
  worker.recognize.mockResolvedValue({ data: { text: 'TOTAL 12.00\nVISA **** 1234\nTHANK YOU' } });
  setup();
  choosePhoto();
  expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't find any items/);
  expect(axios.post).not.toHaveBeenCalled();
});

it('shows the daily limit message', async () => {
  axios.post.mockRejectedValue({ response: { status: 429, data: { error: "You've used all 10 receipt scans for today. They reset at midnight.", remaining: 0 } } });
  setup();
  choosePhoto();
  expect(await screen.findByRole('alert')).toHaveTextContent('used all 10 receipt scans');
  await waitFor(() => expect(screen.getByText('0 scans left today')).toBeInTheDocument());
});
