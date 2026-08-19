import 'dart:math' as math;

import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../state/session_providers.dart';
import '../../shared/money.dart';

class DashboardStatsCard extends ConsumerWidget {
  const DashboardStatsCard({super.key});

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);
  static const _border = Color(0xFFE8E8E8);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final period = ref.watch(dashboardPeriodProvider);
    final metric = ref.watch(dashboardMetricProvider);
    final chart = ref.watch(dashboardChartKindProvider);
    final dashAsync = ref.watch(dashboardProvider);

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Statistiques',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: _black,
                  ),
                ),
              ),
              _ChartKindToggle(
                selected: chart,
                onSelected: (value) {
                  ref.read(dashboardChartKindProvider.notifier).state = value;
                },
              ),
            ],
          ),
          const SizedBox(height: 10),
          _ChipRow(
            children: [
              _FilterChip(
                label: 'CA',
                selected: metric == DashboardMetricFilter.revenue,
                onTap: () => ref.read(dashboardMetricProvider.notifier).state =
                    DashboardMetricFilter.revenue,
              ),
              _FilterChip(
                label: 'RDV',
                selected: metric == DashboardMetricFilter.appointments,
                onTap: () => ref.read(dashboardMetricProvider.notifier).state =
                    DashboardMetricFilter.appointments,
              ),
            ],
          ),
          const SizedBox(height: 8),
          _ChipRow(
            children: [
              for (final option in DashboardPeriodFilter.values)
                _FilterChip(
                  label: _periodShort(option),
                  selected: period == option,
                  onTap: () =>
                      ref.read(dashboardPeriodProvider.notifier).state = option,
                ),
            ],
          ),
          const SizedBox(height: 6),
          dashAsync.when(
            skipLoadingOnReload: true,
            skipLoadingOnRefresh: true,
            loading: () => const SizedBox(
              height: 148,
              child: Center(
                child: SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            ),
            error: (e, _) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Text('$e', style: const TextStyle(color: _muted, fontSize: 13)),
            ),
            data: (dash) => _StatsBody(
              dash: dash,
              period: period,
              metric: metric,
              chart: chart,
            ),
          ),
        ],
      ),
    );
  }

  static String _periodShort(DashboardPeriodFilter period) {
    switch (period) {
      case DashboardPeriodFilter.today:
        return 'Jour';
      case DashboardPeriodFilter.week:
        return 'Semaine';
      case DashboardPeriodFilter.month:
        return 'Mois';
      case DashboardPeriodFilter.year:
        return 'Année';
    }
  }
}

class _StatsBody extends StatelessWidget {
  const _StatsBody({
    required this.dash,
    required this.period,
    required this.metric,
    required this.chart,
  });

