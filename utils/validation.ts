const COUNTRY_CALLING_CODES = new Set([
  "1", "7", "20", "27", "30", "31", "32", "33", "34", "36", "39", "40", "41", "43", "44", "45", "46", "47", "48", "49",
  "51", "52", "53", "54", "55", "56", "57", "58", "60", "61", "62", "63", "64", "65", "66", "81", "82", "84", "86",
  "90", "91", "92", "93", "94", "95", "98", "211", "212", "213", "216", "218", "220", "221", "222", "223", "224",
  "225", "226", "227", "228", "229", "230", "231", "232", "233", "234", "235", "236", "237", "238", "239", "240",
  "241", "242", "243", "244", "245", "246", "248", "249", "250", "251", "252", "253", "254", "255", "256", "257",
  "258", "260", "261", "262", "263", "264", "265", "266", "267", "268", "269", "290", "291", "297", "298", "299",
  "350", "351", "352", "353", "354", "355", "356", "357", "358", "359", "370", "371", "372", "373", "374", "375",
  "376", "377", "378", "380", "381", "382", "383", "385", "386", "387", "389", "420", "421", "423", "500", "501",
  "502", "503", "504", "505", "506", "507", "508", "509", "590", "591", "592", "593", "594", "595", "596", "597",
  "598", "599", "670", "672", "673", "674", "675", "676", "677", "678", "679", "680", "681", "682", "683", "685",
  "686", "687", "688", "689", "690", "691", "692", "850", "852", "853", "855", "856", "880", "886", "960", "961",
  "962", "963", "964", "965", "966", "967", "968", "970", "971", "972", "973", "974", "975", "976", "977", "992",
  "993", "994", "995", "996", "998",
]);

const NATIONAL_LENGTHS_BY_CODE: Record<string, number[]> = {
  "1": [10],
  "44": [10],
  "61": [9],
  "81": [10],
  "86": [11],
  "91": [10],
  "971": [9],
};

function extractCountryCode(digits: string): string | null {
  for (let size = Math.min(3, digits.length); size >= 1; size -= 1) {
    const code = digits.slice(0, size);
    if (COUNTRY_CALLING_CODES.has(code)) return code;
  }
  return null;
}

export function validatePhoneNumber(phone: string): string | null {
  const value = phone.trim();
  const digits = value.replace(/\D/g, "");

  if (!value) return "Phone number is required.";
  if (value.startsWith("+")) {
    const countryCode = extractCountryCode(digits);
    if (!countryCode) return "Please enter a valid country code.";

    const nationalNumber = digits.slice(countryCode.length);
    const expectedLengths = NATIONAL_LENGTHS_BY_CODE[countryCode];
    if (expectedLengths && !expectedLengths.includes(nationalNumber.length)) {
      return `Please enter a valid phone number for country code +${countryCode}.`;
    }
    if (nationalNumber.length < 4) return `Phone number is too short for country code +${countryCode}.`;
    if (digits.length > 15) return "Phone number is too long.";
    return null;
  }

  if (digits.length < 7) return "Please enter a valid phone number (at least 7 digits).";
  if (digits.length > 15) return "Phone number is too long.";
  return null;
}

export function validateOptionalPhoneNumber(phone: string): string | null {
  return phone.trim() ? validatePhoneNumber(phone) : null;
}

export function validateEmailAddress(email: string): string | null {
  if (!email.trim()) return "Email address is required.";
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  return valid ? null : "Please enter a valid email address.";
}

export function validateOptionalEmailAddress(email: string): string | null {
  return email.trim() ? validateEmailAddress(email) : null;
}
