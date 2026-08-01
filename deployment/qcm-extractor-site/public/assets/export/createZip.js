const UTF8_FLAG = 0x0800;
const ZIP_VERSION = 20;
const MAX_UINT16 = 0xffff;
const MAX_UINT32 = 0xffffffff;
const CRC32_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
        let value = index;
        for (let bit = 0; bit < 8; bit += 1) {
            value = (value & 1) !== 0 ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
        }
        table[index] = value >>> 0;
    }
    return table;
})();
function crc32(bytes) {
    let value = 0xffffffff;
    for (const byte of bytes) {
        value = (CRC32_TABLE[(value ^ byte) & 0xff] ?? 0) ^ (value >>> 8);
    }
    return (value ^ 0xffffffff) >>> 0;
}
function safeEntryName(name) {
    const normalized = name.replaceAll("\\", "/").replace(/^\/+/, "");
    if (normalized.length === 0 ||
        normalized.endsWith("/") ||
        normalized.split("/").some((part) => part === "" || part === "." || part === "..")) {
        throw new Error(`Nom de fichier ZIP invalide : ${name}`);
    }
    return normalized;
}
async function toBytes(data) {
    if (typeof data === "string")
        return new TextEncoder().encode(data);
    if (data instanceof Uint8Array)
        return new Uint8Array(data);
    if (data instanceof ArrayBuffer)
        return new Uint8Array(data.slice(0));
    return new Uint8Array(await data.arrayBuffer());
}
function dosTimestamp(date) {
    const year = Math.min(2107, Math.max(1980, date.getFullYear()));
    return {
        time: ((date.getHours() & 0x1f) << 11) |
            ((date.getMinutes() & 0x3f) << 5) |
            ((Math.floor(date.getSeconds() / 2)) & 0x1f),
        date: (((year - 1980) & 0x7f) << 9) |
            (((date.getMonth() + 1) & 0x0f) << 5) |
            (date.getDate() & 0x1f)
    };
}
function uint16(view, offset, value) {
    view.setUint16(offset, value, true);
}
function uint32(view, offset, value) {
    view.setUint32(offset, value >>> 0, true);
}
function localHeader(entry) {
    const bytes = new Uint8Array(30 + entry.nameBytes.length);
    const view = new DataView(bytes.buffer);
    uint32(view, 0, 0x04034b50);
    uint16(view, 4, ZIP_VERSION);
    uint16(view, 6, UTF8_FLAG);
    uint16(view, 8, 0);
    uint16(view, 10, entry.dosTime);
    uint16(view, 12, entry.dosDate);
    uint32(view, 14, entry.crc32);
    uint32(view, 18, entry.data.byteLength);
    uint32(view, 22, entry.data.byteLength);
    uint16(view, 26, entry.nameBytes.length);
    uint16(view, 28, 0);
    bytes.set(entry.nameBytes, 30);
    return bytes;
}
function centralHeader(entry) {
    const bytes = new Uint8Array(46 + entry.nameBytes.length);
    const view = new DataView(bytes.buffer);
    uint32(view, 0, 0x02014b50);
    uint16(view, 4, ZIP_VERSION);
    uint16(view, 6, ZIP_VERSION);
    uint16(view, 8, UTF8_FLAG);
    uint16(view, 10, 0);
    uint16(view, 12, entry.dosTime);
    uint16(view, 14, entry.dosDate);
    uint32(view, 16, entry.crc32);
    uint32(view, 20, entry.data.byteLength);
    uint32(view, 24, entry.data.byteLength);
    uint16(view, 28, entry.nameBytes.length);
    uint16(view, 30, 0);
    uint16(view, 32, 0);
    uint16(view, 34, 0);
    uint16(view, 36, 0);
    uint32(view, 38, 0);
    uint32(view, 42, entry.localOffset);
    bytes.set(entry.nameBytes, 46);
    return bytes;
}
function endOfCentralDirectory(entryCount, centralSize, centralOffset) {
    const bytes = new Uint8Array(22);
    const view = new DataView(bytes.buffer);
    uint32(view, 0, 0x06054b50);
    uint16(view, 4, 0);
    uint16(view, 6, 0);
    uint16(view, 8, entryCount);
    uint16(view, 10, entryCount);
    uint32(view, 12, centralSize);
    uint32(view, 16, centralOffset);
    uint16(view, 20, 0);
    return bytes;
}
export async function createZipBlob(entries) {
    if (entries.length === 0)
        throw new Error("L’archive ZIP ne contient aucun fichier.");
    if (entries.length > MAX_UINT16)
        throw new Error("L’archive contient trop de fichiers pour le format ZIP classique.");
    const names = new Set();
    const timestamp = dosTimestamp(new Date());
    const prepared = [];
    let localOffset = 0;
    for (const input of entries) {
        const name = safeEntryName(input.name);
        if (names.has(name))
            throw new Error(`Le fichier ${name} apparaît plusieurs fois dans l’archive.`);
        names.add(name);
        const nameBytes = new TextEncoder().encode(name);
        const data = await toBytes(input.data);
        if (nameBytes.byteLength > MAX_UINT16)
            throw new Error(`Le chemin ${name} est trop long.`);
        if (data.byteLength > MAX_UINT32)
            throw new Error(`Le fichier ${name} dépasse la limite de 4 Gio.`);
        if (localOffset > MAX_UINT32)
            throw new Error("L’archive dépasse la limite de 4 Gio.");
        const entry = {
            nameBytes,
            data,
            crc32: crc32(data),
            localOffset,
            dosTime: timestamp.time,
            dosDate: timestamp.date
        };
        prepared.push(entry);
        localOffset += 30 + nameBytes.byteLength + data.byteLength;
    }
    const centralOffset = localOffset;
    const localParts = [];
    const centralParts = [];
    let centralSize = 0;
    prepared.forEach((entry) => {
        localParts.push(localHeader(entry), entry.data);
        const header = centralHeader(entry);
        centralParts.push(header);
        centralSize += header.byteLength;
    });
    if (centralOffset + centralSize > MAX_UINT32)
        throw new Error("L’archive dépasse la limite de 4 Gio.");
    return new Blob([...localParts, ...centralParts, endOfCentralDirectory(prepared.length, centralSize, centralOffset)], { type: "application/zip" });
}