  final MobileDashboard dash;
  final DashboardPeriodFilter period;
  final DashboardMetricFilter metric;
  final DashboardChartKind chart;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);

  bool get _isRevenue => metric == DashboardMetricFilter.revenue;

  @override
  Widget build(BuildContext context) {
    final change = _isRevenue
        ? dash.weekRevenueChangePct
        : dash.appointmentsChangePct;
    final totalLabel = _isRevenue
        ? formatEuros(dash.weekRevenueCents)
        : dash.weekAppointmentsTotal == 1
            ? '1 RDV'
            : '${dash.weekAppointmentsTotal} RDV';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          _subtitle(change),
          style: const TextStyle(fontSize: 12, color: _muted),
        ),
        const SizedBox(height: 10),
        if (chart == DashboardChartKind.pie)
          _PieChart(
            slices: _slices(),
            emptyLabel: 'Pas encore de données ${_periodHint()}.',
            formatValue: _isRevenue
                ? (v) => formatEuros(v)
                : (v) => v == 1 ? '1' : '$v',
          )
        else
          _LineChart(
            points: [
              for (final point in dash.series)
                (label: point.label, value: _pointValue(point)),
            ],
            emptyLabel: 'Pas encore de données ${_periodHint()}.',
          ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: Text(
                totalLabel,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: _black,
                ),
              ),
            ),
            Text(
              _footerHint(),
              style: const TextStyle(fontSize: 12, color: _muted),
            ),
          ],
        ),
      ],
    );
  }

  int _pointValue(DashboardSeriesPoint point) {
    return _isRevenue ? point.revenueCents : point.appointments;
  }

  String _subtitle(double? pct) {
    final base = _periodTitle();
    if (pct == null) return base;
    final sign = pct >= 0 ? '+' : '';
    return '$base · $sign${pct.toStringAsFixed(0)} %';
  }

  String _periodTitle() {
    switch (period) {
      case DashboardPeriodFilter.today:
        return 'Aujourd’hui';
      case DashboardPeriodFilter.week:
        return 'Cette semaine';
      case DashboardPeriodFilter.month:
        return '30 derniers jours';
      case DashboardPeriodFilter.year:
        return '12 derniers mois';
    }
  }

  String _periodHint() {
    switch (period) {
      case DashboardPeriodFilter.today:
        return 'aujourd’hui';
      case DashboardPeriodFilter.week:
        return 'cette semaine';
      case DashboardPeriodFilter.month:
        return 'ce mois';
      case DashboardPeriodFilter.year:
        return 'cette année';
    }
  }

  String _footerHint() {
    if (chart == DashboardChartKind.pie && !_isRevenue) {
      if (dash.cancellationRate > 0) {
        return '${dash.cancellationRate.toStringAsFixed(0)} % d’annulation';
      }
      return 'mix des RDV';
    }
    switch (period) {
      case DashboardPeriodFilter.today:
        return 'Par 2 h';
      case DashboardPeriodFilter.week:
        return '7 jours';
      case DashboardPeriodFilter.month:
        return '30 jours';
      case DashboardPeriodFilter.year:
        return '12 mois';
    }
  }

  List<_Slice> _slices() {
    if (!_isRevenue) {
      final scheduled = math.max(
        0,
        dash.weekAppointmentsTotal -
            dash.appointmentsCompleted -
            dash.appointmentsCancelled -
            dash.appointmentsNoShow,
      );
      return [
        _Slice('Honorés', dash.appointmentsCompleted, const Color(0xFF0A0A0A)),
        _Slice('Prévus', scheduled, const Color(0xFF525252)),
        _Slice('Annulés', dash.appointmentsCancelled, const Color(0xFFA3A3A3)),
        _Slice('Absents', dash.appointmentsNoShow, const Color(0xFFD4D4D4)),
      ].where((s) => s.value > 0).toList();
    }

    final valued = [
      for (final point in dash.series)
        if (point.revenueCents > 0)
          _Slice(point.label, point.revenueCents, const Color(0xFF0A0A0A)),
    ];
    if (valued.length <= 8) {
      return [
        for (var i = 0; i < valued.length; i++)
          _Slice(valued[i].label, valued[i].value, _pieColor(i)),
      ];
    }

    final groupSize = (valued.length / 6).ceil();
    final grouped = <_Slice>[];
    for (var i = 0; i < valued.length; i += groupSize) {
      final chunk = valued.sublist(i, math.min(i + groupSize, valued.length));
      grouped.add(
        _Slice(
          chunk.length == 1
              ? chunk.first.label
              : '${chunk.first.label}–${chunk.last.label}',
          chunk.fold<int>(0, (s, p) => s + p.value),
          _pieColor(grouped.length),
        ),
      );
    }
    return grouped;
  }

  static Color _pieColor(int index) {
    const colors = [
      Color(0xFF0A0A0A),
      Color(0xFF404040),
      Color(0xFF737373),
      Color(0xFFA3A3A3),
      Color(0xFF525252),
      Color(0xFF171717),
    ];
    return colors[index % colors.length];
  }
}

class _Slice {
  const _Slice(this.label, this.value, this.color);
  final String label;
  final int value;
  final Color color;
}

class _ChipRow extends StatelessWidget {
  const _ChipRow({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Wrap(spacing: 6, runSpacing: 6, children: children);
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? const Color(0xFF0A0A0A) : Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: selected ? const Color(0xFF0A0A0A) : const Color(0xFFE8E8E8),
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: selected ? Colors.white : const Color(0xFF737373),
            ),
          ),
        ),
      ),
    );
  }
}

class _ChartKindToggle extends StatelessWidget {
  const _ChartKindToggle({
    required this.selected,
    required this.onSelected,
  });

  final DashboardChartKind selected;
  final ValueChanged<DashboardChartKind> onSelected;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border.all(color: const Color(0xFFE8E8E8)),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _KindButton(
            icon: Icons.show_chart_rounded,
            selected: selected == DashboardChartKind.line,
            onTap: () => onSelected(DashboardChartKind.line),
            tooltip: 'Courbe',
          ),
          _KindButton(
            icon: Icons.pie_chart_outline_rounded,
            selected: selected == DashboardChartKind.pie,
            onTap: () => onSelected(DashboardChartKind.pie),
            tooltip: 'Camembert',
          ),
        ],
      ),
    );
  }
}

class _KindButton extends StatelessWidget {
  const _KindButton({
    required this.icon,
    required this.selected,
    required this.onTap,
    required this.tooltip,
  });

  final IconData icon;
  final bool selected;
  final VoidCallback onTap;
  final String tooltip;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(9),
        child: Container(
          width: 32,
          height: 28,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? const Color(0xFF0A0A0A) : Colors.transparent,
            borderRadius: BorderRadius.circular(9),
          ),
          child: Icon(
            icon,
            size: 16,
            color: selected ? Colors.white : const Color(0xFF737373),
          ),
        ),
      ),
    );
  }
}

