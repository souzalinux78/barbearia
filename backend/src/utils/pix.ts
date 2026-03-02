export const normalizePixKey = (rawKey: string): string => {
  const value = rawKey.trim();
  if (!value) {
    return "";
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailPattern.test(value)) {
    return value.toLowerCase();
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(value)) {
    return value.toLowerCase();
  }

  const digitsOnly = value.replace(/\D/g, "");
  if (digitsOnly.length === 10 || digitsOnly.length === 11) {
    return `+55${digitsOnly}`;
  }
  if ((digitsOnly.length === 12 || digitsOnly.length === 13) && digitsOnly.startsWith("55")) {
    return `+${digitsOnly}`;
  }
  if (digitsOnly.length === 11 || digitsOnly.length === 14) {
    return digitsOnly;
  }
  if (/^\+\d{10,15}$/.test(value)) {
    return value;
  }

  return value;
};

export const isValidPixKey = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ||
  /^\+\d{10,15}$/.test(value) ||
  /^\d{11}$/.test(value) ||
  /^\d{14}$/.test(value) ||
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const emvField = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

const crc16Ccitt = (payload: string): string => {
  let crc = 0xffff;
  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
};

export const sanitizeMerchantText = (value: string, maxLength: number, fallback: string): string => {
  const sanitized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, maxLength);
  return sanitized || fallback;
};

export const buildPixCopyPasteCode = (input: {
  pixKey: string;
  amount: number;
  txid: string;
  merchantName: string;
  merchantCity: string;
}) => {
  const merchantAccountInfo = emvField(
    "26",
    `${emvField("00", "BR.GOV.BCB.PIX")}${emvField("01", input.pixKey)}`
  );
  const additionalData = emvField("62", emvField("05", input.txid.slice(0, 25)));

  const payloadWithoutCRC = [
    emvField("00", "01"),
    merchantAccountInfo,
    emvField("52", "0000"),
    emvField("53", "986"),
    emvField("54", input.amount.toFixed(2)),
    emvField("58", "BR"),
    emvField("59", input.merchantName),
    emvField("60", input.merchantCity),
    additionalData,
    "6304"
  ].join("");

  return `${payloadWithoutCRC}${crc16Ccitt(payloadWithoutCRC)}`;
};
