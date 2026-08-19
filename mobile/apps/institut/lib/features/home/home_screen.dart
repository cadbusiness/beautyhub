import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../state/pos_cart_provider.dart';
import '../../state/session_providers.dart';
import '../agenda/widgets/appointment_detail_sheet.dart';
import '../agenda/widgets/appointment_form_sheet.dart';
import '../cash/session_duration.dart';
import '../shared/cabin_badge.dart';
import '../shared/money.dart';
import '../shared/tenant_logo.dart';
import 'widgets/dashboard_bar_chart.dart';
import 'widgets/dashboard_kpi_strip.dart';
import 'widgets/dashboard_quick_actions.dart';
import 'widgets/dashboard_sales_channel_filter.dart';
import 'widgets/next_appointment_hero.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  static const _bg = Color(0xFFF5F5F5);
  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);
  static const _border = Color(0xFFE8E8E8);

  void _openCashSale(
    WidgetRef ref,
    BuildContext context, {
    DayAppointment? appointment,
  }) {
    if (appointment != null) {
      startAppointmentCheckout(ref, appointment);
    } else {
      ref.read(cashInitialTabProvider.notifier).state = 1;
    }
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
    // Rebuild toutes les 30 s pour que "prochain RDV" avance
    // automatiquement quand l'heure d'un RDV est passée, sans exiger
    // un pull-to-refresh manuel.
    ref.watch(minuteTickerProvider);
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
                  loading: () => const _LoadingBlock(height: 96),
                  error: (e, _) => _ErrorBlock(message: '$e'),
                  data: (day) {
                    final nextGroup = nextParallelAppointments(
                      day.appointments,
                      hint: day.nextAppointment,
                    );
                    if (nextGroup.isEmpty) {
                      return EmptyNextAppointmentCard(
                        onNewAppointment: () =>
                            _showNewAppointmentSheet(context, ref),
                      );
                    }
                    return NextAppointmentHero(
                      appointments: nextGroup,
                      onCheckout: () => _openCashSale(
                        ref,
                        context,
                        appointment: nextGroup.first,
                      ),
                      onAgenda: () => _openAgenda(context),
                      onTapAppointment: (appointment) =>
                          showAppointmentDetailSheet(
                        context,
                        ref,
                        appointment,
                      ),
                    );
                  },
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
              sliver: SliverToBoxAdapter(
                child: const DashboardSalesChannelFilter(),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
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
                    const previewLimit = 4;
                    final nextGroup = nextParallelAppointments(
                      day.appointments,
                      hint: day.nextAppointment,
                    );
                    final nextIds = {for (final a in nextGroup) a.id};
                    final now = DateTime.now();
                    final rest = day.appointments
                        .where(
                          (a) =>
                              !nextIds.contains(a.id) &&
                              !a.isCancelled &&
                              !a.endsAt.isBefore(now),
                        )
                        .toList();
                    if (rest.isEmpty) return const SizedBox.shrink();
                    final preview = rest.take(previewLimit).toList();
                    final remaining = rest.length - preview.length;
                    return _SectionCard(
                      title: 'Suite de la journée',
                      subtitle: rest.length == 1
                          ? '1 rendez-vous'
                          : '${rest.length} rendez-vous',
                      child: Column(
                        children: [
                          for (var i = 0; i < preview.length; i++) ...[
                            if (i > 0) const Divider(height: 1, color: _border),
                            _TimelineRow(
                              appointment: preview[i],
                              time: timeFmt.format(preview[i].startsAt),
                              onTap: () => showAppointmentDetailSheet(
                                context,
                                ref,
                                preview[i],
                              ),
                            ),
                          ],
                          if (remaining > 0) ...[
                            const Divider(height: 1, color: _border),
                            TextButton(
                              onPressed: () => _openAgenda(context),
                              child: Text(
                                remaining == 1
                                    ? 'Voir 1 autre dans l’agenda'
                                    : 'Voir les $remaining autres dans l’agenda',
                              ),
                            ),
                          ] else
                            Align(
                              alignment: Alignment.centerLeft,
                              child: TextButton(
                                onPressed: () => _openAgenda(context),
                                child: const Text('Ouvrir l’agenda'),
                              ),
                            ),
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
                        title: 'Caisse fermée',
                        subtitle: 'Fond facultatif',
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const Text(
                              'Ouvrez la journée pour encaisser. Pas besoin de fond si le tiroir est vide.',
                              style: TextStyle(fontSize: 13, color: _muted, height: 1.35),
                            ),
                            const SizedBox(height: 14),
                            FilledButton(
                              onPressed: () async {
                                try {
                                  await openInstitutCashDay(ref);
                                } catch (_) {
                                  ref.read(cashInitialTabProvider.notifier).state = 0;
                                  if (context.mounted) context.go('/app/cash');
                                }
                              },
                              style: FilledButton.styleFrom(
                                backgroundColor: _black,
                                foregroundColor: Colors.white,
                                padding:
                                    const EdgeInsets.symmetric(vertical: 12),
                              ),
                              child: const Text('Ouvrir sans fond'),
                            ),
                            TextButton(
                              onPressed: () {
                                ref.read(cashInitialTabProvider.notifier).state =
                                    0;
                                context.go('/app/cash');
                              },
                              child: const Text('Ajouter un fond de caisse'),
                            ),
                          ],
                        ),
                      );
                    }
                    return _SectionCard(
                      title: session.paused
                          ? 'Caisse en pause'
                          : session.previousDay
                              ? 'Session d’hier ouverte'
                              : 'Caisse ouverte',
                      subtitle: session.previousDay
                          ? 'Encaissements bloqués — clôturez-la avec l’heure d’hier'
                          : sessionOpenedCaption(
                              openedAt: session.openedAt,
                              previousDay: false,
                              paused: session.paused,
                            ),
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
                                  session.itemsSoldQty > 0
                                      ? '${session.salesCount} ventes · ${session.itemsSoldQty} art.'
                                      : '${session.salesCount} ventes',
                                  style: const TextStyle(
                                    fontSize: 13,
                                    color: _muted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (session.previousDay || session.paused)
                            TextButton(
                              onPressed: () {
                                if (session.previousDay) {
                                  requestCashCloseSheet(ref);
                                } else {
                                  ref.read(cashInitialTabProvider.notifier).state = 0;
                                }
                                context.go('/app/cash');
                              },
                              child: Text(session.paused ? 'Reprendre' : 'Clôturer'),
                            )
                          else
                            FilledButton.icon(
                              onPressed: () => _openCashSale(ref, context),
                              style: FilledButton.styleFrom(
                                backgroundColor: _black,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.fromLTRB(12, 10, 14, 10),
                                minimumSize: const Size(0, 40),
                                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                visualDensity: VisualDensity.compact,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                              ),
                              icon: const Icon(
                                Icons.point_of_sale_outlined,
                                size: 16,
                              ),
                              label: const Text(
                                'Encaisser',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
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
          Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: HomeScreen._black,
            ),
          ),
          if (subtitle.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              subtitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 12, color: HomeScreen._muted),
            ),
          ],
          const SizedBox(height: 16),
          child,
        ],
      ),
    );
  }
}

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({
    required this.appointment,
    required this.time,
    required this.onTap,
  });

  final DayAppointment appointment;
  final String time;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final serviceLine = [
      appointment.serviceName,
      if (appointment.durationLabel.isNotEmpty) appointment.durationLabel,
      if (appointment.staffName != null) appointment.staffName!,
    ].join(' · ');

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
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
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          appointment.clientName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: HomeScreen._black,
                          ),
                        ),
                      ),
                      if (appointment.resourceName != null) ...[
                        const SizedBox(width: 8),
                        CabinBadge(
                          label: appointment.resourceName!,
                          compact: true,
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    serviceLine,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
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
