import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/session_providers.dart';

class DashboardSalesChannelFilter extends ConsumerWidget {
  const DashboardSalesChannelFilter({super.key});

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);
  static const _border = Color(0xFFE8E8E8);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final channel = ref.watch(dashboardSalesChannelProvider);
    final dashboardAsync = ref.watch(dashboardProvider);

    final wooAvailable = dashboardAsync.maybeWhen(
      data: (dash) => dash.wooSalesAvailable,
      orElse: () => false,
    );

    if (!wooAvailable) {
      return const SizedBox.shrink();
    }

    final options = const [
      ('all', 'Tout'),
      ('pos', 'Caisse'),
      ('woo', 'E-commerce'),
    ];

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final option in options)
          ChoiceChip(
            label: Text(option.$2),
            selected: channel == option.$1,
            onSelected: (_) {
              ref.read(dashboardSalesChannelProvider.notifier).state = option.$1;
            },
            selectedColor: _black,
            labelStyle: TextStyle(
              color: channel == option.$1 ? Colors.white : _muted,
              fontSize: 13,
              fontWeight: FontWeight.w500,
            ),
            backgroundColor: Colors.white,
            side: const BorderSide(color: _border),
            showCheckmark: false,
            padding: const EdgeInsets.symmetric(horizontal: 4),
          ),
      ],
    );
  }
}
