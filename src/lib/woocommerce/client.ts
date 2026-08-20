export interface WooCredentials {
  url: string;
  consumerKey: string;
  consumerSecret: string;
}

export interface WooProduct {
  id: number;
  name: string;
  sku: string;
  /** GTIN / EAN / UPC (WooCommerce 9+). */
  global_unique_id?: string | null;
  price: string;
  stock_quantity: number | null;
  status: string;
  /** `simple` | `variable` | `grouped` | `external` — controle si on doit fetcher les variations. */
  type?: string;
  /** Liste des variation ids pour un produit variable (present sur GET /products). */
  variations?: number[];
  images?: Array<{ src: string }>;
  categories?: Array<{ id: number; name: string; slug: string }>;
  brands?: Array<{ id: number; name: string; slug: string }>;
  tags?: Array<{ id: number; name: string; slug: string }>;
  attributes?: Array<{ id?: number; name?: string; options?: string[] }>;
  meta_data?: Array<{ key: string; value: unknown }>;
}

export interface WooProductCategory {
  id: number;
  name: string;
  slug: string;
  parent: number;
}

export interface WooProductVariation {
  id: number;
  name?: string;
  sku?: string;
  global_unique_id?: string | null;
  price?: string;
  stock_quantity?: number | null;
  status?: string;
  image?: { src: string } | null;
  attributes?: Array<{ id?: number; name?: string; option?: string }>;
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
  line_items?: Array<WooOrderLineItem & { name?: string }>;
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

/**
 * Timeout par requête WooCommerce (ms). Volontairement inférieur au budget
 * serverless Vercel (60 s) pour laisser de la marge à la logique BH et éviter
 * qu'un tenant avec un Woo lent ne kille la fonction.
 */
const WOO_REQUEST_TIMEOUT_MS = 25_000;

function fetchWithTimeout(
  url: URL | string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const signal = init.signal
    ? mergeAbortSignals([init.signal, controller.signal])
    : controller.signal;
  return fetch(url, { ...init, signal }).finally(() => clearTimeout(timer));
}

function mergeAbortSignals(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  const abort = () => controller.abort();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener("abort", abort, { once: true });
  }
  return controller.signal;
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
    let res: Response;
    try {
      res = await fetchWithTimeout(
        url,
        {
          ...init,
          headers: {
            Authorization: this.authHeader,
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
          },
          cache: "no-store",
        },
        WOO_REQUEST_TIMEOUT_MS,
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error(
          `WooCommerce timeout après ${Math.round(WOO_REQUEST_TIMEOUT_MS / 1000)}s sur ${path}. La boutique est injoignable ou trop lente.`,
        );
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`WooCommerce fetch ${path}: ${msg}`);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const canRetryWithoutStatus =
        res.status === 400 &&
        Boolean(init?.query && "status" in init.query) &&
        text.includes("rest_invalid_param");
      if (canRetryWithoutStatus && init?.query) {
        const { status: _ignored, ...query } = init.query;
        return this.request<T>(path, { ...init, query });
      }
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
      query: {
        page,
        per_page: perPage,
        orderby: "modified",
        order: "desc",
      },
    });
  }

  async listProductCategories(
    page = 1,
    perPage = 100,
  ): Promise<WooProductCategory[]> {
    return this.request<WooProductCategory[]>("/products/categories", {
      query: { page, per_page: perPage, hide_empty: "false" },
    });
  }

  /** Arbre des catégories Woo (jusqu'à 1000). Ignore si l'endpoint n'est pas dispo. */
  async listAllProductCategories(): Promise<WooProductCategory[]> {
    const all: WooProductCategory[] = [];
    try {
      for (let page = 1; page <= 10; page++) {
        const batch = await this.listProductCategories(page, 100);
        all.push(...batch);
        if (batch.length < 100) break;
      }
    } catch {
      return all;
    }
    return all;
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

  async getOrder(id: number): Promise<WooOrder> {
    return this.request<WooOrder>(`/orders/${id}`);
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

  async updateVariationStock(
    productId: number,
    variationId: number,
    stockQuantity: number,
    manageStock = true,
  ): Promise<WooProductVariation> {
    return this.request<WooProductVariation>(
      `/products/${productId}/variations/${variationId}`,
      {
        method: "PUT",
        body: JSON.stringify({
          manage_stock: manageStock,
          stock_quantity: stockQuantity,
        }),
      },
    );
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
    page = 1,
    perPage = 100,
  ): Promise<WooProductVariation[]> {
    return this.request<WooProductVariation[]>(
      `/products/${productId}/variations`,
      { query: { per_page: perPage, page } },
    );
  }

  /** Retourne toutes les variations d'un produit (paginé, jusqu'a 500). */
  async listAllProductVariations(
    productId: number,
  ): Promise<WooProductVariation[]> {
    const all: WooProductVariation[] = [];
    for (let page = 1; page <= 5; page++) {
      const batch = await this.listProductVariations(productId, page, 100);
      all.push(...batch);
      if (batch.length < 100) break;
    }
    return all;
  }

  async getProductVariation(
    productId: number,
    variationId: number,
  ): Promise<WooProductVariation> {
    return this.request<WooProductVariation>(
      `/products/${productId}/variations/${variationId}`,
    );
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
    // On tente d'abord `role=all` (retourne aussi les subscribers). Si l'API key
    // n'a pas la capacité `list_users` étendue, on retombe sur le rôle par défaut
    // (`customer`) pour éviter un 401 bloquant.
    try {
      return await this.request<WooCustomer[]>("/customers", {
        query: { page, per_page: perPage, orderby: "id", order: "asc", role: "all" },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (/401|403|rest_user_cannot_view|role/i.test(msg)) {
        return this.request<WooCustomer[]>("/customers", {
          query: { page, per_page: perPage, orderby: "id", order: "asc" },
        });
      }
      throw err;
    }
  }

  /**
   * Retourne le total count via l'entête HTTP `X-WP-Total`.
   * Utile pour la barre de progression de l'import.
   *
   * Retourne `null` si le count ne peut pas être déterminé (l'import reste
   * possible en mode progression indéterminée).
   */
  async countCustomers(): Promise<number | null> {
    const attempt = async (withRoleAll: boolean): Promise<number | null> => {
      const url = new URL(this.base + "/customers");
      url.searchParams.set("per_page", "1");
      if (withRoleAll) url.searchParams.set("role", "all");
      let res: Response;
      try {
        res = await fetchWithTimeout(
          url,
          {
            headers: {
              Authorization: this.authHeader,
              "Content-Type": "application/json",
            },
            cache: "no-store",
          },
          WOO_REQUEST_TIMEOUT_MS,
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          throw new Error(
            `WooCommerce timeout après ${Math.round(WOO_REQUEST_TIMEOUT_MS / 1000)}s sur /customers (count).`,
          );
        }
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`WooCommerce fetch /customers (count): ${msg}`);
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `WooCommerce ${res.status} on /customers: ${text.slice(0, 200) || res.statusText}`,
        );
      }
      const header = res.headers.get("x-wp-total");
      if (header) {
        const parsed = Number.parseInt(header, 10);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    };
    try {
      return await attempt(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (/401|403|rest_user_cannot_view|role/i.test(msg)) {
        return attempt(false);
      }
      throw err;
    }
  }
}
