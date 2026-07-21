// React Native's native FormData bridging silently stringifies the
// {uri, type, name} file-part object on this RN/Expo version, so multipart
// bodies are built manually as raw bytes instead.

function utf8ToUint8Array(text: string): Uint8Array {
  const utf8 = unescape(encodeURIComponent(text));
  const bytes = new Uint8Array(utf8.length);
  for (let i = 0; i < utf8.length; i++) {
    bytes[i] = utf8.charCodeAt(i);
  }
  return bytes;
}

export function buildMultipartBody(
  fieldName: string,
  fileBytes: Uint8Array,
  filename: string,
  mimeType: string,
): { body: Uint8Array; boundary: string } {
  const boundary = `AuraBoundary${Date.now()}`;
  const head = utf8ToUint8Array(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
  );
  const tail = utf8ToUint8Array(`\r\n--${boundary}--\r\n`);

  const body = new Uint8Array(head.length + fileBytes.length + tail.length);
  body.set(head, 0);
  body.set(fileBytes, head.length);
  body.set(tail, head.length + fileBytes.length);

  return { body, boundary };
}
