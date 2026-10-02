// Turns the raw text read from a receipt photo into item lines worth sending for
// clean-up, and drops everything that could be personal: card and account
// details, totals and payments, store address and phone, dates, and long
// numbers (card digits, barcodes). Runs in the browser, before anything leaves
// the device.

const MAX_LINES = 60;

// Lines about money, payment or the store rather than a purchased item
// Whole words and phrases only, so groceries like CASHEWS, CARDAMOM, PINEAPPLE,
// TAPIOCA or TORTILLA CHIPS aren't mistaken for "cash", "card", "pin" and so on.
const NOT_AN_ITEM = new RegExp('\\b(' + [
  'sub\\s*-?\\s*total', 'total', 'tax', 'taxes', 'balance', 'balance due', 'change', 'change due', 'cash', 'tender', 'tendered',
  'payment', 'paid', 'amount', 'visa', 'master\\s*card', 'amex', 'american express', 'discover', 'debit', 'credit', 'card', 'card no',
  'acct', 'account', 'auth', 'authorization', 'authorized', 'approval', 'approved', 'appr', 'ref', 'reference', 'terminal', 'term id',
  'trans', 'transaction', 'tran id', 'chip read', 'chip card', 'pin', 'pin verified', 'aid', 'contactless',
  'member', 'members', 'reward', 'rewards', 'points', 'savings', 'you saved', 'coupon', 'discount', 'promo',
  'thank', 'thanks', 'welcome', 'store #', 'store no', 'store number', 'cashier', 'register', 'receipt', 'survey', 'feedback',
  'return', 'returns', 'refund', 'items sold', 'item count', '# items', 'manager', 'hours', 'open daily'
].join('|') + ')(?![a-z])', 'i');

const CARD_MASK = /(?:[*xX#•]\s*){2,}\d{2,4}/; // ****1234, XXXX 1234
const PHONE = /\(?\b\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/;
const DATE = /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/;
const TIME = /\b\d{1,2}:\d{2}(?::\d{2})?\s*(am|pm)?\b/i;
const STREET = /^\s*\d{1,6}\s+[a-z0-9 .]+\b(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way|hwy|highway|pkwy|parkway|ct|court|pl|place|suite|ste)\b/i;
const STATE_ZIP = /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/;
const WEB = /(www\.|https?:|\.com\b|\.net\b|\S+@\S+\.\S+)/i; // sites and email addresses (not "3 @ 1.29")
const LONG_NUMBER = /\d{8,}/g; // barcodes and other long numbers
const SPACED_NUMBER = /\b\d{4}(?:[ -]\d{4}){2,}\b/g; // 1234 5678 9012 3456
const TRAILING_CODES = /(?:\s+[A-Z]{1,2})+$/; // tax/department flags like " F" or " KF"
const PRICE_AT_END = /(-?\$?\s?\d{1,4}[.,]\d{2})\s*-?\s*[A-Z*]{0,3}\s*$/;
// Units as photographed text often reads them: "lb" comes out as "1b" or "ib", "oz" as "0z"
const WEIGHT = /\b\d+(?:[.,]\d+)?\s*(lbs?|1bs?|ibs?|kg|oz|0z|g)\b/i;
const UNITS = /\b(lbs?|1bs?|ibs?|kg|oz|0z|g)\b/gi;
const normalizeUnit = (text) => text.replace(/\b(\d+(?:[.,]\d+)?)\s*(?:1|i)(bs?)\b/i, '$1 l$2').replace(/\b(\d+(?:[.,]\d+)?)\s*0z\b/i, '$1 oz');

const letters = (s) => (s.match(/[a-z]/gi) || []).length;

function isPersonalOrStoreInfo(line) {
  return CARD_MASK.test(line) || PHONE.test(line) || DATE.test(line) || TIME.test(line) ||
    STREET.test(line) || STATE_ZIP.test(line) || WEB.test(line);
}

function clean(line) {
  return line.replace(SPACED_NUMBER, ' ').replace(LONG_NUMBER, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Returns { lines, dropped }: lines are cleaned item descriptions (prices and
 * barcodes removed), in receipt order; dropped counts every other line.
 */
export function extractItemLines(text) {
  const raw = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const lines = [];
  let pending = null; // an item name whose price is on the next (weight) line

  for (const original of raw) {
    if (isPersonalOrStoreInfo(original) || NOT_AN_ITEM.test(original)) {
      pending = null;
      continue;
    }
    const line = clean(original);
    const price = line.match(PRICE_AT_END);
    const name = (price ? line.slice(0, price.index) : line).replace(TRAILING_CODES, '').trim();
    const isNegative = price && price[1].includes('-');

    if (price && WEIGHT.test(name) && letters(name.replace(UNITS, '').replace(/\bper\b/gi, '')) < 2) {
      // "3.21 lb @ 0.58 /lb 1.86" belongs to the item named on the line before
      if (pending) lines.push(`${pending} ${normalizeUnit(name.match(WEIGHT)[0])}`);
      pending = null;
      continue;
    }
    if (price && !isNegative && letters(name) >= 3) {
      if (pending) pending = null;
      lines.push(name.slice(0, 100));
    } else if (!price && letters(name) >= 3) {
      pending = name.slice(0, 100);
    } else {
      pending = null;
    }
    if (lines.length >= MAX_LINES) break;
  }
  return { lines, dropped: raw.length - lines.length };
}
