import { Readable } from 'stream';

export async function streamToBuffer(stream: any): Promise<Buffer> {
  if (Buffer.isBuffer(stream)) return stream;
  if (!(stream instanceof Readable)) {
    // AWS SDK sometimes returns a web-stream-like; best effort:
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
  }

  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
