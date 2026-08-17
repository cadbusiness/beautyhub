String loyaltySourceLabel(String source) {
  switch (source) {
    case 'appointment_completed':
      return 'RDV terminé';
    case 'pos_sale':
      return 'Achat en caisse';
    case 'woocommerce_order':
      return 'Commande WooCommerce';
    case 'shopify_order':
      return 'Commande Shopify';
    default:
      return source;
  }
}

String loyaltyCalcLabel(String mode) {
  switch (mode) {
    case 'per_euro_spent':
      return 'Par euro dépensé';
    default:
      return 'Points fixes';
  }
}

String loyaltyRewardTypeLabel(String type) {
  switch (type) {
    case 'discount_fixed':
      return 'Réduction fixe';
    case 'free_service':
      return 'Prestation offerte';
    default:
      return 'Réduction en %';
  }
}

String loyaltyRuleEarning(String calcMode, num points) {
  if (calcMode == 'per_euro_spent') {
    return '$points pt / €';
  }
  return '$points pts / événement';
}
