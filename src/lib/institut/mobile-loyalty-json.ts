import type { ClientLoyaltyCard, ClientLoyaltyLedgerEntry } from "./client-loyalty";
import type {
  LoyaltyEarnRule,
  LoyaltyIntegrations,
  LoyaltyProgram,
  LoyaltyProgramListItem,
  LoyaltyProgramSnapshot,
  LoyaltyReward,
} from "./loyalty";
import { LoyaltyAdminError } from "./loyalty-admin";
import { isPlaceholderEmail } from "./mobile-clients";
import type { ClientAppointment, ClientOverview, ClientSale } from "./clients";

export function loyaltyAdminHttp(error: unknown): Response {
  if (error instanceof LoyaltyAdminError) {
    const messages: Record<string, string> = {
      missing_fields: "Champs requis.",
      invalid_rule: "Règle invalide.",
      shopify_unavailable: "Shopify n’est pas encore disponible.",
      woo_required: "Connectez WooCommerce pour cette règle.",
      invalid_reward: "Récompense invalide.",
      invalid_percent: "Pourcentage invalide.",
      invalid_amount: "Montant invalide.",
      service_required: "Choisissez une prestation.",
      starter_not_empty: "Le programme a déjà des règles ou des récompenses.",
    };
    return Response.json(
      { error: error.code, message: messages[error.code] ?? error.code },
      { status: 400 },
    );
  }
  return Response.json(
    {
      error: "loyalty_failed",
      message: error instanceof Error ? error.message : "loyalty_failed",
    },
    { status: 500 },
  );
}

export function serializeLoyaltyCard(card: ClientLoyaltyCard) {
  return {
    assignedProgramId: card.assignedProgramId,
    programId: card.programId,
    programName: card.programName,
    pointsLabel: card.pointsLabel,
    balance: card.balance,
    lifetimeEarned: card.lifetimeEarned,
    lifetimeRedeemed: card.lifetimeRedeemed,
    nextReward: card.nextReward,
    valueCents: card.valueCents,
    programs: card.programs.map(serializeProgramListItem),
  };
}

export function serializeProgramListItem(program: LoyaltyProgramListItem) {
  return {
    id: program.id,
    name: program.name,
    isActive: program.is_active,
    pointsLabel: program.points_label,
  };
}

export function serializeLoyaltyProgram(program: LoyaltyProgram) {
  return {
    id: program.id,
    name: program.name,
    isActive: program.is_active,
    pointsLabel: program.points_label,
    birthdayBonusPoints: program.birthday_bonus_points,
    portalVisible: program.portal_visible,
    referralPoints: program.referral_points,
    sameDayRebookPoints: program.same_day_rebook_points,
    birthdayAutoEnabled: program.birthday_auto_enabled,
  };
}

export function serializeEarnRule(rule: LoyaltyEarnRule) {
  return {
    id: rule.id,
    programId: rule.program_id,
    name: rule.name,
    isActive: rule.is_active,
    sourceType: rule.source_type,
    calcMode: rule.calc_mode,
    pointsValue: rule.points_value,
    minAmountCents: rule.min_amount_cents,
    sortOrder: rule.sort_order,
  };
}

export function serializeReward(reward: LoyaltyReward) {
  return {
    id: reward.id,
    programId: reward.program_id,
    name: reward.name,
    description: reward.description,
    isActive: reward.is_active,
    rewardType: reward.reward_type,
    pointsCost: reward.points_cost,
    discountPercent: reward.discount_percent,
    discountCents: reward.discount_cents,
    serviceId: reward.service_id,
    sortOrder: reward.sort_order,
    newServiceOnly: reward.new_service_only,
  };
}

export function serializeLoyaltySnapshot(
  snapshot: LoyaltyProgramSnapshot,
  extras: {
    integrations: LoyaltyIntegrations;
    services: Array<{ id: string; name: string }>;
  },
) {
  return {
    program: serializeLoyaltyProgram(snapshot.program),
    programs: snapshot.programs.map(serializeProgramListItem),
    rules: snapshot.rules.map(serializeEarnRule),
    rewards: snapshot.rewards.map(serializeReward),
    stats: snapshot.stats,
    integrations: extras.integrations,
    services: extras.services,
  };
}

export function serializeClientOverview(
  overview: ClientOverview,
  loyalty: ClientLoyaltyCard,
) {
  const email = isPlaceholderEmail(overview.client.email)
    ? null
    : overview.client.email;
  return {
    client: {
      id: overview.client.id,
      fullName: overview.client.full_name,
      email,
      phone: overview.client.phone,
      dateOfBirth: overview.client.date_of_birth,
      addressLine1: overview.client.address_line1,
      addressLine2: overview.client.address_line2,
      city: overview.client.city,
      postalCode: overview.client.postal_code,
      country: overview.client.country,
      notes: overview.client.notes,
      tags: overview.client.tags,
      marketingOptIn: overview.client.marketing_opt_in,
      hasAccount: overview.client.has_portal_account,
      createdAt: overview.client.created_at,
    },
    stats: {
      appointmentCount: overview.stats.appointment_count,
      completedCount: overview.stats.completed_count,
      cancelledCount: overview.stats.cancelled_count,
      noShowCount: overview.stats.no_show_count,
      upcomingCount: overview.stats.upcoming_count,
      bookingRate: overview.stats.booking_rate,
      totalSpentCents: overview.stats.total_spent_cents,
      posSpentCents: overview.stats.pos_spent_cents,
      ecommerceSpentCents: overview.stats.ecommerce_spent_cents,
      saleCount: overview.stats.sale_count,
      loyaltyPoints: overview.stats.loyalty_points,
    },
    topServices: overview.top_services.map((s) => ({
      serviceId: s.service_id,
      serviceName: s.service_name,
      count: s.count,
    })),
    loyalty: serializeLoyaltyCard(loyalty),
  };
}

export function serializeAppointment(row: ClientAppointment) {
  return {
    id: row.id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    priceCents: row.price_cents,
    notes: row.notes,
    serviceName: row.service_name,
    staffName: row.staff_name,
  };
}

export function serializeClientSale(row: ClientSale) {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    totalCents: row.total_cents,
    status: row.status,
    paymentMethod: row.payment_method,
    wooOrderId: row.woo_order_id,
    createdAt: row.created_at,
    items: row.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPriceCents: item.unit_price_cents,
    })),
  };
}

export function serializeLedger(entries: ClientLoyaltyLedgerEntry[]) {
  return entries;
}
