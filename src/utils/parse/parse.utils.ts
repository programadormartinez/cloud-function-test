import { stringify } from "querystring";

export function changeTimestampsToDate(obj: any): any {
  if (!obj) {
    return obj;
  }
  const changedObject = Object.assign({}, obj);
  Object.keys(obj).forEach((key) => {
    if (obj[key] && typeof obj[key] === 'object') {
      if (obj[key].constructor.name === 'Date') {
        return;
      } else if (obj[key].constructor.name === 'Array') {
        changedObject[key] = obj[key];
      } else if (obj[key].constructor.name === 'Timestamp') {
        changedObject[key] = obj[key].toDate();
      } else {
        changedObject[key] = changeTimestampsToDate(obj[key]);
      }
    }
  });
  return changedObject;
}
export function changeTimestampsToDateISOString(obj: any): any {
  if (!obj) {
    return obj;
  }
  const changedObject = Object.assign({}, obj);
  Object.keys(obj).forEach((key) => {
    if (obj[key] && typeof obj[key] === 'object') {
      if (obj[key].constructor.name === 'Array') {
        changedObject[key] = obj[key];
      } else if (obj[key].constructor.name === 'Date') {
        changedObject[key] = obj[key].toISOString();
      } else if (obj[key].constructor.name === 'Timestamp') {
        changedObject[key] = obj[key].toDate().toISOString();
      } else {
        changedObject[key] = changeTimestampsToDateISOString(obj[key]);
      }
    }
  });
  return changedObject;
}

/**
 * Replaces all accented chars with regular ones
 */
export function replaceAccents(str: string) {
  if (!str) {
    return str;
  }
  let newString = str;
  // Verifies if the String has accents and replace them
  if (str.search(/[\xC0-\xFF]/g) > -1) {
    newString = str
      .replace(/[\xC0-\xC5]/g, 'A')
      .replace(/[\xC6]/g, 'AE')
      .replace(/[\xC7]/g, 'C')
      .replace(/[\xC8-\xCB]/g, 'E')
      .replace(/[\xCC-\xCF]/g, 'I')
      .replace(/[\xD0]/g, 'D')
      .replace(/[\xD1]/g, 'N')
      .replace(/[\xD2-\xD6\xD8]/g, 'O')
      .replace(/[\xD9-\xDC]/g, 'U')
      .replace(/[\xDD]/g, 'Y')
      .replace(/[\xDE]/g, 'P')
      .replace(/[\xE0-\xE5]/g, 'a')
      .replace(/[\xE6]/g, 'ae')
      .replace(/[\xE7]/g, 'c')
      .replace(/[\xE8-\xEB]/g, 'e')
      .replace(/[\xEC-\xEF]/g, 'i')
      .replace(/[\xF1]/g, 'n')
      .replace(/[\xF2-\xF6\xF8]/g, 'o')
      .replace(/[\xF9-\xFC]/g, 'u')
      .replace(/[\xFE]/g, 'p')
      .replace(/[\xFD\xFF]/g, 'y');
  }
  return newString;
}

export function removeCircularDependencies(data: any): any {
  if (!data) {
    return data;
  }
  return JSON.parse(stringify(data));
}

export function removeMetadata(obj: any): any {
  if (!obj) {
    return obj;
  }
  const changedObject = Object.assign({}, obj);
  Object.keys(obj).forEach((key) => {
    if (typeof(key) === 'string' && key.charAt(0) === '_') {
      delete changedObject[key];
    }
  });
  return changedObject;
}

/**
 * Remove all special characters and white spaces
 */
export function removeStrangeCharactersAndWhiteSpaces(str: string) {
  if (!str) {
    return str;
  }
  let newString = replaceAccents(str);
  newString = newString.replace(/[^A-Z0-9]+/ig, '');
  return newString;
}
