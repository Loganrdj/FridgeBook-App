// Second line of defense for receipt lines (the browser filters first): never
// pass anything that looks like a card, account or contact detail to Gemini,
// even if a client sends it.
const CARD_MASK = /(?:[*xX#•]\s*){2,}\d{2,4}/;
const LONG_NUMBER = /\d{8,}/;
const SPACED_NUMBER = /\b\d{4}(?:[ -]\d{4}){2,}\b/;
const PHONE = /\(?\b\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/;
const EMAIL = /\S+@\S+\.\S+/;
// whole words only, so CASHEWS, CARDAMOM, PINEAPPLE or TORTILLA CHIPS still get through
const PAYMENT = /\b(visa|master\s*card|amex|american express|discover|debit|credit|card|card no|acct|account|auth|authorization|authorized|approval|approved|appr|terminal|chip read|chip card|pin|aid|ref\s*#|transaction|trans id|tran id)(?![a-z])/i;

function isSafeLine(line) {
  return !(CARD_MASK.test(line) || LONG_NUMBER.test(line) || SPACED_NUMBER.test(line) ||
    PHONE.test(line) || EMAIL.test(line) || PAYMENT.test(line));
}

module.exports = { isSafeLine };