class _LineChart extends StatelessWidget {
  const _LineChart({
    required this.points,
    required this.emptyLabel,
  });

  final List<({String label, int value})> points;
  final String emptyLabel;

  @override
  Widget build(BuildContext context) {
    final hasData = points.any((p) => p.value > 0);
    if (points.isEmpty || !hasData) {
      return SizedBox(
        height: 132,
        child: Center(
          child: Text(
            emptyLabel,
            style: const TextStyle(color: Color(0xFF737373), fontSize: 13),
          ),
        ),
      );
    }

    final labelStep = points.length > 12 ? 5 : (points.length > 8 ? 2 : 1);

    return SizedBox(
      height: 132,
      child: Column(
        children: [
          Expanded(
            child: CustomPaint(
              painter: _LinePainter(values: [for (final p in points) p.value]),
              child: const SizedBox.expand(),
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              for (var i = 0; i < points.length; i++)
                Expanded(
                  child: Text(
                    i % labelStep == 0 || i == points.length - 1
                        ? points[i].label
                        : '',
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: i == points.length - 1
                          ? FontWeight.w700
                          : FontWeight.w500,
                      color: i == points.length - 1
                          ? const Color(0xFF0A0A0A)
                          : const Color(0xFF737373),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _LinePainter extends CustomPainter {
  _LinePainter({required this.values});

  final List<int> values;

  @override
  void paint(Canvas canvas, Size size) {
    if (values.isEmpty) return;
    final maxV = values.fold<int>(0, (a, b) => a > b ? a : b);
    final peak = maxV <= 0 ? 1 : maxV;
    final dx = values.length == 1 ? 0.0 : size.width / (values.length - 1);

    Offset pointAt(int i) {
      final x = values.length == 1 ? size.width / 2 : i * dx;
      final y = size.height - (values[i] / peak) * size.height;
      return Offset(x, y.clamp(2, size.height - 2));
    }

    final path = Path()..moveTo(pointAt(0).dx, pointAt(0).dy);
    for (var i = 1; i < values.length; i++) {
      path.lineTo(pointAt(i).dx, pointAt(i).dy);
    }

    final fill = Path.from(path)
      ..lineTo(pointAt(values.length - 1).dx, size.height)
      ..lineTo(pointAt(0).dx, size.height)
      ..close();
    canvas.drawPath(
      fill,
      Paint()..color = const Color(0xFF0A0A0A).withValues(alpha: 0.08),
    );
    canvas.drawPath(
      path,
      Paint()
        ..color = const Color(0xFF0A0A0A)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..strokeJoin = StrokeJoin.round
        ..strokeCap = StrokeCap.round,
    );

    final last = pointAt(values.length - 1);
    canvas.drawCircle(last, 3.5, Paint()..color = const Color(0xFF0A0A0A));
  }

  @override
  bool shouldRepaint(covariant _LinePainter oldDelegate) {
    return oldDelegate.values != values;
  }
}

class _PieChart extends StatelessWidget {
  const _PieChart({
    required this.slices,
    required this.emptyLabel,
    required this.formatValue,
  });

  final List<_Slice> slices;
  final String emptyLabel;
  final String Function(int value) formatValue;

  @override
  Widget build(BuildContext context) {
    final total = slices.fold<int>(0, (s, p) => s + p.value);
    if (total <= 0) {
      return SizedBox(
        height: 132,
        child: Center(
          child: Text(
            emptyLabel,
            style: const TextStyle(color: Color(0xFF737373), fontSize: 13),
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(
            width: 108,
            height: 108,
            child: CustomPaint(painter: _PiePainter(slices: slices, total: total)),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final slice in slices) ...[
                  Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: slice.color,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          slice.label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF525252),
                          ),
                        ),
                      ),
                      Text(
                        formatValue(slice.value),
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF0A0A0A),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PiePainter extends CustomPainter {
  _PiePainter({required this.slices, required this.total});

  final List<_Slice> slices;
  final int total;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    var start = -math.pi / 2;
    for (final slice in slices) {
      final sweep = (slice.value / total) * math.pi * 2;
      canvas.drawArc(
        rect.deflate(4),
        start,
        sweep,
        true,
        Paint()..color = slice.color,
      );
      start += sweep;
    }
    canvas.drawCircle(
      size.center(Offset.zero),
      size.shortestSide * 0.28,
      Paint()..color = Colors.white,
    );
  }

  @override
  bool shouldRepaint(covariant _PiePainter oldDelegate) {
    return oldDelegate.slices != slices || oldDelegate.total != total;
  }
}
