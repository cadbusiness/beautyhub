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
  categories?: Array<{ id: number; name: string; slug: string }>;
  meta_data?: Array<{ key: string; value: unknown }>;
}

export interface WooOrderLineItem {
  product_id: number;
  quantity: number;
  total?: string | number;
  variation_id?: number;
  is_gift_card?: boolean;
}

export interface WooOrder {
  id: number;
  total: string;
  status: string;
}

export interface WooCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  username?: string;
  date_created?: string;
  date_modified?: string;
  billing?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    address_1?: string;
    address_2?: string;
    postcode?: string;
    city?: string;
    country?: string;
  };
  shipping?: {
    first_name?: string;
    last_name?: string;
    address_1?: string;
    address_2?: string;
    postcode?: string;
    city?: string;
    country?: string;
  };
  meta_data?: Array<{ key: string; value: unknown }>;
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
    opts?: {
      billingEmail?: string;
      setPaid?: boolean;
      metaData?: Array<{ key: string; value: string }>;
    },
  ): Promise<WooOrder> {
    return this.request<WooOrder>("/orders", {
      method: "POST",
      body: JSON.stringify({
        payment_method: "beautyhub_pos",
        payment_method_title: "BeautyHub Caisse",
        set_paid: opts?.setPaid ?? true,
        billing: opts?.billingEmail ? { email: opts.billingEmail } : undefined,
        line_items: lineItems,
        meta_data: opts?.metaData ?? undefined,
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

  async updateOrderMeta(
    orderId: number,
    metaData: Array<{ key: string; value: unknown }>,
  ): Promise<WooOrder> {
    return this.request<WooOrder>(`/orders/${orderId}`, {
      method: "PUT",
      body: JSON.stringify({ meta_data: metaData }),
    });
  }

  async updateProductMeta(
    productId: number,
    metaData: Array<{ key: string; value: unknown }>,
  ): Promise<WooProduct> {
    return this.request<WooProduct>(`/products/${productId}`, {
      method: "PUT",
      body: JSON.stringify({ meta_data: metaData }),
    });
  }

  async listProductVariations(
    productId: number,
  ): Promise<Array<{ id: number; name: string; sku: string; meta_data?: Array<{ key: string; value: unknown }> }>> {
    return this.request(`/products/${productId}/variations`, {
      query: { per_page: 100 },
    });
  }

  async updateVariationMeta(
    productId: number,
    variationId: number,
    metaData: Array<{ key: string; value: unknown }>,
  ): Promise<unknown> {
    return this.request(`/products/${productId}/variations/${variationId}`, {
      method: "PUT",
      body: JSON.stringify({ meta_data: metaData }),
    });
  }

  async listCustomers(page = 1, perPage = 100): Promise<WooCustomer[]> {
    return this.request<WooCustomer[]>("/customers", {
      query: { page, per_page: perPage, orderby: "id", order: "asc", role: "all" },
    });
  }

  /**
   * Retourne le total count via l'entête HTTP `X-WP-Total`.
   * Utile pour la barre de progression de l'import.
   */
  async countCustomers(): Promise<number> {
    const url = new URL(this.base + "/customers");
    url.searchParams.set("per_page", "1");
    url.searchParams.set("role", "all");
    const res = await fetch(url, {
      headers: { Authorization: this.authHeader, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`WooCommerce ${res.status}: ${text.slice(0, 200) || res.statusText}`);
    }
    const header = res.headers.get("x-wp-total");
    return header ? Number.parseInt(header, 10) || 0 : 0;
  }
}
