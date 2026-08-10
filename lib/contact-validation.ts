export function validateName(nameValue: string): boolean {
  return nameValue.trim().length >= 3;
}

export function validateEmail(emailValue: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue.trim());
}

export function validatePhone(phoneValue: string): boolean {
  const digits = phoneValue.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11;
}

export function validateSubject(subjectValue: string, options: Record<string, string>): boolean {
  return Boolean(subjectValue) && Object.prototype.hasOwnProperty.call(options, subjectValue);
}

export function formatPhoneBr(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) {
    return digits;
  }

  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);

  if (rest.length <= 4) {
    return `(${ddd}) ${rest}`.trim();
  }

  if (rest.length <= 8) {
    return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }

  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}
