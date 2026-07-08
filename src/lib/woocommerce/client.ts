export interface WooCredentials {
  url: string;
  consumerKey: string;
  consumerSecret: string;
}

export interface WooProduct {
  id: number;
  name: string;
  sku: string;
  price: string;
  stock_quantity: number | null;
  status: string;
  images?: Array<{ src: string }>;
}

export interface WooOrderLineItem {
  product_id: number;
  quantity: number;
}

export interface WooOrder {
  id: number;
  total: string;
  status: string;
}

/** Client minimal de l'API REST WooCommerce v3 (auth basic ck/cs sur HTTPS). */
export class WooClient {
  private base: string;
  private authHeader: string;

  constructor(creds: WooCredentials) {
    this.base = creds.url.replace(/\/+$/, "") + "/wp-json/wc/v3";
    this.authHeader =
      "Basic " +
      Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString(
        "base64",
      );
  }

  private async request<T>(
    path: string,
    init?: RequestInit & { query?: Record<string, string | number> },
  ): Promise<T> {
    const url = new URL(this.base + path);
    if (init?.query) {
      for (const [k, v] of Object.entries(init.query)) {
        url.searchParams.set(k, String(v));
      }
    }
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `WooCommerce ${res.status}: ${text.slice(0, 200) || res.statusText}`,
      );
    }
    return (await res.json()) as T;
  }

  async testConnection(): Promise<boolean> {
    await this.request<WooProduct[]>("/products", { query: { per_page: 1 } });
    return true;
  }

  async listProducts(page = 1, perPage = 50): Promise<WooProduct[]> {
    return this.request<WooProduct[]>("/products", {
      query: { page, per_page: perPage, status: "publish" },
    });
  }

  async createOrder(
    lineItems: WooOrderLineItem[],
    opts?: { billingEmail?: string; setPaid?: boolean },
  ): Promise<WooOrder> {
    return this.request<WooOrder>("/orders", {
      method: "POST",
      body: JSON.stringify({
        payment_method: "beautyhub_pos",
        payment_method_title: "BeautyHub Caisse",
        set_paid: opts?.setPaid ?? true,
        billing: opts?.billingEmail ? { email: opts.billingEmail } : undefined,
        line_items: lineItems,
      }),
    });
  }

  async getProduct(id: number): Promise<WooProduct> {
    return this.request<WooProduct>(`/products/${id}`);
  }

  async updateProductStock(
    id: number,
    stockQuantity: number,
    manageStock = true,
  ): Promise<WooProduct> {
    return this.request<WooProduct>(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        manage_stock: manageStock,
        stock_quantity: stockQuantity,
      }),
    });
  }
}
