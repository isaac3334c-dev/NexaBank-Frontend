// Generic ITU-T E.123 presentation: group the national number into clusters
// of 2-3 digits separated by spaces (E.123 §5.2.1), since the exact grouping
// rule differs per country and this app doesn't carry a full numbering-plan
// database. "+51 987 654 321" is the resulting shape for a 9-digit number.
export function formatE123National(digits: string): string {
  const groups: string[] = [];
  let i = 0;
  while (i < digits.length) {
    const remaining = digits.length - i;
    const size = remaining > 4 || remaining === 3 ? 3 : remaining;
    groups.push(digits.slice(i, i + size));
    i += size;
  }
  return groups.join(' ');
}

export function formatE123(dialCode: string, nationalDigits: string): string {
  return `+${dialCode} ${formatE123National(nationalDigits)}`.trim();
}
