// Simple Supabase Storage client using REST API to avoid WebSocket issues in Node.js 20
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

class SupabaseStorageClient {
  private url: string;
  private key: string;

  constructor(url: string, key: string) {
    this.url = url;
    this.key = key;
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.key}`,
      'Content-Type': 'application/json',
    };
  }

  async upload(bucket: string, fileName: string, file: Buffer, contentType: string) {
    const formData = new FormData();
    const uint8Array = new Uint8Array(file);
    const blob = new Blob([uint8Array], { type: contentType });
    formData.append('file', blob, fileName);

    const response = await fetch(`${this.url}/storage/v1/object/${bucket}/${fileName}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.key}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Upload failed: ${error.message || response.statusText}`);
    }

    return await response.json();
  }

  async getPublicUrl(bucket: string, fileName: string) {
    return {
      publicUrl: `${this.url}/storage/v1/object/public/${bucket}/${fileName}`,
    };
  }

  async remove(bucket: string, fileNames: string[]) {
    const response = await fetch(`${this.url}/storage/v1/object/${bucket}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
      body: JSON.stringify({ prefixes: fileNames }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Delete failed: ${error.message || response.statusText}`);
    }

    return await response.json();
  }

  from(bucket: string) {
    return {
      upload: (fileName: string, file: Buffer, options?: { contentType?: string }) =>
        this.upload(bucket, fileName, file, options?.contentType || 'application/octet-stream'),
      getPublicUrl: (fileName: string) => this.getPublicUrl(bucket, fileName),
      remove: (fileNames: string[]) => this.remove(bucket, fileNames),
      download: async (fileName: string) => {
        const response = await fetch(`${this.url}/storage/v1/object/${bucket}/${fileName}`, {
          headers: { Authorization: `Bearer ${this.key}` },
        });
        if (!response.ok) return { data: null, error: new Error(response.statusText) };
        return { data: response, error: null };
      },
    };
  }

  get storage() {
    return this;
  }
}

export const supabase = new SupabaseStorageClient(supabaseUrl, supabaseServiceKey);

export default supabase;
