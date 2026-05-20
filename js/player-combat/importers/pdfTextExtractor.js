export function decodeBytes(buffer) {
  return new TextDecoder("latin1").decode(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));
}

export async function inflatePdfStreams(buffer) {
  if (typeof DecompressionStream !== "function") return [];
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const text = decodeBytes(bytes);
  const streams = [];
  let index = 0;
  while (index < text.length) {
    const streamMarker = text.indexOf("stream", index);
    if (streamMarker === -1) break;
    const dictStart = text.lastIndexOf("<<", streamMarker);
    const dictText = dictStart === -1 ? "" : text.slice(dictStart, streamMarker);
    const start = streamDataStart(text, streamMarker + "stream".length);
    const end = text.indexOf("endstream", start);
    if (end === -1) break;
    if (/\/FlateDecode\b/.test(dictText)) {
      try {
        streams.push(await inflateDeflateBytes(trimStreamBytes(bytes.subarray(start, end))));
      } catch {
        // Some PDFs advertise FlateDecode streams that are not plain deflate form data.
      }
    }
    index = end + "endstream".length;
  }
  return streams;
}

function streamDataStart(text, index) {
  if (text[index] === "\r" && text[index + 1] === "\n") return index + 2;
  if (text[index] === "\n" || text[index] === "\r") return index + 1;
  return index;
}

function trimStreamBytes(bytes) {
  let end = bytes.length;
  while (end > 0 && (bytes[end - 1] === 10 || bytes[end - 1] === 13)) end -= 1;
  return bytes.subarray(0, end);
}

async function inflateDeflateBytes(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
  return decodeBytes(new Uint8Array(await new Response(stream).arrayBuffer()));
}
