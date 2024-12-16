export function maskMap(data: any, fields?: string[]): any {
  const maskedData = { ...data };
  if (fields) {
    for (const field of fields) {
      if (maskedData[field]) {
        maskedData[field] = maskString(maskedData[field]);
      }
    }
  }
  return maskedData;
}
export function maskString(original: string, beginningIndex?: number, endIndex?: number) {
  const beginning = beginningIndex ? beginningIndex : original.length / 3;
  const end = endIndex ? endIndex : original.length - beginning;
  let masked = original;
  for (let i = beginning; i <= end; i++) {
    masked = masked.substring(0, i) + 'X' + masked.substring(i + 1, masked.length);
  }
  return masked;
}

export function maskObjectAttributes(original: any, attributes: string[] = []): any {
  const masked = Object.assign({}, original);
  for (const key of attributes) {
    if (masked[key]) {
      masked[key] = maskString(masked[key]);
    }
  }
  return masked;
}
