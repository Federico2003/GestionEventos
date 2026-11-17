export interface KVStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export class InMemoryKV implements KVStore {
  private readonly store = new Map<string, { value: string; expiresAt: number | null }>();

  public async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  public async put(
    key: string,
    value: string,
    options?: { expirationTtl?: number }
  ): Promise<void> {
    const expiresAt =
      options?.expirationTtl && options.expirationTtl > 0
        ? Date.now() + options.expirationTtl * 1000
        : null;
    this.store.set(key, { value, expiresAt });
  }

  public async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

export interface StoredObjectMeta {
  key: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface ObjectStoragePort {
  putObject(key: string, contentBase64: string, contentType?: string): Promise<StoredObjectMeta>;
  getObject(key: string): Promise<{ meta: StoredObjectMeta; contentBase64: string } | null>;
  listObjects(prefix?: string): Promise<StoredObjectMeta[]>;
}

export class InMemoryObjectStorage implements ObjectStoragePort {
  private readonly bucket = new Map<string, { meta: StoredObjectMeta; contentBase64: string }>();

  public async putObject(
    key: string,
    contentBase64: string,
    contentType = 'application/pdf'
  ): Promise<StoredObjectMeta> {
    const meta: StoredObjectMeta = {
      key,
      contentType,
      sizeBytes: Math.ceil((contentBase64.length * 3) / 4),
      uploadedAt: new Date().toISOString()
    };
    this.bucket.set(key, { meta, contentBase64 });
    return meta;
  }

  public async getObject(
    key: string
  ): Promise<{ meta: StoredObjectMeta; contentBase64: string } | null> {
    return this.bucket.get(key) ?? null;
  }

  public async listObjects(prefix = ''): Promise<StoredObjectMeta[]> {
    const items: StoredObjectMeta[] = [];
    for (const [k, v] of this.bucket.entries()) {
      if (!prefix || k.startsWith(prefix)) {
        items.push(v.meta);
      }
    }
    return items;
  }
}
