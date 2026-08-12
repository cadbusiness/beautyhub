import 'package:flutter/material.dart';

import 'package:beautyhub_core/beautyhub_core.dart';

import '../../shared/money.dart';

class DashboardBarChart extends StatelessWidget {
  const DashboardBarChart({
    super.key,
    required this.series,
    this.height = 132,
  });

  final List<DashboardSeriesPoint> series;
  final double height;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);

  @override
  Widget build(BuildContext context) {
    if (series.isEmpty) {
      return SizedBox(
        height: height,
        child: const Center(
          child: Text(
            'Pas encore de données cette semaine.',
            style: TextStyle(color: _muted, fontSize: 13),
          ),
        ),
      );
    }

    final maxRevenue = series
        .map((p) => p.revenueCents)
        .fold<int>(0, (a, b) => a > b ? a : b);
    final peak = maxRevenue <= 0 ? 1 : maxRevenue;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height: height,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              for (var i = 0; i < series.length; i++) ...[
                if (i > 0) const SizedBox(width: 6),
                Expanded(
                  child: _Bar(
                    label: series[i].label,
                    revenueCents: series[i].revenueCents,
                    peak: peak,
                    isToday: i == series.length - 1,
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              formatEuros(series.fold<int>(0, (s, p) => s + p.revenueCents)),
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: _black,
              ),
            ),
            const Text(
              '7 jours',
              style: TextStyle(fontSize: 12, color: _muted),
            ),
          ],
        ),
      ],
    );
  }
}

class _Bar extends StatelessWidget {
  const _Bar({
    required this.label,
    required this.revenueCents,
    required this.peak,
    required this.isToday,
  });

  final String label;
  final int revenueCents;
  final int peak;
  final bool isToday;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);
  static const _track = Color(0xFFEBEBEB);

  @override
  Widget build(BuildContext context) {
    final ratio = revenueCents / peak;
    final fill = ratio <= 0 ? 0.06 : ratio.clamp(0.08, 1.0);

    return Column(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        Expanded(
          child: Align(
            alignment: Alignment.bottomCenter,
            child: FractionallySizedBox(
              heightFactor: fill,
              widthFactor: 1,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: isToday ? _black : _track,
                  borderRadius: BorderRadius.circular(6),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 10,
            fontWeight: isToday ? FontWeight.w700 : FontWeight.w500,
            color: isToday ? _black : _muted,
          ),
        ),
      ],
    );
  }
}
