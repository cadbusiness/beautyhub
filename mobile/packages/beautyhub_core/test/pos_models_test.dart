import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('PosContext parse catalog', () {
    final ctx = PosContext.fromJson({
      'catalog': [
        {
          'key': 'product:abc',
          'type': 'product',
          'id': 'abc',
          'name': 'Crème hydratante',
          'priceCents': 2500,
          'category': 'woocommerce',
        },
      ],
      'settings': {
        'currency': 'eur',
        'priceDisplay': 'ttc',
        'requireOpenSession': false,
        'paymentMethods': {'cash': true, 'card': true},
      },
      'clients': [],
      'staff': [],
      'sessionOpen': true,
      'wooConnected': true,
    });

    expect(ctx.catalog.length, 1);
    expect(ctx.catalog.first.category, 'woocommerce');
    expect(ctx.wooConnected, isTrue);
  });
}
