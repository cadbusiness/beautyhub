import 'package:flutter/material.dart';

import '../../shared/money.dart';

class DashboardKpiStrip extends StatelessWidget {
  const DashboardKpiStrip({
    super.key,
    required this.revenueCents,
    required this.appointments,
    required this.salesCount,
    this.revenueChangePct,
  });

  final int revenueCents;
  final int appointments;
  final int salesCount;
  final double? revenueChangePct;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: _KpiTile(
            label: 'CA jour',
            value: formatEuros(revenueCents),
            hint: _changeHint(revenueChangePct) ?? 'encaissé',
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _KpiTile(
            label: 'RDV',
            value: '$appointments',
            hint: 'prévus',
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _KpiTile(
            label: 'Ventes',
            value: '$salesCount',
            hint: 'aujourd’hui',
          ),
        ),
      ],
    );
  }

  String? _changeHint(double? pct) {
    if (pct == null) return null;
    final sign = pct >= 0 ? '+' : '';
    return '$sign${pct.toStringAsFixed(0)} % vs hier';
  }
}

class _KpiTile extends StatelessWidget {
  const _KpiTile({
    required this.label,
    required this.value,
    required this.hint,
  });

  final String label;
  final String value;
  final String hint;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 102,
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE8E8E8)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.6,
              color: _muted,
            ),
          ),
          const SizedBox(height: 6),
          SizedBox(
            height: 26,
            width: double.infinity,
            child: Align(
              alignment: Alignment.centerLeft,
              child: FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(
                  value,
                  maxLines: 1,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: _black,
                    letterSpacing: -0.4,
                    height: 1.1,
                  ),
                ),
              ),
            ),
          ),
          const Spacer(),
          Text(
            hint,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 11, color: _muted, height: 1.2),
          ),
        ],
      ),
    );
  }
}
