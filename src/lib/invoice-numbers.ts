const DEFAULT_SEQUENCE_WIDTH = 4;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function nextInvoiceNumberFromExisting(
  invoiceNumbers: string[],
  prefix: string,
  year: number,
  offset = 0
) {
  const stem = `${prefix}${year}-`;
  const matcher = new RegExp(`^${escapeRegExp(stem)}(\\d+)$`);
  let highestSequence = 0;

  for (const invoiceNumber of invoiceNumbers) {
    const match = matcher.exec(invoiceNumber);
    if (!match) continue;

    const sequence = Number(match[1]);
    if (Number.isSafeInteger(sequence) && sequence > highestSequence) {
      highestSequence = sequence;
    }
  }

  const sequence = highestSequence + 1 + offset;
  return `${stem}${String(sequence).padStart(DEFAULT_SEQUENCE_WIDTH, "0")}`;
}
