const VERSION = 4;
const SIZE = 17 + VERSION * 4;
const DATA_CODEWORDS = 80;
const ECC_CODEWORDS = 20;
const MASK = 0;

export function renderQrToCanvas(text: string, canvas: HTMLCanvasElement) {
  const matrix = makeQr(text);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const quiet = 4;
  const modules = matrix.length + quiet * 2;
  const scale = Math.max(1, Math.floor(Math.min(canvas.width, canvas.height) / modules));
  const drawn = modules * scale;
  const left = Math.floor((canvas.width - drawn) / 2);
  const top = Math.floor((canvas.height - drawn) / 2);

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#f7edd0";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#151006";
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix.length; x++) {
      if (!matrix[y][x]) continue;
      ctx.fillRect(left + (x + quiet) * scale, top + (y + quiet) * scale, scale, scale);
    }
  }
}

function makeQr(text: string) {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > 74) throw new Error("QR payload is too long");

  const data = encodeData(bytes);
  const ecc = reedSolomonRemainder(data, reedSolomonDivisor(ECC_CODEWORDS));
  const codewords = [...data, ...ecc];
  const modules = Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false));
  const reserved = Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false));

  const set = (x: number, y: number, dark: boolean, reserve = true) => {
    modules[y][x] = dark;
    if (reserve) reserved[y][x] = true;
  };

  drawFinder(set, 0, 0);
  drawFinder(set, SIZE - 7, 0);
  drawFinder(set, 0, SIZE - 7);
  drawTiming(set, reserved);
  drawAlignment(set, 26, 26);
  reserveFormat(reserved);
  set(8, 4 * VERSION + 9, true);
  drawData(modules, reserved, codewords);
  drawFormat(set);
  return modules;
}

function encodeData(bytes: Uint8Array) {
  const bits: number[] = [];
  appendBits(bits, 0x4, 4);
  appendBits(bits, bytes.length, 8);
  for (const byte of bytes) appendBits(bits, byte, 8);

  const capacity = DATA_CODEWORDS * 8;
  appendBits(bits, 0, Math.min(4, capacity - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    data.push(bits.slice(i, i + 8).reduce((value, bit) => (value << 1) | bit, 0));
  }
  for (let pad = 0xec; data.length < DATA_CODEWORDS; pad ^= 0xfd) data.push(pad);
  return data;
}

function appendBits(bits: number[], value: number, length: number) {
  for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
}

function drawFinder(
  set: (x: number, y: number, dark: boolean, reserve?: boolean) => void,
  left: number,
  top: number,
) {
  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 7; dx++) {
      const x = left + dx;
      const y = top + dy;
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
      const inMark = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
      const border = dx === 0 || dx === 6 || dy === 0 || dy === 6;
      const center = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
      set(x, y, inMark && (border || center));
    }
  }
}

function drawTiming(
  set: (x: number, y: number, dark: boolean, reserve?: boolean) => void,
  reserved: boolean[][],
) {
  for (let i = 0; i < SIZE; i++) {
    const dark = i % 2 === 0;
    if (!reserved[6][i]) set(i, 6, dark);
    if (!reserved[i][6]) set(6, i, dark);
  }
}

function drawAlignment(
  set: (x: number, y: number, dark: boolean, reserve?: boolean) => void,
  cx: number,
  cy: number,
) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      set(cx + dx, cy + dy, distance !== 1);
    }
  }
}

function reserveFormat(reserved: boolean[][]) {
  const reserve = (x: number, y: number) => {
    reserved[y][x] = true;
  };
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      reserve(8, i);
      reserve(i, 8);
    }
  }
  for (let i = 0; i < 8; i++) reserve(SIZE - 1 - i, 8);
  for (let i = 0; i < 7; i++) reserve(8, SIZE - 1 - i);
  reserve(8, SIZE - 8);
}

function drawData(modules: boolean[][], reserved: boolean[][], codewords: number[]) {
  const bits = codewords.flatMap((codeword) =>
    Array.from({ length: 8 }, (_, i) => (codeword >>> (7 - i)) & 1),
  );
  let bitIndex = 0;
  let upward = true;

  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right--;
    for (let vert = 0; vert < SIZE; vert++) {
      const y = upward ? SIZE - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        if (reserved[y][x]) continue;
        let dark = bitIndex < bits.length ? bits[bitIndex] === 1 : false;
        if ((x + y) % 2 === 0) dark = !dark;
        modules[y][x] = dark;
        bitIndex++;
      }
    }
    upward = !upward;
  }
}

function drawFormat(set: (x: number, y: number, dark: boolean, reserve?: boolean) => void) {
  const bits = formatBits(MASK);
  const bit = (i: number) => ((bits >>> i) & 1) !== 0;

  for (let i = 0; i <= 5; i++) set(8, i, bit(i));
  set(8, 7, bit(6));
  set(8, 8, bit(7));
  set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));

  for (let i = 0; i < 8; i++) set(SIZE - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) set(8, SIZE - 15 + i, bit(i));
  set(8, SIZE - 8, true);
}

function formatBits(mask: number) {
  const data = (1 << 3) | mask;
  let remainder = data << 10;
  for (let i = 14; i >= 10; i--) {
    if (((remainder >>> i) & 1) !== 0) remainder ^= 0x537 << (i - 10);
  }
  return (((data << 10) | remainder) ^ 0x5412) & 0x7fff;
}

function reedSolomonDivisor(degree: number) {
  const result = Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function reedSolomonRemainder(data: number[], divisor: number[]) {
  const result = Array<number>(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift()!;
    result.push(0);
    for (let i = 0; i < divisor.length; i++) {
      result[i] ^= gfMultiply(divisor[i], factor);
    }
  }
  return result;
}

function gfMultiply(x: number, y: number) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}
