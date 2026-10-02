import { extractItemLines } from './receiptText';

const walmart = `
Walmart
Save money. Live better.
( 555 ) 123 - 4567
MANAGER JANE DOE
1234 MAIN ST
SPRINGFIELD IL 62704
ST# 01234 OP# 009 TE# 07 TR# 01234
GV 2% MLK GAL 007874235187 F 3.48 N
BNLS CHKN THGH 022515000000 F 7.92 N
BANANAS 000000004011KF
3.21 lb @ 0.58 /lb 1.86 N
BOUNTY PPR TWL 003700074672 4.97 X
STRWBRY 1LB 003338320027 F 2.98 N
SUBTOTAL 21.21
TAX 1 7.000 % 0.35
TOTAL 21.56
VISA TEND 21.56
VISA CREDIT **** **** **** 4821
APPROVAL # 08812C
REF # 412300012345
AID A0000000031010
TERMINAL # SC010185
10/01/26 18:42:17
CHANGE DUE 0.00
# ITEMS SOLD 5
TC# 1234 5678 9012 3456 7890
Thank you for shopping
www.walmart.com
Questions? help@walmart.com
`;

const traderJoes = `
TRADER JOE'S
611 N Larrabee St
Chicago IL 60654
OPEN 8:00AM TO 9:00PM DAILY
STORE #706 - (312) 951-6369
SALES TRANSACTION
ORGANIC BABY SPINACH 2.49
GREEK YOGURT PLAIN 4.99
2 @ 1.29
AVOCADOS HASS 2.58
COUPON SAVINGS -1.00
Items in Transaction:3
Balance to pay 9.06
Visa Debit 9.06
CARD NO: XXXXXXXXXXXX9917
CHIP READ
Customer Copy
`;

it('keeps item lines and strips barcodes and prices', () => {
  const { lines } = extractItemLines(walmart);
  expect(lines).toEqual([
    'GV 2% MLK GAL',
    'BNLS CHKN THGH',
    'BANANAS 3.21 lb',
    'BOUNTY PPR TWL',
    'STRWBRY 1LB'
  ]);
});

it('drops card, payment, totals, store, address, phone, dates and receipt numbers', () => {
  const sent = extractItemLines(walmart).lines.join('\n');
  for (const secret of ['4821', 'VISA', 'APPROVAL', '412300012345', 'A0000000031010', 'TOTAL', 'TAX', 'MAIN ST', '62704', '555', '10/01/26', '1234 5678', 'walmart.com', 'help@', 'JANE']) {
    expect(sent).not.toContain(secret);
  }
});

it('handles another layout: debit card, coupons and multi-buy lines', () => {
  const { lines } = extractItemLines(traderJoes);
  expect(lines).toEqual(['ORGANIC BABY SPINACH', 'GREEK YOGURT PLAIN', 'AVOCADOS HASS']);
  expect(lines.join(' ')).not.toMatch(/9917|Larrabee|60654|951|Visa|COUPON/i);
});

it('copes with empty or messy input', () => {
  expect(extractItemLines('').lines).toEqual([]);
  expect(extractItemLines(null).lines).toEqual([]);
  expect(extractItemLines('~~~ ### \n 12.99 \n ab 1.00').lines).toEqual([]);
});

it('caps how much is sent', () => {
  const many = Array.from({ length: 100 }, (_, i) => `ITEM NUMBER ${String.fromCharCode(65 + (i % 26))}${i} 1.99`).join('\n');
  expect(extractItemLines(many).lines).toHaveLength(60);
});

it("doesn't mistake groceries for payment words", () => {
  const text = ['CASHEWS 6.99', 'CARDAMOM PODS 4.49', 'PINEAPPLE CHUNKS 2.99', 'TORTILLA CHIPS 3.49', 'TAPIOCA PEARLS 2.29', 'CHANGE DUE 0.00', 'CASH 20.00'].join('\n');
  expect(extractItemLines(text).lines).toEqual(['CASHEWS', 'CARDAMOM PODS', 'PINEAPPLE CHUNKS', 'TORTILLA CHIPS', 'TAPIOCA PEARLS']);
});

it('understands weights the way photographed text often reads them', () => {
  const text = ['BANANAS 000000004011KF', '3.21 1b @ 0.58 /1b 1.86 N', 'GRAPES RED', '2.5 ib @ 2.99 /ib 7.48', 'ALMONDS', '12 0z @ 0.50 6.00'].join('\n');
  expect(extractItemLines(text).lines).toEqual(['BANANAS 3.21 lb', 'GRAPES RED 2.5 lb', 'ALMONDS 12 oz']);
});
