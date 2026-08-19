import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../state/session_providers.dart';
import '../../widgets/app_sheet.dart';
import '../shared/money.dart';
import '../shared/sale_doc.dart';
import 'client_editor_sheet.dart';

Future<InstClient?> showClientDetailSheet({
  required BuildContext context,
  required InstClient client,
  ValueChanged<InstClient>? onChanged,
}) {
  return showAppSheet<InstClient>(
    context: context,
    builder: (_) => _ClientDetailSheet(client: client, onChanged: onChanged),
  );
}

class _ClientDetailSheet extends ConsumerStatefulWidget {
  const _ClientDetailSheet({required this.client, this.onChanged});

  final InstClient client;
  final ValueChanged<InstClient>? onChanged;

  @override
  ConsumerState<_ClientDetailSheet> createState() => _ClientDetailSheetState();
}

class _ClientDetailSheetState extends ConsumerState<_ClientDetailSheet> {
  late InstClient client = widget.client;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);
  static const _border = Color(0xFFE5E5E5);
  static const _rowBg = Color(0xFFF9FAFB);

  String _tab = 'apercu';
  InstClientDossier? _dossier;
  InstClientLoyaltyDetail? _loyalty;
  InstClientAppointmentsPage? _appointments;
  List<InstClientSale>? _sales;
  bool _loadingDossier = true;
  bool _loadingLoyalty = false;
  bool _loadingAppointments = false;
  bool _loadingSales = false;
  String? _error;
  bool _assigning = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadDossier());
  }

  ({String token, String tenantId})? _session() {
    final token = ref.read(accessTokenProvider);
    final tenantId = ref.read(selectedTenantIdProvider);
    if (token == null || tenantId == null) return null;
    return (token: token, tenantId: tenantId);
  }

  Future<void> _loadDossier() async {
    final session = _session();
    if (session == null) {
      setState(() {
        _loadingDossier = false;
        _error = 'Session ou institut manquant';
      });
      return;
    }
    setState(() {
      _loadingDossier = true;
      _error = null;
    });
    try {
      final dossier = await ref.read(mobileApiProvider).fetchClientDossier(
            accessToken: session.token,
            tenantId: session.tenantId,
            clientId: client.id,
          );
      if (!mounted) return;
      setState(() {
        _dossier = dossier;
        client = dossier.client;
        _loadingDossier = false;
      });
      widget.onChanged?.call(dossier.client);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loadingDossier = false;
      });
    }
  }

  Future<void> _ensureLoyalty() async {
    if (_loyalty != null || _loadingLoyalty) return;
    final session = _session();
    if (session == null) return;
    setState(() => _loadingLoyalty = true);
    try {
      final detail = await ref.read(mobileApiProvider).fetchClientLoyaltyDossier(
            accessToken: session.token,
            tenantId: session.tenantId,
            clientId: client.id,
          );
      if (!mounted) return;
      setState(() {
        _loyalty = detail;
        _loadingLoyalty = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loadingLoyalty = false);
      _snack(e.toString());
    }
  }

  Future<void> _ensureAppointments() async {
    if (_appointments != null || _loadingAppointments) return;
    final session = _session();
    if (session == null) return;
    setState(() => _loadingAppointments = true);
    try {
      final page = await ref.read(mobileApiProvider).fetchClientAppointments(
            accessToken: session.token,
            tenantId: session.tenantId,
            clientId: client.id,
          );
      if (!mounted) return;
      setState(() {
        _appointments = page;
        _loadingAppointments = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loadingAppointments = false);
      _snack(e.toString());
    }
  }

  Future<void> _ensureSales() async {
    if (_sales != null || _loadingSales) return;
    final session = _session();
    if (session == null) return;
    setState(() => _loadingSales = true);
    try {
      final sales = await ref.read(mobileApiProvider).fetchClientSalesHistory(
            accessToken: session.token,
            tenantId: session.tenantId,
            clientId: client.id,
          );
      if (!mounted) return;
      setState(() {
        _sales = sales;
        _loadingSales = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loadingSales = false);
      _snack(e.toString());
    }
  }

  void _selectTab(String tab) {
    setState(() => _tab = tab);
    switch (tab) {
      case 'fidelite':
        _ensureLoyalty();
      case 'rdv':
        _ensureAppointments();
      case 'ventes':
        _ensureSales();
    }
  }

  Future<void> _assignProgram(String? programId) async {
    final session = _session();
    if (session == null || _assigning) return;
    setState(() => _assigning = true);
    try {
      final detail = await ref.read(mobileApiProvider).assignClientLoyaltyProgram(
            accessToken: session.token,
            tenantId: session.tenantId,
            clientId: client.id,
            loyaltyProgramId: programId,
          );
      if (!mounted) return;
      setState(() {
        _loyalty = detail;
        final current = _dossier;
        if (current != null) {
          _dossier = InstClientDossier(
            client: current.client,
            stats: current.stats,
            loyalty: detail.card,
            topServices: current.topServices,
          );
        }
        _assigning = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _assigning = false);
      _snack(e.toString());
    }
  }

  Future<void> _edit() async {
    final result = await showClientEditorSheet(
      context: context,
      client: client,
    );
    if (result == null || !mounted) return;
    setState(() => client = result.client);
    widget.onChanged?.call(result.client);
    if (result.account != null) {
      showClientAccountCreatedSnackBar(context, result.account!);
    }
    _dossier = null;
    await _loadDossier();
  }

  void _copy(String value, String label) {
    Clipboard.setData(ClipboardData(text: value));
    _snack('$label copié');
  }

  void _snack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  String _formatDob(String raw) {
    final parsed = DateTime.tryParse(raw);
    if (parsed == null) return raw;
    return DateFormat('d MMMM y', 'fr_FR').format(parsed);
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'confirmed':
        return 'Confirmé';
      case 'completed':
        return 'Terminé';
      case 'cancelled':
        return 'Annulé';
      case 'no_show':
        return 'Absent';
      default:
        return 'Réservé';
    }
  }

  String _saleStatus(String status) {
    switch (status) {
      case 'partial':
        return 'Acompte';
      case 'refunded':
        return 'Remboursé';
      default:
        return 'Payé';
    }
  }

  String _ledgerLabel(InstLoyaltyLedgerEntry entry) {
    switch (entry.source) {
      case 'appointment_completed':
        return 'RDV terminé';
      case 'pos_sale':
        return 'Caisse';
      case 'woocommerce_order':
        return 'Boutique';
      case 'manual':
        return 'Ajustement';
      default:
        return entry.type == 'redeem' ? 'Échange' : 'Crédit';
    }
  }

  @override
  Widget build(BuildContext context) {
    final createdAt = DateFormat('d MMM y', 'fr_FR').format(client.createdAt);
    final loyalty = _loyalty?.card ?? _dossier?.loyalty;

    return FractionallySizedBox(
      heightFactor: 0.92,
      child: Column(
        children: [
          const SizedBox(height: 8),
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: _border,
              borderRadius: BorderRadius.circular(99),
            ),
          ),
          const SizedBox(height: 14),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    client.displayName,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: _black,
                      letterSpacing: -0.3,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(client),
                  icon: const Icon(Icons.close_rounded, size: 22),
                  color: _muted,
                  splashRadius: 20,
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Text(
              'Ajoutée le $createdAt',
              style: const TextStyle(fontSize: 12, color: _muted),
            ),
          ),
          const SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                _TabChip(
                  label: 'Aperçu',
                  selected: _tab == 'apercu',
                  onTap: () => _selectTab('apercu'),
                ),
                _TabChip(
                  label: 'Fidélité',
                  selected: _tab == 'fidelite',
                  onTap: () => _selectTab('fidelite'),
                ),
                _TabChip(
                  label: 'RDV',
                  selected: _tab == 'rdv',
                  onTap: () => _selectTab('rdv'),
                ),
                _TabChip(
                  label: 'Ventes',
                  selected: _tab == 'ventes',
                  onTap: () => _selectTab('ventes'),
                ),
                _TabChip(
                  label: 'Suivi',
                  selected: _tab == 'suivi',
                  onTap: () => _selectTab('suivi'),
                ),
                _TabChip(
                  label: 'Garanties',
                  selected: _tab == 'garanties',
                  onTap: () => _selectTab('garanties'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: _loadingDossier
                ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
                : _error != null && _dossier == null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Text(
                            _error!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: _muted),
                          ),
                        ),
                      )
                    : switch (_tab) {
                        'fidelite' => _buildLoyalty(loyalty),
                        'rdv' => _buildAppointments(),
                        'ventes' => _buildSales(),
                        'suivi' => const _SoonTab(
                            title: 'Suivi',
                            body:
                                'Le suivi de routine (protocole, produits conseillés) arrivera ici.',
                          ),
                        'garanties' => const _SoonTab(
                            title: 'Garanties',
                            body:
                                'Les produits sous garantie arriveront ici.',
                          ),
                        _ => _buildOverview(loyalty),
                      },
          ),
          if (_tab == 'apercu')
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
                child: SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: FilledButton.icon(
                    onPressed: _edit,
                    icon: const Icon(Icons.edit_outlined, size: 18),
                    label: const Text('Modifier'),
                    style: FilledButton.styleFrom(
                      backgroundColor: _black,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildOverview(InstClientLoyaltyCard? loyalty) {
    final stats = _dossier?.stats;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
      children: [
        if (stats != null) ...[
          Row(
            children: [
              Expanded(
                child: _StatTile(
                  label: 'CA',
                  value: formatEuros(stats.totalSpentCents),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _StatTile(
                  label: 'RDV à venir',
                  value: '${stats.upcomingCount}',
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _StatTile(
                  label: loyalty?.pointsLabel ?? 'points',
                  value: '${loyalty?.balance ?? stats.loyaltyPoints}',
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
        ],
        _Section(
          title: 'Contact',
          children: [
            if (client.email != null)
              _InfoRow(
                icon: Icons.mail_outline_rounded,
                label: client.email!,
                onCopy: () => _copy(client.email!, 'Email'),
              ),
            if (client.phone != null)
              _InfoRow(
                icon: Icons.phone_outlined,
                label: client.phone!,
                onCopy: () => _copy(client.phone!, 'Téléphone'),
              ),
            if (client.email == null && client.phone == null)
              const _EmptyRow(
                icon: Icons.contact_page_outlined,
                label: 'Aucun contact enregistré.',
              ),
          ],
        ),
        if (client.dateOfBirth != null) ...[
          const SizedBox(height: 20),
          _Section(
            title: 'Naissance',
            children: [
              _InfoRow(
                icon: Icons.cake_outlined,
                label: _formatDob(client.dateOfBirth!),
              ),
            ],
          ),
        ],
        if (client.hasAddress) ...[
          const SizedBox(height: 20),
          _Section(
            title: 'Adresse',
            children: [
              _InfoRow(
                icon: Icons.location_on_outlined,
                label: client.addressOneLine,
                maxLines: 3,
                onCopy: () => _copy(client.addressOneLine, 'Adresse'),
              ),
            ],
          ),
        ],
        if (client.notes != null && client.notes!.isNotEmpty) ...[
          const SizedBox(height: 20),
          _Section(
            title: 'Notes',
            padded: true,
            children: [
              Text(
                client.notes!,
                style: const TextStyle(
                  fontSize: 14,
                  color: _black,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ],
        const SizedBox(height: 20),
        _Section(
          title: 'Compte',
          children: [
            _InfoRow(
              icon: Icons.mail_outline_rounded,
              label: client.marketingOptIn
                  ? 'Marketing autorisé'
                  : 'Marketing désactivé',
              trailing: client.marketingOptIn
                  ? _Badge.green('Actif')
                  : _Badge.gray('Refusé'),
            ),
            _InfoRow(
              icon: Icons.badge_outlined,
              label: client.hasAccount
                  ? 'Compte cliente activé'
                  : 'Pas de compte cliente',
              trailing: client.hasAccount
                  ? _Badge.blue('Activé')
                  : _Badge.gray('Aucun'),
            ),
          ],
        ),
        if (client.tags.isNotEmpty) ...[
          const SizedBox(height: 20),
          _Section(
            title: 'Étiquettes',
            padded: true,
            children: [
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: client.tags
                    .map(
                      (t) => Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF3F4F6),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          t,
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF404040),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    )
                    .toList(),
              ),
            ],
          ),
        ],
        if (_dossier != null && _dossier!.topServices.isNotEmpty) ...[
          const SizedBox(height: 20),
          _Section(
            title: 'Prestations fréquentes',
            children: [
              for (final service in _dossier!.topServices.take(3))
                _InfoRow(
                  icon: Icons.spa_outlined,
                  label: '${service.serviceName} · ${service.count}×',
                ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _buildLoyalty(InstClientLoyaltyCard? card) {
    if (_loadingLoyalty && _loyalty == null) {
      return const Center(child: CircularProgressIndicator(strokeWidth: 2));
    }
    if (card == null) {
      return const _SoonTab(
        title: 'Fidélité',
        body: 'Aucun programme de fidélité pour le moment.',
      );
    }
    final next = card.nextReward;
    final programs = card.programs;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
      children: [
        Row(
          children: [
            Expanded(
              child: _StatTile(
                label: card.creditEnabled ? 'Bon fidélité' : card.pointsLabel,
                value: card.creditEnabled
                    ? formatEuros(card.balance)
                    : '${card.balance}',
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _StatTile(
                label: card.creditEnabled ? 'Utilisable' : 'Valeur estimée',
                value: formatEuros(card.valueCents),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: _StatTile(
                label: 'Gagnés',
                value: '${card.lifetimeEarned}',
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _StatTile(
                label: 'Utilisés',
                value: '${card.lifetimeRedeemed}',
              ),
            ),
          ],
        ),
        if (next != null) ...[
          const SizedBox(height: 16),
          _Section(
            title: 'Prochaine récompense',
            padded: true,
            children: [
              Text(
                next.name,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: _black,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Encore ${next.missing} ${card.pointsLabel} (coût ${next.pointsCost})',
                style: const TextStyle(fontSize: 13, color: _muted),
              ),
            ],
          ),
        ],
        const SizedBox(height: 20),
        _Section(
          title: 'Groupe',
          padded: true,
          children: [
            Text(
              card.programName ?? 'Programme actif de l’institut',
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: _black,
              ),
            ),
            const SizedBox(height: 10),
            DropdownButtonFormField<String?>(
              initialValue: programs.any((p) => p.id == card.assignedProgramId)
                  ? card.assignedProgramId
                  : null,
              isExpanded: true,
              decoration: InputDecoration(
                filled: true,
                fillColor: Colors.white,
                isDense: true,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: _border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: _border),
                ),
              ),
              items: [
                const DropdownMenuItem<String?>(
                  value: null,
                  child: Text('Automatique (programme actif)'),
                ),
                for (final program in programs)
                  DropdownMenuItem<String?>(
                    value: program.id,
                    child: Text(
                      program.isActive
                          ? program.name
                          : '${program.name} (inactif)',
                    ),
                  ),
              ],
              onChanged: _assigning ? null : _assignProgram,
            ),
            if (_assigning)
              const Padding(
                padding: EdgeInsets.only(top: 10),
                child: LinearProgressIndicator(minHeight: 2),
              ),
          ],
        ),
        const SizedBox(height: 20),
        _Section(
          title: 'Historique',
          children: [
            if (_loyalty == null || _loyalty!.ledger.isEmpty)
              const _EmptyRow(
                icon: Icons.history_rounded,
                label: 'Aucun mouvement pour l’instant.',
              )
            else
              for (final entry in _loyalty!.ledger)
                _InfoRow(
                  icon: entry.pointsDelta >= 0
                      ? Icons.add_circle_outline
                      : Icons.remove_circle_outline,
                  label:
                      '${entry.pointsDelta >= 0 ? '+' : ''}${card.creditEnabled ? formatEuros(entry.pointsDelta.abs()) : entry.pointsDelta} · ${_ledgerLabel(entry)}',
                  trailing: Text(
                    DateFormat('d MMM', 'fr_FR').format(entry.createdAt),
                    style: const TextStyle(fontSize: 12, color: _muted),
                  ),
                ),
          ],
        ),
      ],
    );
  }

  Widget _buildAppointments() {
    if (_loadingAppointments && _appointments == null) {
      return const Center(child: CircularProgressIndicator(strokeWidth: 2));
    }
    final page = _appointments;
    if (page == null || (page.upcoming.isEmpty && page.past.isEmpty)) {
      return const _SoonTab(
        title: 'Rendez-vous',
        body: 'Aucun rendez-vous pour cette cliente.',
      );
    }
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
      children: [
        if (page.upcoming.isNotEmpty) ...[
          _Section(
            title: 'À venir',
            children: [
              for (final item in page.upcoming) _appointmentRow(item),
            ],
          ),
          const SizedBox(height: 20),
        ],
        if (page.past.isNotEmpty)
          _Section(
            title: 'Passés',
            children: [
              for (final item in page.past) _appointmentRow(item),
            ],
          ),
      ],
    );
  }

  Widget _appointmentRow(InstClientAppointment item) {
    final when = DateFormat("EEE d MMM · HH:mm", 'fr_FR').format(item.startsAt);
    return _InfoRow(
      icon: Icons.event_outlined,
      label: [
        item.serviceName ?? 'Prestation',
        when,
        if (item.staffName != null) item.staffName!,
      ].join(' · '),
      maxLines: 2,
      trailing: _Badge.gray(_statusLabel(item.status)),
    );
  }

  Widget _buildSales() {
    if (_loadingSales && _sales == null) {
      return const Center(child: CircularProgressIndicator(strokeWidth: 2));
    }
    final sales = _sales ?? const [];
    if (sales.isEmpty) {
      return const _SoonTab(
        title: 'Ventes',
        body: 'Aucun ticket pour cette cliente.',
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      itemCount: sales.length,
      separatorBuilder: (_, _) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final sale = sales[index];
        return Container(
          decoration: BoxDecoration(
            color: _rowBg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: _border),
          ),
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
          child: Row(
            children: [
              const SaleDocMark(docType: 'ticket', size: 34),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      sale.ticketNumber != null
                          ? 'Ticket n° ${sale.ticketNumber}'
                          : 'Ticket',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: _black,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      [
                        DateFormat('d MMM y · HH:mm', 'fr_FR')
                            .format(sale.createdAt),
                        if (sale.paymentMethod != null)
                          salePaymentLabel(sale.paymentMethod!),
                        if (sale.items.isNotEmpty)
                          '${sale.items.length} article${sale.items.length > 1 ? 's' : ''}',
                      ].join(' · '),
                      style: const TextStyle(fontSize: 12, color: _muted),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    formatEuros(sale.totalCents),
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: _black,
                    ),
                  ),
                  Text(
                    _saleStatus(sale.status),
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF065F46),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}

class _TabChip extends StatelessWidget {
  const _TabChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: Material(
        color: selected ? _ClientDetailSheetState._black : Colors.white,
        borderRadius: BorderRadius.circular(99),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(99),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(99),
              border: Border.all(
                color: selected
                    ? _ClientDetailSheetState._black
                    : _ClientDetailSheetState._border,
              ),
            ),
            child: Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: selected
                    ? Colors.white
                    : _ClientDetailSheetState._muted,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
      decoration: BoxDecoration(
        color: _ClientDetailSheetState._rowBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _ClientDetailSheetState._border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
              color: _ClientDetailSheetState._muted,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: _ClientDetailSheetState._black,
            ),
          ),
        ],
      ),
    );
  }
}

class _SoonTab extends StatelessWidget {
  const _SoonTab({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: _ClientDetailSheetState._black,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          body,
          style: const TextStyle(
            fontSize: 14,
            color: _ClientDetailSheetState._muted,
            height: 1.4,
          ),
        ),
      ],
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({
    required this.title,
    required this.children,
    this.padded = false,
  });

  final String title;
  final List<Widget> children;
  final bool padded;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
          child: Text(
            title.toUpperCase(),
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.6,
              color: _ClientDetailSheetState._muted,
            ),
          ),
        ),
        Container(
          padding: padded ? const EdgeInsets.all(12) : EdgeInsets.zero,
          decoration: BoxDecoration(
            color: _ClientDetailSheetState._rowBg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: _ClientDetailSheetState._border),
          ),
          child: Column(
            children: children,
          ),
        ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    this.onCopy,
    this.trailing,
    this.maxLines = 1,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onCopy;
  final Widget? trailing;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onCopy,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
        child: Row(
          children: [
            Icon(icon, size: 18, color: _ClientDetailSheetState._muted),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 14,
                  color: _ClientDetailSheetState._black,
                  fontWeight: FontWeight.w500,
                ),
                maxLines: maxLines,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (trailing != null)
              trailing!
            else if (onCopy != null)
              const Icon(
                Icons.copy_rounded,
                size: 16,
                color: _ClientDetailSheetState._muted,
              ),
          ],
        ),
      ),
    );
  }
}

class _EmptyRow extends StatelessWidget {
  const _EmptyRow({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
      child: Row(
        children: [
          Icon(icon, size: 18, color: _ClientDetailSheetState._muted),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 13,
                color: _ClientDetailSheetState._muted,
                fontStyle: FontStyle.italic,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({
    required this.label,
    required this.color,
    required this.background,
  });

  factory _Badge.green(String label) => _Badge(
        label: label,
        color: const Color(0xFF065F46),
        background: const Color(0xFFD1FAE5),
      );

  factory _Badge.blue(String label) => _Badge(
        label: label,
        color: const Color(0xFF1E40AF),
        background: const Color(0xFFDBE7FE),
      );

  factory _Badge.gray(String label) => _Badge(
        label: label,
        color: const Color(0xFF525252),
        background: const Color(0xFFF1F1F1),
      );

  final String label;
  final Color color;
  final Color background;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: color,
          letterSpacing: 0.2,
        ),
      ),
    );
  }
}
