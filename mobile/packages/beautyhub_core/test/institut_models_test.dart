import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('tenant contact and address serialize for PATCH', () {
    const contact = InstTenantContact(
      email: 'hello@salon.fr',
      phone: '0102030405',
      website: 'https://salon.fr',
    );
    const address = InstTenantAddress(
      line1: '12 rue des Lilas',
      city: 'Paris',
      postalCode: '75011',
      country: 'France',
    );
    final hours = [
      const InstOpeningDay(
        weekday: 1,
        label: 'Lundi',
        slots: [InstOpeningSlot(start: '09:00', end: '18:00')],
      ),
    ];

    expect(contact.toJson()['email'], 'hello@salon.fr');
    expect(address.toJson()['postalCode'], '75011');
    expect(address.oneLine, '12 rue des Lilas, 75011 Paris, France');
    expect(hours.first.toJson()['weekday'], 1);
    expect((hours.first.toJson()['slots'] as List).first['start'], '09:00');
  });
}
