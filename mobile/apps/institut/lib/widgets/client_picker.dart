import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/session_providers.dart';
import 'searchable_picker.dart';

PickerItem pickerItemFromClient(InstClient client) {
  final bits = <String>[
    if (client.email != null && client.email!.isNotEmpty) client.email!,
    if (client.phone != null && client.phone!.isNotEmpty) client.phone!,
  ];
  return PickerItem(
    id: client.id,
    title: client.displayName,
    subtitle: bits.isEmpty ? null : bits.join(' · '),
    searchKeywords: [
      client.fullName ?? '',
      client.email ?? '',
      client.phone ?? '',
    ],
  );
}

Future<List<PickerItem>> searchInstitutClients(
  WidgetRef ref,
  String query, {
  String? fromLetter,
}) async {
  final token = ref.read(accessTokenProvider);
  final tenantId = ref.read(selectedTenantIdProvider);
  if (token == null || tenantId == null) return const [];
  final page = await ref.read(mobileApiProvider).fetchInstitutClients(
        accessToken: token,
        tenantId: tenantId,
        query: query.trim(),
        fromLetter: fromLetter,
        limit: 60,
      );
  return page.items.map(pickerItemFromClient).toList(growable: false);
}
