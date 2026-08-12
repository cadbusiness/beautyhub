import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../state/session_providers.dart';
import '../agenda/widgets/appointment_form_sheet.dart';
import '../shared/money.dart';
import '../shared/tenant_logo.dart';
import 'widgets/dashboard_bar_chart.dart';
import 'widgets/dashboard_kpi_strip.dart';
import 'widgets/dashboard_quick_actions.dart';
import 'widgets/next_appointment_hero.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  static const _bg = Color(0xFFF5F5F5);
  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);
  static const _border = Color(0xFFE8E8E8);

  void _openCashSale(WidgetRef ref, BuildContext context) {
    ref.read(cashInitialTabProvider.notifier).state = 1;
    context.go('/app/cash');
  }

  void _openAgenda(BuildContext context) {
    context.go('/app/agenda');
  }

  void _showNewAppointmentSheet(BuildContext context, WidgetRef ref) {
    showCreateAppointmentSheet(context, ref);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bootstrap = ref.watch(bootstrapProvider);
    final brandingAsync = ref.watch(tenantBrandingProvider);
    final dashboardAsync = ref.watch(dashboardProvider);
    final dayAsync = ref.watch(todayAgendaProvider);
    final cashAsync = ref.watch(cashSessionProvider);
    final timeFmt = DateFormat.Hm();
    final todayLabel = DateFormat('EEEE d MMMM', 'fr_FR').format(DateTime.now());

    return Scaffold(
      backgroundColor: _bg,
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(dashboardProvider);
          ref.invalidate(tenantBrandingProvider);
          ref.invalidate(todayAgendaProvider);
          ref.invalidate(cashSessionProvider);
          await Future.wait([
            ref.read(dashboardProvider.future),
            ref.read(tenantBrandingProvider.future),
            ref.read(todayAgendaProvider.future),
            ref.read(cashSessionProvider.future),
          ]);
        },
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      brandingAsync.when(
                        loading: () => DashboardBrandingHeader(
                          displayName: bootstrap.appName,
                          dateLabel: todayLabel,
                        ),
                        error: (_, __) => DashboardBrandingHeader(
                          displayName: bootstrap.appName,
                          dateLabel: todayLabel,
                        ),
                        data: (branding) => DashboardBrandingHeader(
                          displayName: branding.displayName.isNotEmpty
                              ? branding.displayName
                              : bootstrap.appName,
                          dateLabel: todayLabel,
                          logoUrl: branding.logoUrl,
                        ),
                      ),
                      const SizedBox(height: 20),
                      DashboardQuickActions(
                        onCheckout: () => _openCashSale(ref, context),
                        onNewAppointment: () =>
                            _showNewAppointmentSheet(context, ref),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
              sliver: SliverToBoxAdapter(
                child: dayAsync.when(
                  loading: () => const _LoadingBlock(height: 220),
                  error: (e, _) => _ErrorBlock(message: '$e'),
                  data: (day) {
                    final next = day.nextAppointment;
                    if (next == null) {
                      return EmptyNextAppointmentCard(
                        onNewAppointment: () =>
                            _showNewAppointmentSheet(context, ref),
                      );
                    }
                    return NextAppointmentHero(
                      appointment: next,
                      onCheckout: () => _openCashSale(ref, context),
                      onAgenda: () => _openAgenda(context),
                    );
                  },
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
              sliver: SliverToBoxAdapter(
                child: dashboardAsync.when(
                  loading: () => const _LoadingBlock(height: 88),
                  error: (e, _) => _ErrorBlock(message: '$e'),
                  data: (dash) => DashboardKpiStrip(
                    revenueCents: dash.today.revenueCents,
                    appointments: dash.today.appointmentsScheduled,
                    salesCount: dash.today.salesCount,
                  ),
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
              sliver: SliverToBoxAdapter(
                child: _SectionCard(
                  title: 'Chiffre d’affaires',
                  subtitle: dashboardAsync.maybeWhen(
                    data: (d) {
                      final pct = d.weekRevenueChangePct;
                      if (pct == null) return 'Cette semaine';
                      final sign = pct >= 0 ? '+' : '';
                      return 'Cette semaine · $sign${pct.toStringAsFixed(0)} %';
                    },
                    orElse: () => 'Cette semaine',
                  ),
                  child: dashboardAsync.when(
                    loading: () => const _LoadingBlock(height: 160),
                    error: (_, __) => const SizedBox.shrink(),
                    data: (dash) => DashboardBarChart(series: dash.series),
                  ),
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
              sliver: SliverToBoxAdapter(
                child: dayAsync.when(
                  loading: () => const SizedBox.shrink(),
                  error: (_, __) => const SizedBox.shrink(),
                  data: (day) {
                    final next = day.nextAppointment;
                    final rest = day.appointments
                        .where((a) => next == null || a.id != next.id)
                        .toList();
                    if (rest.isEmpty) return const SizedBox.shrink();
                    return _SectionCard(
                      title: 'Suite de la journée',
                      subtitle: '${rest.length} rendez-vous',
                      child: Column(
                        children: [
                          for (var i = 0; i < rest.length; i++) ...[
                            if (i > 0) const Divider(height: 1, color: _border),
                            _TimelineRow(
                              time: timeFmt.format(rest[i].startsAt),
                              title: rest[i].clientName,
                              subtitle: rest[i].serviceName,
                            ),
                          ],
                        ],
                      ),
                    );
                  },
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
              sliver: SliverToBoxAdapter(
                child: cashAsync.when(
                  loading: () => const SizedBox.shrink(),
                  error: (_, __) => const SizedBox.shrink(),
                  data: (session) {
                    if (session == null) {
                      return _SectionCard(
                        title: 'Caisse',
                        subtitle: 'Fermée',
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const Text(
                              'Ouvrez une session pour encaisser.',
                              style: TextStyle(fontSize: 13, color: _muted),
                            ),
                            const SizedBox(height: 14),
                            OutlinedButton(
                              onPressed: () {
                                ref.read(cashInitialTabProvider.notifier).state =
                                    0;
                                context.go('/app/cash');
                              },
                              style: OutlinedButton.styleFrom(
                                foregroundColor: _black,
                                side: const BorderSide(color: _black),
                                padding:
                                    const EdgeInsets.symmetric(vertical: 12),
                              ),
                              child: const Text('Ouvrir la caisse'),
                            ),
                          ],
                        ),
                      );
                    }
                    return _SectionCard(
                      title: 'Caisse ouverte',
                      subtitle:
                          'Depuis ${timeFmt.format(session.openedAt)}',
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  formatEuros(session.totalCents),
                                  style: const TextStyle(
                                    fontSize: 22,
                                    fontWeight: FontWeight.w700,
                                    color: _black,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${session.salesCount} ventes',
                                  style: const TextStyle(
                                    fontSize: 13,
                                    color: _muted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          TextButton(
                            onPressed: () => _openCashSale(ref, context),
                            child: const Text('Encaisser'),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.title,
    required this.subtitle,
    required this.child,
  });

  final String title;
  final String subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: HomeScreen._border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: HomeScreen._black,
                  ),
                ),
              ),
              Text(
                subtitle,
                style: const TextStyle(fontSize: 12, color: HomeScreen._muted),
              ),
            ],
          ),
          const SizedBox(height: 16),
          child,
        ],
      ),
    );
  }
}

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({
    required this.time,
    required this.title,
    required this.subtitle,
  });

  final String time;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          SizedBox(
            width: 48,
            child: Text(
              time,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: HomeScreen._black,
              ),
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: HomeScreen._black,
                  ),
                ),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 12,
                    color: HomeScreen._muted,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LoadingBlock extends StatelessWidget {
  const _LoadingBlock({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: const Center(
        child: SizedBox(
          width: 22,
          height: 22,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      ),
    );
  }
}

class _ErrorBlock extends StatelessWidget {
  const _ErrorBlock({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: HomeScreen._border),
      ),
      child: Text(
        message,
        style: const TextStyle(fontSize: 13, color: HomeScreen._muted),
      ),
    );
  }
}
